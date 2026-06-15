// Pure core of the wake-alarm service — no React Native imports, so it's
// unit-tested in isolation (vitest runs in plain Node). The platform/native tier
// lives in alarm.ts, which re-exports everything here.

/** A user's wake-alarm preference. `time` is local wall-clock "HH:MM" (24h). */
export type WakeAlarm = { enabled: boolean; time: string | null }

// ── Rotating clip library ────────────────────────────────────────────────────
//
// A different spoken good-morning each day. The recorded files are bundled under
// assets/audio/ and registered here; the native tier passes `soundForDate(today)`
// as AlarmKit's soundName.
//
// NOTE: these filenames are the recording target — the clips don't exist yet.
// Record 15–20s .caf/.wav/.aiff (AlarmKit caps custom sounds at 30s) and drop
// them in; keep this list in sync. See docs/voice-clips.md for the spec.
export const WAKE_CLIPS = [
  'wake-01.caf',
  'wake-02.caf',
  'wake-03.caf',
  'wake-04.caf',
  'wake-05.caf',
] as const

/** Whole-days-since-epoch for a date, in the device's local zone. */
function dayNumber(d: Date): number {
  return Math.floor(
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000,
  )
}

/**
 * The clip to play for `date`, rotating one per calendar day so consecutive
 * mornings never repeat (until the library wraps). Deterministic — same date in,
 * same clip out — so a re-arm on launch picks the same clip as the schedule.
 */
export function soundForDate(date: Date, clips: readonly string[] = WAKE_CLIPS): string {
  if (clips.length === 0) return ''
  const idx = ((dayNumber(date) % clips.length) + clips.length) % clips.length
  return clips[idx]
}

/** "HH:MM" 24-hour validity (matches the DB CHECK constraint in 0009). */
export function isValidTime(time: string): boolean {
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)
}
