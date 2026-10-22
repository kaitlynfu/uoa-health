import ARKit
import Foundation

// One atomic archive binds route coordinates to the exact world map that locates them.
// Home stays private. Campus archives can be explicitly published by an editor.
// All local copies are excluded from device cloud backups.
struct HomeEnvironmentArchive: Codable {
  let version: Int
  let worldMap: Data
  let routes: String
  let savedAt: String
}

enum HomeEnvironmentStore {
  static let originName = "home-route-origin-v1"
  static func url(_ key: String = "home") throws -> URL {
    guard key == "home" || (key.hasPrefix("campus-") && key.count <= 120 &&
      key.unicodeScalars.allSatisfy({ CharacterSet.alphanumerics.contains($0) || $0 == "-" })) else {
      throw failure("Invalid environment key.")
    }
    let root = try FileManager.default.url(for: .applicationSupportDirectory,
      in: .userDomainMask, appropriateFor: nil, create: true)
    var directory = root.appendingPathComponent("WayfinderEnvironments", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    // Fail before writing private spatial data if backup exclusion cannot be set.
    var values = URLResourceValues(); values.isExcludedFromBackup = true
    try directory.setResourceValues(values)
    return directory.appendingPathComponent(key == "home" ? "home-environment-v1.plist" : key + ".plist")
  }
  static func load(_ key: String = "home") throws -> HomeEnvironmentArchive? {
    let path = try url(key)
    guard FileManager.default.fileExists(atPath: path.path) else { return nil }
    let attributes = try FileManager.default.attributesOfItem(atPath: path.path)
    guard ((attributes[.size] as? NSNumber)?.intValue ?? 0) <= 100_000_000 else {
      throw failure("Saved environment is too large.")
    }
    let archive = try PropertyListDecoder().decode(HomeEnvironmentArchive.self, from: Data(contentsOf: path))
    guard archive.version == 1 else { throw failure("Unsupported environment version.") }
    return archive
  }
  static func map(_ archive: HomeEnvironmentArchive) throws -> ARWorldMap {
    guard let map = try NSKeyedUnarchiver.unarchivedObject(ofClass: ARWorldMap.self, from: archive.worldMap),
      map.anchors.filter({ $0.name == originName }).count == 1 else {
      throw failure("Saved environment has no valid route origin.")
    }
    return map
  }
  static func save(_ map: ARWorldMap, routes: String, key: String = "home") throws {
    let worldData = try NSKeyedArchiver.archivedData(withRootObject: map, requiringSecureCoding: true)
    let archive = HomeEnvironmentArchive(version: 1, worldMap: worldData, routes: routes,
      savedAt: ISO8601DateFormatter().string(from: Date()))
    let encoder = PropertyListEncoder()
    encoder.outputFormat = .binary
    let data = try encoder.encode(archive)
    guard data.count <= (key == "home" ? 100_000_000 : 12_000_000) else { throw failure("Map too large; record a smaller area.") }
    let path = try url(key)
    try data.write(to: path, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
  }
  static func failure(_ message: String) -> NSError {
    NSError(domain: "HomeEnvironment", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }
}

