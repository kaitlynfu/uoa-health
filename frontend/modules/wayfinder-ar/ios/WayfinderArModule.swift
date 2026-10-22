import ARKit
import AVFoundation
import ExpoModulesCore
import SceneKit
import CryptoKit

public class WayfinderArModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WayfinderAr")
    Function("isSupported") { ARWorldTrackingConfiguration.isSupported }
    Function("markerAlignmentVersion") { 1 }
    Function("environmentVersion") { 1 }
    Function("campusEnvironmentVersion") { 1 }
    Function("readCampusDraft") { (key: String) -> String? in
      UserDefaults.standard.string(forKey: "campus-draft-" + key)
    }
    Function("writeCampusDraft") { (key: String, value: String) throws in
      guard key.count <= 100, value.utf8.count < 500_000 else { throw HomeEnvironmentStore.failure("Draft too large.") }
      UserDefaults.standard.set(value, forKey: "campus-draft-" + key)
    }
    AsyncFunction("exportCampusEnvironment") { (key: String) throws -> String in
      guard key.hasPrefix("campus-") else { throw HomeEnvironmentStore.failure("Campus recording required.") }
      let data = try Data(contentsOf: HomeEnvironmentStore.url(key))
      guard data.count <= 12_000_000 else { throw HomeEnvironmentStore.failure("Recording too large.") }
      return data.base64EncodedString()
    }
    AsyncFunction("importCampusEnvironment") { (key: String, encoded: String, digest: String, binding: String) throws in
      guard key.hasPrefix("campus-"), encoded.utf8.count <= 16_000_000,
        let data = Data(base64Encoded: encoded), data.count <= 12_000_000,
        SHA256.hash(data: data).map({ String(format: "%02x", $0) }).joined() == digest else {
        throw HomeEnvironmentStore.failure("Campus recording checksum failed.")
      }
      let archive = try PropertyListDecoder().decode(HomeEnvironmentArchive.self, from: data)
      guard archive.version == 1, let expectedData = binding.data(using: .utf8),
        let actualData = archive.routes.data(using: .utf8),
        let expected = try JSONSerialization.jsonObject(with: expectedData) as? NSDictionary,
        let actual = try JSONSerialization.jsonObject(with: actualData) as? NSDictionary,
        actual.isEqual(expected) else { throw HomeEnvironmentStore.failure("Recording belongs to another route or floor.") }
      _ = try HomeEnvironmentStore.map(archive)
      try data.write(to: HomeEnvironmentStore.url(key), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
    Function("readEnvironmentRoutes") { () throws -> String? in
      try HomeEnvironmentStore.load()?.routes
    }
    Function("routeEditorAvailable") { () -> Bool in
      return true
    }
    Function("readHomeRoutes") { () -> String? in
      UserDefaults.standard.string(forKey: "home-routes-marker-v1")
    }
    Function("writeHomeRoutes") { (value: String) throws in
      guard value.utf8.count <= 200_000,
        let data = value.data(using: .utf8),
        let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
        object["version"] as? Int == 1, object["marker"] as? String == "home-start-v1",
        object["routes"] is [String: Any] else {
        throw NSError(domain: "WayfinderRouteEditor", code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Invalid route data."])
      }
      UserDefaults.standard.set(value, forKey: "home-routes-marker-v1")
    }
    View(WayfinderArView.self) {
      Events("onPose", "onStatus", "onMarker", "onMapping", "onEnvironment")
      Prop("recordingEnabled") { (view: WayfinderArView, enabled: Bool) in view.recordingEnabled = enabled }
      Prop("environmentKey") { (view: WayfinderArView, key: String) in view.setEnvironmentKey(key) }
      Prop("localizationMode") { (view: WayfinderArView, mode: String) in view.setMode(mode) }
      Prop("saveEnvironmentRequest") { (view: WayfinderArView, request: String) in view.saveEnvironment(request) }
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
  let onMapping = EventDispatcher()
  let onEnvironment = EventDispatcher()
  var recordingEnabled = false
  private var environmentKey = "home"
  private var mode = "marker"
  private var generation = 0
  private var lastSaveRequest = ""
  private var saving = false
  private var worldNormalSince: TimeInterval?
  private var recognitionStarted: TimeInterval?
  private var expectedOrigin: UUID?
  private var worldLocated = false
  private var sessionIdentifier = UUID().uuidString
  private var restoredRoutes = ""
  private var lastLocatedEmission: TimeInterval = 0
  private var lastMapping = ""
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
    generation += 1
    worldNormalSince = nil
    worldLocated = false
    sceneView.session.pause()
    marker.isHidden = true
    running = false
    trackingReady = false
  }

  func setMode(_ value: String) {
    let next = value == "world" ? "world" : "marker"
    guard next != mode else { return }
    mode = next; pause(); startIfNeeded()
  }

  func setEnvironmentKey(_ key: String) {
    guard key != environmentKey else { return }
    environmentKey = key
    pause()
    startIfNeeded()
  }

  func saveEnvironment(_ request: String) {
    guard !request.isEmpty, request != lastSaveRequest else { return }
    lastSaveRequest = request
    var requestID = ""
    do {
      guard request.utf8.count < 250_000, let data = request.data(using: .utf8),
        let payload = try JSONSerialization.jsonObject(with: data) as? [String: Any],
        let id = payload["id"] as? String, let routes = payload["routes"] as? String,
        let a = payload["alignment"] as? [Double], a.count == 5, a.allSatisfy({ $0.isFinite }),
        abs(hypot(a[3], a[4]) - 1) < 0.01 else { throw HomeEnvironmentStore.failure("Invalid save request.") }
      requestID = id
      guard recordingEnabled else { throw HomeEnvironmentStore.failure("Sign in with an authorised editor account to record.") }
      guard !saving, running, trackingReady, let frame = sceneView.session.currentFrame,
        frame.worldMappingStatus == .mapped, mode != "world" || worldLocated else {
        throw HomeEnvironmentStore.failure("Keep walking and looking around until mapping is Ready to save.")
      }
      // Ensure route JSON is structurally valid before including it in the archive.
      guard let routeData = routes.data(using: .utf8),
        let object = try JSONSerialization.jsonObject(with: routeData) as? [String: Any],
        object["version"] as? Int == 1 else { throw HomeEnvironmentStore.failure("Invalid route snapshot.") }
      let storageKey = payload["storageKey"] as? String ?? environmentKey
      if environmentKey == "home" {
        guard storageKey == "home" else { throw HomeEnvironmentStore.failure("Home recordings stay private.") }
        guard object["marker"] as? String == "home-start-v1", object["routes"] is [String: Any] else {
          throw HomeEnvironmentStore.failure("Invalid home route snapshot.")
        }
      } else {
        guard environmentKey.hasPrefix("campus-"), storageKey.hasPrefix("campus-"), object["building"] as? String == "303",
          object["frame_id"] as? String == storageKey, object["points"] is [[String: Any]],
          ["G", "1"].contains(object["floor"] as? String ?? "") else {
          throw HomeEnvironmentStore.failure("Invalid campus route snapshot.")
        }
      }
      let token = generation
      saving = true
      sceneView.session.getCurrentWorldMap { [weak self] map, error in
        DispatchQueue.main.async {
          guard let self = self else { return }
          do {
            guard token == self.generation, self.running, self.trackingReady, self.recordingEnabled,
              self.sceneView.session.currentFrame?.worldMappingStatus == .mapped else {
              throw HomeEnvironmentStore.failure("Tracking changed during save. Nothing was replaced; try again after locating.")
            }
            if let error = error { throw error }
            guard let map = map else { throw HomeEnvironmentStore.failure("No world map returned.") }
            var transform = matrix_identity_float4x4
            transform.columns.0 = SIMD4<Float>(Float(-a[4]), 0, Float(a[3]), 0)
            transform.columns.2 = SIMD4<Float>(Float(-a[3]), 0, Float(-a[4]), 0)
            transform.columns.3 = SIMD4<Float>(Float(a[0]), Float(a[2]), Float(a[1]), 1)
            // Store the calibrated route origin, not the camera's current location.
            map.anchors.removeAll { $0.name == HomeEnvironmentStore.originName || $0 is ARImageAnchor }
            map.anchors.append(ARAnchor(name: HomeEnvironmentStore.originName, transform: transform))
            // Capture is complete and checked. Archive/write away from the AR queue.
            DispatchQueue.global(qos: .utility).async {
              do {
                try HomeEnvironmentStore.save(map, routes: routes, key: storageKey)
                DispatchQueue.main.async {
                  self.saving = false
                  self.onEnvironment(["kind": "saved", "requestID": id,
                    "message": "Environment and route snapshot saved on this phone."])
                }
              } catch {
                DispatchQueue.main.async {
                  self.saving = false
                  self.onEnvironment(["kind": "error", "requestID": id, "message": error.localizedDescription])
                }
              }
            }
          } catch {
            self.saving = false
            self.onEnvironment(["kind": "error", "requestID": id, "message": error.localizedDescription])
          }
        }
      }
    } catch { onEnvironment(["kind": "error", "requestID": requestID, "message": error.localizedDescription]) }
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
    expectedOrigin = nil
    if mode == "world" {
      do {
        guard let archive = try HomeEnvironmentStore.load(environmentKey) else { throw HomeEnvironmentStore.failure("No saved environment. Use editor setup or download a publication first.") }
        let map = try HomeEnvironmentStore.map(archive)
        restoredRoutes = archive.routes
        expectedOrigin = map.anchors.first(where: { $0.name == HomeEnvironmentStore.originName })?.identifier
        configuration.initialWorldMap = map
        // Deliberately no image detection: moved paper cannot redefine this session.
      } catch { status("unavailable", error.localizedDescription); return }
    } else {
      guard let referenceImage = referenceImage else { prepareReference(); return }
      configuration.detectionImages = [referenceImage]
      configuration.maximumNumberOfTrackedImages = 1
      configuration.automaticImageScaleEstimationEnabled = false
    }
    worldNormalSince = nil
    worldLocated = false
    recognitionStarted = nil
    lastMapping = ""
    sessionIdentifier = UUID().uuidString
    lastLocatedEmission = 0
    lastFrame = 0
    running = true
    marker.isHidden = true
    status("initializing", mode == "world" ? "Look around the previously recorded room. Arrows wait for recognition." : "Look around slowly, then scan the fixed HOME START floor marker.")
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
    guard values.count == 4, values.allSatisfy({ $0.isFinite }), running, trackingReady,
      mode != "world" || worldLocated else {
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
    if recognitionStarted == nil { recognitionStarted = frame.timestamp }
    let mapping = frame.worldMappingStatus == .mapped ? "mapped" : frame.worldMappingStatus == .extending ? "extending" : "limited"
    if mapping != lastMapping {
      lastMapping = mapping
      onMapping(["state": mapping])
    }
    if mode == "world", let started = recognitionStarted, frame.timestamp - started > 45, !worldLocated {
      pause()
      status("unavailable", "Room not recognised. End and retry in a recorded area, or choose marker setup. No guessed arrows are shown.")
      return
    }
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
      if worldLocated { recognitionStarted = frame.timestamp }
      worldLocated = false
      worldNormalSince = nil
      trackingReady = false
      marker.isHidden = true
      return
    }
    if worldNormalSince == nil { worldNormalSince = frame.timestamp }
    trackingReady = true
    guard frame.timestamp - lastFrame >= 0.1 else { return }
    lastFrame = frame.timestamp
    let t = frame.camera.transform
    let matrix: [Double] = (0..<4).flatMap { column in
      (0..<4).map { row in Double(t[column][row]) }
    }
    onPose(["transform": matrix, "timestamp": frame.timestamp])
    if mode == "world" {
      if let since = worldNormalSince, frame.timestamp-since >= 1,
        let origin = frame.anchors.first(where: { $0.identifier == expectedOrigin && $0.name == HomeEnvironmentStore.originName }) {
        let t = origin.transform
        let horizontal = hypot(t.columns.2.x, t.columns.2.z)
        if horizontal > 0.9 {
          worldLocated = true
          if frame.timestamp-lastLocatedEmission >= 0.5 {
            lastLocatedEmission = frame.timestamp
            // Routes come from the exact archive used by THIS AR session, even if
            // another completed capture has since replaced the file on disk.
            onEnvironment(["kind": "located", "timestamp": frame.timestamp,
              "sessionID": sessionIdentifier, "routes": restoredRoutes,
              "alignment": [Double(t.columns.3.x), Double(t.columns.3.z), Double(t.columns.3.y),
                Double(-t.columns.2.x/horizontal), Double(-t.columns.2.z/horizontal)]])
          }
        }
      }
      return
    }
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
    pause()
    status("interrupted", "AR session interrupted. Return to the start and align again.")
  }

  func sessionShouldAttemptRelocalization(_ session: ARSession) -> Bool { mode == "world" }

  func sessionInterruptionEnded(_ session: ARSession) {
    pause()
    startIfNeeded()
  }

  func session(_ session: ARSession, didFailWithError error: Error) {
    pause()
    status("unavailable", error.localizedDescription)
  }
}
