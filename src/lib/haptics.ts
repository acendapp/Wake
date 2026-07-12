// Thin wrapper around expo-haptics so the rest of the app can add tactile feedback
// without repeating platform/error guards. Every call is fire-and-forget and
// degrades to a no-op where haptics aren't available (web, older devices, errors).
import * as Haptics from 'expo-haptics'

/** Light tick for discrete selection changes — scale taps, chips, pills, tiers. */
export function hapticSelect() {
  Haptics.selectionAsync().catch(() => {})
}

/** Firmer tap for primary commits — START, submit a check-in, confirm a purchase. */
export function hapticImpact(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium,
) {
  Haptics.impactAsync(style).catch(() => {})
}

/** Success cue for earned moments — finishing the focal point, a streak milestone. */
export function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
}
