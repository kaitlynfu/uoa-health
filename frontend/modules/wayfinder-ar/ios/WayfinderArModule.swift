import ARKit
import AVFoundation
import ExpoModulesCore
import SceneKit

public class WayfinderArModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WayfinderAr")
    Function("isSupported") { ARWorldTrackingConfiguration.isSupported }
    View(WayfinderArView.self) {
      Events("onPose", "onStatus")
      Prop("active") { (view: WayfinderArView, active: Bool) in view.setActive(active) }
      // Empty = hide. Otherwise world x/y/z + yaw radians. The node is never parented to the camera.
      Prop("waypoint") { (view: WayfinderArView, values: [Double]) in view.setWaypoint(values) }
    }
  }
}

final class WayfinderArView: ExpoView, ARSessionDelegate {
  let onPose = EventDispatcher()
  let onStatus = EventDispatcher()
  private let sceneView = ARSCNView(frame: .zero)
  private let marker = SCNNode()
  private var active = false
  private var running = false
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
    let configuration = ARWorldTrackingConfiguration()
    configuration.worldAlignment = .gravity
    // A floating arrow needs only world tracking. Floor locking/occlusion is a later step.
    lastFrame = 0
    running = true
    marker.isHidden = true
    status("initializing", "Look around slowly to establish tracking, then align at the red X.")
    sceneView.session.run(configuration, options: [.resetTracking, .removeExistingAnchors])
  }

  func setWaypoint(_ values: [Double]) {
    guard values.count == 4, values.allSatisfy({ $0.isFinite }), running else {
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
      marker.isHidden = true
      return
    }
    guard frame.timestamp - lastFrame >= 0.1 else { return }
    lastFrame = frame.timestamp
    let t = frame.camera.transform
    let matrix: [Double] = (0..<4).flatMap { column in
      (0..<4).map { row in Double(t[column][row]) }
    }
    onPose(["transform": matrix, "timestamp": frame.timestamp])
  }

  func sessionWasInterrupted(_ session: ARSession) {
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
