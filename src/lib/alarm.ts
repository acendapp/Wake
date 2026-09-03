import { Platform } from 'react-native'

import {
  DEFAULT_VOICE,
  isKnownVoice,
  isValidTime,
  soundForDate,
  VOICES,
  type Voice,
  type WakeAlarm,
} from './alarmCore'

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

export {
  DEFAULT_VOICE,
  isKnownVoice,
  isValidTime,
  soundForDate,
  VOICES,
  type Voice,
  type WakeAlarm,
}

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

/** The bundled sound file for today's clip — passed to AlarmKit's
 *  AlertSound.named(). It needs the filename WITH extension (e.g. "maria-01.caf");
 *  without it, iOS can't resolve the file in the app bundle and silently falls
 *  back to the default alarm sound. (The module's README says "without extension"
 *  — that's wrong for .caf resources.) */
function soundNameForToday(voiceId: string): string {
  return soundForDate(new Date(), voiceId)
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
 * What an arm/cancel call actually did. The one the UI must act on is 'denied':
 * the preference is saved and the toggle reads "on", but iOS refused AlarmKit
 * permission, so NOTHING will ring. iOS asks exactly once — after a "Don't Allow"
 * every later request returns denied instantly, without a prompt — so the only
 * way back is the user flipping it on in Settings, and they can't know to do
 * that unless we tell them.
 */
export type AlarmApplyResult = 'armed' | 'cancelled' | 'unavailable' | 'denied'

/**
 * Arm (or re-arm) the daily wake alarm for `time` ("HH:MM") with today's rotating
 * clip. 'unavailable' on Tier 0 — the preference is already persisted, so a later
 * dev build picks it up. The root gate is the arming authority (entitled users
 * only — see _layout.tsx); the settings save and the evening reflection re-apply
 * from behind the paywall. Re-arming on launch advances the clip rotation,
 * since a repeating alarm otherwise keeps the soundName it was scheduled with.
 */
export async function scheduleWakeAlarm(time: string, voiceId: string): Promise<AlarmApplyResult> {
  if (!isValidTime(time)) return 'unavailable'
  const kit = getAlarmKit()
  if (!isAlarmAvailable() || !kit) return 'unavailable'

  // The native calls can THROW (not just resolve false) — an uncaught rejection
  // here used to escape applyWakeAlarm entirely, and because stopAllAlarms runs
  // before scheduleRelativeAlarm, a schedule failure could destroy the existing
  // alarm without replacing it and no caller would ever know.
  try {
    const granted = await kit.requestAlarmPermission()
    if (!granted) return 'denied'

    const voice = isKnownVoice(voiceId) ? voiceId : DEFAULT_VOICE
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
      soundNameForToday(voice),
    )
    return 'armed'
  } catch (e) {
    if (__DEV__) console.warn('[alarm] scheduleWakeAlarm failed', e)
    return 'unavailable'
  }
}

/** Cancel any armed wake alarm. No-op on Tier 0; never throws. */
export async function cancelWakeAlarm(): Promise<void> {
  const kit = getAlarmKit()
  if (!isAlarmAvailable() || !kit) return
  try {
    await kit.stopAllAlarms()
  } catch (e) {
    if (__DEV__) console.warn('[alarm] cancelWakeAlarm failed', e)
  }
}

/**
 * Apply a preference: arm when enabled with a valid time, otherwise cancel.
 * The single entry point UI calls after writing the profile. Callers that can
 * show UI should check for 'denied' (see AlarmApplyResult); best-effort callers
 * (onboarding, the evening reflection, launch) may ignore the result.
 */
export async function applyWakeAlarm(pref: WakeAlarm): Promise<AlarmApplyResult> {
  if (pref.enabled && pref.time && isValidTime(pref.time)) {
    return scheduleWakeAlarm(pref.time, pref.voice)
  }
  await cancelWakeAlarm()
  return 'cancelled'
}
