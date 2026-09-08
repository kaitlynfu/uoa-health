import ARKit
import AVFoundation
import ExpoModulesCore
import SceneKit

public class WayfinderArModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WayfinderAr")
    Function("isSupported") { ARWorldTrackingConfiguration.isSupported }
    Function("markerAlignmentVersion") { 1 }
    Function("routeEditorAvailable") { () -> Bool in
      #if DEBUG
      return true
      #else
      return false
      #endif
    }
    Function("readHomeRoutes") { () -> String? in
      UserDefaults.standard.string(forKey: "home-routes-marker-v1")
    }
    Function("writeHomeRoutes") { (value: String) throws in
      #if DEBUG
      guard value.utf8.count <= 200_000,
        let data = value.data(using: .utf8),
        let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
        object["version"] as? Int == 1, object["marker"] as? String == "home-start-v1",
        object["routes"] is [String: Any] else {
        throw NSError(domain: "WayfinderRouteEditor", code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Invalid route data."])
      }
      UserDefaults.standard.set(value, forKey: "home-routes-marker-v1")
      #else
      throw NSError(domain: "WayfinderRouteEditor", code: 2,
        userInfo: [NSLocalizedDescriptionKey: "Editing is disabled in release builds."])
      #endif
    }
    View(WayfinderArView.self) {
      Events("onPose", "onStatus", "onMarker")
      Prop("active") { (view: WayfinderArView, active: Bool) in view.setActive(active) }
      // Empty = hide. Otherwise world x/y/z + yaw radians. The node is never parented to the camera.
      Prop("waypoint") { (view: WayfinderArView, values: [Double]) in view.setWaypoint(values) }
    }
  }
}

