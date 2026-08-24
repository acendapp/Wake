import { createElement, forwardRef, type ComponentType } from 'react'

// Cap Dynamic Type scaling app-wide. iOS accessibility text sizes run up to
// ~3.1×, and the editorial layouts (fixed card heights, tight steppers, the
// paywall) spill badly past ~1.3×. Rather than ignoring the user's setting
// (hostile) or reflowing 334 Text elements (a redesign), give every Text and
// TextInput a default maxFontSizeMultiplier — type still grows with the
// system setting, meaningfully, but stops before layouts break. Any element
// can still opt out or set its own cap, since an explicit prop wins over the
// injected default.
//
// HOW: React 19 ignores `Text.defaultProps` (the old one-liner for this), so
// instead the underlying modules' default exports are replaced with a thin
// wrapper. RN's index re-reads these modules through getters on every access,
// so all 24 app files — and libraries — pick the wrapper up. This file must be
// imported before anything renders (see index.ts, the app entry).
//
// KNOWN GAP: Reanimated builds Animated.Text at its own module init, which can
// capture the unwrapped Text first. Only LaunchAnimation's single word and the
// CurationLoader's lines use it — display-only, one line, safe uncapped.

export const FONT_SCALE_CAP = 1.3

function patchDefault(modulePath: string, moduleExports: { default: ComponentType }): void {
  const Real = moduleExports.default as ComponentType<Record<string, unknown>>
  const Wrapped = forwardRef<unknown, Record<string, unknown>>((props, ref) =>
    createElement(Real, { maxFontSizeMultiplier: FONT_SCALE_CAP, ...props, ref }),
  )
  Wrapped.displayName = `FontScaleCapped(${modulePath})`
  moduleExports.default = Wrapped as ComponentType
}

try {
  // Deep paths are internal to react-native — pinned by Expo SDK 54 (RN 0.81),
  // verified to exist there; the guard keeps a future RN bump from crashing at
  // startup (worst case the cap silently stops applying — check on upgrades).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  patchDefault('Text', require('react-native/Libraries/Text/Text'))
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  patchDefault('TextInput', require('react-native/Libraries/Components/TextInput/TextInput'))
} catch (e) {
  if (__DEV__) console.warn('[fontScaleCap] patch failed — Dynamic Type is uncapped', e)
}
