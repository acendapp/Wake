// Expo config plugin: bundle the wake-alarm voice clips into the iOS app's MAIN
// bundle so AlarmKit can play them by name (AlertSound.named("aurora-01")).
//
// JS-required assets get hashed/renamed and live in the RN asset bundle, which
// AlarmKit can't reach by bare filename — so we copy assets/audio/*.caf into the
// native project during prebuild and register them as Xcode resource files.
//
// Verifiable for free: a simulator build's .app should contain the .caf files at
// its root (no $99 needed to confirm the bundling is correct).

const { withXcodeProject, withDangerousMod, IOSConfig } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

const GROUP = 'WakeAudio'

function listClips(projectRoot) {
  const dir = path.join(projectRoot, 'assets', 'audio')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((f) => f.endsWith('.caf'))
}

// 1. Copy the .caf files into the generated iOS project (ios/WakeAudio/).
function copyClips(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const { projectRoot, platformProjectRoot } = config.modRequest
      const srcDir = path.join(projectRoot, 'assets', 'audio')
      const destDir = path.join(platformProjectRoot, GROUP)
      const clips = listClips(projectRoot)
      if (clips.length) {
        fs.mkdirSync(destDir, { recursive: true })
        for (const f of clips) {
          fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f))
        }
      }
      return config
    },
  ])
}

// 2. Register each copied file as a bundle resource in the Xcode project.
function addClipResources(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults
    for (const f of listClips(config.modRequest.projectRoot)) {
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: `${GROUP}/${f}`,
        groupName: GROUP,
        project,
        isBuildFile: true,
        verbose: false,
      })
    }
    return config
  })
}

module.exports = (config) => addClipResources(copyClips(config))
