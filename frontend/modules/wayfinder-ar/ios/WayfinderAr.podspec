Pod::Spec.new do |s|
  s.name = 'WayfinderAr'
  s.version = '0.1.0'
  s.summary = 'Local camera pose and waypoint rendering for indoor navigation'
  s.description = s.summary
  s.author = 'CS399 Team 43'
  s.homepage = 'https://github.com/uoa-compsci399-s2-2026-jun/team-43-project'
  s.license = { :type => 'Proprietary' }
  s.platforms = { :ios => '15.0' }
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'ARKit', 'SceneKit', 'AVFoundation'
  s.swift_version = '5.9'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
