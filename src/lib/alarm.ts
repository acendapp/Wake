import { Platform } from 'react-native'

import { isValidTime, soundForDate, WAKE_CLIPS, type WakeAlarm } from './alarmCore'

// Wake's voice-alarm service — TIERED by capability so the rest of the app never
// has to care which tier is live:
//
//   • Tier 1 (iOS 26.1+, dev build): a TRUE Apple AlarmKit alarm that breaks
//     through the silent switch, Do Not Disturb, and Sleep Focus, plays a bundled
//     spoken good-morning, and loops until "slide to stop". Wired in the
//     spike/alarmkit branch (the native module ends Expo Go, so it's not here yet).
//   • Tier 0 (everywhere else, incl. Expo Go today): the preference is STORED on
//     the profile (wake_enabled + wake_time) but no native alarm is armed. The UI
//     reads `isAlarmAvailable()` to tell the user the alarm activates in the full
//     app, and the same stored time is honored once a dev build runs.
//
// The pure, testable bits (clip rotation, time validity) live in alarmCore.ts and
// are re-exported here so callers import everything from `@/lib/alarm`.

export { isValidTime, soundForDate, WAKE_CLIPS, type WakeAlarm }

/**
 * Whether a real system alarm can be armed on THIS build/device. False in Expo
 * Go and anywhere the AlarmKit native module isn't present. The spike replaces
 * the body with `Platform.OS === 'ios' && AlarmKit.isAvailable()` (which also
 * encodes the iOS 26.1 floor — custom sounds only loop from 26.1+).
 */
export function isAlarmAvailable(): boolean {
  // TODO(spike/alarmkit): return Platform.OS === 'ios' && NitroAlarmKit.isAvailable()
  return Platform.OS === 'ios' && false
}

/** Ask for AlarmKit permission. No-op (returns false) until the native tier exists. */
export async function requestAlarmPermission(): Promise<boolean> {
  if (!isAlarmAvailable()) return false
  // TODO(spike/alarmkit): return NitroAlarmKit.requestAlarmPermission()
  return false
}

/**
 * Arm (or re-arm) the daily wake alarm for `time` ("HH:MM"), using the day's
 * rotating clip as the alarm sound. No-op on Tier 0 — the preference is already
 * persisted to the profile, so a later dev build picks it up. Safe to call on
 * every relevant hook (onboarding finish, settings save, app launch).
 */
export async function scheduleWakeAlarm(time: string): Promise<void> {
  if (!isValidTime(time)) return
  if (!isAlarmAvailable()) return
  // TODO(spike/alarmkit): schedule a repeating daily alarm at `time` with
  //   soundName = soundForDate(new Date()); re-arm on launch so the rotation
  //   advances. Use AlarmKit.scheduleRelativeAlarm / scheduleFixedAlarm.
}

/** Cancel any armed wake alarm. No-op on Tier 0. */
export async function cancelWakeAlarm(): Promise<void> {
  if (!isAlarmAvailable()) return
  // TODO(spike/alarmkit): NitroAlarmKit.stopAlarm(WAKE_ALARM_ID)
}

/**
 * Apply a preference: arm when enabled with a valid time, otherwise cancel.
 * The single entry point UI calls after writing the profile.
 */
export async function applyWakeAlarm(pref: WakeAlarm): Promise<void> {
  if (pref.enabled && pref.time && isValidTime(pref.time)) {
    await scheduleWakeAlarm(pref.time)
  } else {
    await cancelWakeAlarm()
  }
}
