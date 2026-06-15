// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Bundle .caf audio (the wake-alarm voice clips) as assets so they can be
// require()'d for in-app preview. Metro doesn't treat .caf as an asset by default.
config.resolver.assetExts.push('caf')

module.exports = config
