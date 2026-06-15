import { Platform } from 'react-native'

import { isValidTime, soundForDate, WAKE_CLIPS, type WakeAlarm } from './alarmCore'

// Wake's voice-alarm service — TIERED by capability so the rest of the app never
// has to care which tier is live:
//
//   • Tier 1 (iOS 26.1+, dev build): a TRUE Apple AlarmKit alarm that breaks
//     through the silent switch, Do Not Disturb, and Sleep Focus, plays a bundled
//     spoken good-morning, and loops until "slide to stop".
//   • Tier 0 (everywhere else — Expo Go, Android, older iOS): the preference is
//     STORED on the profile (wake_enabled + wake_time) but no native alarm is
//     armed. The UI reads `isAlarmAvailable()` to tell the user the alarm
//     activates in the full app; the stored time is honored once a dev build runs.
//
// The native module is loaded LAZILY via require() so this file is safe to import
// anywhere — if the AlarmKit module isn't in the binary (Expo Go), every entry
// point cleanly degrades to Tier 0 instead of throwing at import time.
//
// The pure, testable bits (clip rotation, time validity) live in alarmCore.ts.

export { isValidTime, soundForDate, WAKE_CLIPS, type WakeAlarm }

type AlarmKit = typeof import('react-native-nitro-ios-alarm-kit')

let cachedKit: AlarmKit | null | undefined
/** The AlarmKit module if present in this binary, else null (cached). */
function getAlarmKit(): AlarmKit | null {
  if (cachedKit === undefined) {
    try {
      // Lazy + guarded on purpose: degrade to Tier 0 when the module isn't in
      // the binary, instead of a hard import that throws at load (e.g. Expo Go).
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cachedKit = require('react-native-nitro-ios-alarm-kit') as AlarmKit
    } catch {
      cachedKit = null // not in this binary (e.g. Expo Go)
    }
  }
  return cachedKit
}

/** True when the OS is at least major.minor (iOS only — Android never gets here). */
function iosAtLeast(major: number, minor: number): boolean {
  const [maj = 0, min = 0] = String(Platform.Version).split('.').map(Number)
  return maj > major || (maj === major && min >= minor)
}

// Wake's alarm presentation — a short title, warm gold tint, and gentle buttons.
const ALARM_TITLE = 'Wake' // keep < 15 chars (Dynamic Island)
const ALARM_TINT = '#8A6D2F' // day.gold
const STOP_BUTTON = { text: "I'm up", textColor: '#FFFFFF', icon: 'sun.max.fill' }
const SNOOZE_BUTTON = { text: 'Snooze', textColor: '#FFFFFF', icon: 'moon.zzz.fill' }
const SNOOZE = { postAlert: 540 } // 9-minute snooze, like the iOS default
const EVERY_DAY = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

/** AlarmKit wants the bundled sound's name WITHOUT extension. */
function soundNameForToday(): string {
  return soundForDate(new Date()).replace(/\.[^.]+$/, '')
}

/**
 * Whether a real system alarm can be armed on THIS build/device. Requires the
 * native module to be present AND iOS 26.1+ — on 26.0 custom sounds play once
 * instead of looping, which is useless as an alarm, so 26.1 is the real floor.
 */
export function isAlarmAvailable(): boolean {
  if (Platform.OS !== 'ios') return false
  const kit = getAlarmKit()
  if (!kit?.isAvailable()) return false
  return iosAtLeast(26, 1)
}

/** Ask for AlarmKit permission. Returns false when the native tier is unavailable. */
export async function requestAlarmPermission(): Promise<boolean> {
  const kit = getAlarmKit()
  if (!isAlarmAvailable() || !kit) return false
  return kit.requestAlarmPermission()
}

/**
 * Arm (or re-arm) the daily wake alarm for `time` ("HH:MM") with today's rotating
 * clip. No-op on Tier 0 — the preference is already persisted, so a later dev
 * build picks it up. Safe to call on every relevant hook (onboarding finish,
 * settings save, app launch). Re-arming on launch advances the clip rotation,
 * since a repeating alarm otherwise keeps the soundName it was scheduled with.
 */
export async function scheduleWakeAlarm(time: string): Promise<void> {
  if (!isValidTime(time)) return
  const kit = getAlarmKit()
  if (!isAlarmAvailable() || !kit) return

  const granted = await kit.requestAlarmPermission()
  if (!granted) return

  const [hour, minute] = time.split(':').map(Number)
  // Wake schedules only this one alarm, so clear before re-arming to avoid dupes.
  await kit.stopAllAlarms()
  await kit.scheduleRelativeAlarm(
    ALARM_TITLE,
    STOP_BUTTON,
    ALARM_TINT,
    hour,
    minute,
    [...EVERY_DAY],
    SNOOZE_BUTTON,
    SNOOZE,
    soundNameForToday(),
  )
}

/** Cancel any armed wake alarm. No-op on Tier 0. */
export async function cancelWakeAlarm(): Promise<void> {
  const kit = getAlarmKit()
  if (!isAlarmAvailable() || !kit) return
  await kit.stopAllAlarms()
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
