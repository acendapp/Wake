// Static require map of one preview clip per voice, so Metro bundles them and the
// Settings voice picker can play a sample. (The native AlarmKit alarm references
// clips by bundled filename, not these — this is only for in-app preview.)
//
// require() is used (not import) because there's no TS module declaration for
// .caf assets; matches how the app already requires image assets.
export const VOICE_PREVIEW_CLIP: Record<string, number> = {
  theo: require('../../assets/audio/theo-01.caf'),
  atlas: require('../../assets/audio/atlas-01.caf'),
  julian: require('../../assets/audio/julian-01.caf'),
  aurora: require('../../assets/audio/aurora-01.caf'),
  sage: require('../../assets/audio/sage-01.caf'),
  nova: require('../../assets/audio/nova-01.caf'),
}