final class WayfinderArView: ExpoView, ARSessionDelegate {
  let onPose = EventDispatcher()
  let onStatus = EventDispatcher()
  let onMarker = EventDispatcher()
  private let sceneView = ARSCNView(frame: .zero)
  private let marker = SCNNode()
  private var active = false
  private var running = false
  private var trackingReady = false
  private var referenceImage: ARReferenceImage?
  private var loadingReference = false
  private var referenceFailed = false
  private var lastFrame: TimeInterval = 0
  private var lastStatus = ""
  private var observations: [NSObjectProtocol] = []

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    sceneView.scene = SCNScene()
    sceneView.automaticallyUpdatesLighting = true
    sceneView.session.delegate = self
    sceneView.session.delegateQueue = .main
    addSubview(sceneView)
    makeMarker()
    sceneView.scene.rootNode.addChildNode(marker)
    marker.isHidden = true
    observations.append(NotificationCenter.default.addObserver(
      forName: UIApplication.willResignActiveNotification, object: nil, queue: .main
    ) { [weak self] _ in
      self?.pause()
      self?.status("interrupted", "Return to the start and align again after resuming.")
    })
    observations.append(NotificationCenter.default.addObserver(
      forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
    ) { [weak self] _ in self?.startIfNeeded() })
  }

  deinit {
    sceneView.session.pause()
    observations.forEach { NotificationCenter.default.removeObserver($0) }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    sceneView.frame = bounds
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil { pause() } else { startIfNeeded() }
  }

  func setActive(_ value: Bool) {
    active = value
    if active { startIfNeeded() } else { pause() }
  }

  private func pause() {
    sceneView.session.pause()
    marker.isHidden = true
    running = false
    trackingReady = false
  }

  private func status(_ state: String, _ message: String) {
    let key = state + message
    guard lastStatus != key else { return }
    lastStatus = key
    onStatus(["state": state, "message": message])
  }

  private func startIfNeeded() {
    guard active, window != nil, !running, UIApplication.shared.applicationState == .active else { return }
    guard ARWorldTrackingConfiguration.isSupported else {
      status("unavailable", "AR world tracking is unavailable on this device.")
      return
    }
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized: break
    case .notDetermined:
      AVCaptureDevice.requestAccess(for: .video) { [weak self] _ in
        DispatchQueue.main.async { self?.startIfNeeded() }
      }
      return
    default:
      status("unavailable", "Allow Camera access for this app in iPhone Settings, then reopen this screen.")
      return
    }
    guard let referenceImage = referenceImage else {
      prepareReference()
      return
    }
    let configuration = ARWorldTrackingConfiguration()
    configuration.worldAlignment = .gravity
    configuration.detectionImages = [referenceImage]
    configuration.maximumNumberOfTrackedImages = 1
    configuration.automaticImageScaleEstimationEnabled = false
    lastFrame = 0
    running = true
    marker.isHidden = true
    status("initializing", "Look around slowly, then scan the fixed HOME START floor marker.")
    sceneView.session.run(configuration, options: [.resetTracking, .removeExistingAnchors])
  }

  private func prepareReference() {
    guard !loadingReference, !referenceFailed else { return }
    loadingReference = true
    let container = Bundle(for: WayfinderArView.self)
    let bundleURL = container.url(forResource: "WayfinderArResources", withExtension: "bundle")
      ?? Bundle.main.url(forResource: "WayfinderArResources", withExtension: "bundle")
    guard let bundleURL = bundleURL, let bundle = Bundle(url: bundleURL),
      let url = bundle.url(forResource: "home-start-v1", withExtension: "png"),
      let cgImage = UIImage(contentsOfFile: url.path)?.cgImage else {
      referenceFailed = true
      loadingReference = false
      status("unavailable", "Marker resource missing. Rebuild the iPhone app with the marker module.")
      return
    }
    let image = ARReferenceImage(cgImage, orientation: .up, physicalWidth: 0.20)
    image.name = "home-start-v1"
    status("initializing", "Checking marker image…")
    image.validate { [weak self] error in
      DispatchQueue.main.async {
        guard let self = self else { return }
        self.loadingReference = false
        if let error = error {
          self.referenceFailed = true
          self.status("unavailable", "Marker validation failed: \(error.localizedDescription)")
          return
        }
        self.referenceImage = image
        self.startIfNeeded()
      }
    }
  }

  func setWaypoint(_ values: [Double]) {
    guard values.count == 4, values.allSatisfy({ $0.isFinite }), running, trackingReady else {
      marker.isHidden = true
      return
    }
    marker.position = SCNVector3(Float(values[0]), Float(values[1]), Float(values[2]))
    marker.eulerAngles.y = Float(values[3])
    marker.isHidden = false
  }

  private func makeMarker() {
    let material = SCNMaterial()
    material.diffuse.contents = UIColor.systemBlue
    material.emission.contents = UIColor(red: 0.02, green: 0.12, blue: 0.3, alpha: 1)
    material.lightingModel = .constant
    // Arrow lies horizontally, pointing along local -Z. Roughly 0.6 m long.
    let shaft = SCNCylinder(radius: 0.055, height: 0.32)
    shaft.materials = [material]
    let shaftNode = SCNNode(geometry: shaft)
    shaftNode.eulerAngles.x = -.pi / 2
    shaftNode.position.z = 0.1
    marker.addChildNode(shaftNode)
    let head = SCNCone(topRadius: 0, bottomRadius: 0.17, height: 0.26)
    head.materials = [material]
    let headNode = SCNNode(geometry: head)
    headNode.eulerAngles.x = -.pi / 2
    headNode.position.z = -0.18
    marker.addChildNode(headNode)
  }

  func session(_ session: ARSession, didUpdate frame: ARFrame) {
    guard running else { return }
    let normal: Bool
    switch frame.camera.trackingState {
    case .normal:
      normal = true
      status("normal", "Tracking ready")
    case .limited(let reason):
      normal = false
      status("limited", "Tracking limited (\(reason)). Stop and look around slowly.")
    case .notAvailable:
      normal = false
      status("unavailable", "Tracking unavailable. Return to the start and align again.")
    }
    guard normal else {
      trackingReady = false
      marker.isHidden = true
      return
    }
    trackingReady = true
    guard frame.timestamp - lastFrame >= 0.1 else { return }
    lastFrame = frame.timestamp
    let t = frame.camera.transform
    let matrix: [Double] = (0..<4).flatMap { column in
      (0..<4).map { row in Double(t[column][row]) }
    }
    onPose(["transform": matrix, "timestamp": frame.timestamp])
    // Only live tracked image observations can unlock JS alignment. An old world
    // anchor remaining in the session after the image leaves view is insufficient.
    if let image = frame.anchors.compactMap({ $0 as? ARImageAnchor }).first(where: {
      $0.isTracked && $0.referenceImage.name == "home-start-v1"
    }) {
      let imageMatrix: [Double] = (0..<4).flatMap { column in
        (0..<4).map { row in Double(image.transform[column][row]) }
      }
      onMarker(["name": "home-start-v1", "transform": imageMatrix, "timestamp": frame.timestamp])
    }
  }

  func sessionWasInterrupted(_ session: ARSession) {
    trackingReady = false
    marker.isHidden = true
    status("interrupted", "AR session interrupted. Return to the start and align again.")
  }

  func sessionInterruptionEnded(_ session: ARSession) {
    pause()
    startIfNeeded()
  }

  func session(_ session: ARSession, didFailWithError error: Error) {
    pause()
    status("unavailable", error.localizedDescription)
  }
}
