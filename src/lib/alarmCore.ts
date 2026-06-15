// Pure core of the wake-alarm service — no React Native imports, so it's
// unit-tested in isolation (vitest runs in plain Node). The platform/native tier
// lives in alarm.ts, which re-exports everything here.

/** A user's wake-alarm preference. `time` is local wall-clock "HH:MM" (24h). */
export type WakeAlarm = { enabled: boolean; time: string | null; voice: string }

// ── Voices ───────────────────────────────────────────────────────────────────
//
// The user picks which voice wakes them. Each voice is a persona with its own set
// of bundled good-morning recordings; the alarm rotates one per day (soundForDate).
// Recorded clips live under assets/audio/ named "<voiceId>-01.caf" … per voice
// (see docs/voice-clips.md). The files don't exist yet — these ids are the
// recording target.

export type VoiceGender = 'male' | 'female'
export interface Voice {
  id: string
  name: string
  gender: VoiceGender
  /** One-line character of the voice, shown in the picker. */
  tagline: string
}

export const VOICES: Voice[] = [
  { id: 'theo', name: 'Theo', gender: 'male', tagline: 'Warm and grounded — the friend who believes in you.' },
  { id: 'atlas', name: 'Atlas', gender: 'male', tagline: 'Strong and motivating — a gentle push to rise.' },
  { id: 'julian', name: 'Julian', gender: 'male', tagline: 'Smooth and unhurried — calm like dawn radio.' },
  { id: 'aurora', name: 'Aurora', gender: 'female', tagline: 'Bright and hopeful — like sunrise in a voice.' },
  { id: 'sage', name: 'Sage', gender: 'female', tagline: 'Soft and soothing — a calm, steady start.' },
  { id: 'nova', name: 'Nova', gender: 'female', tagline: 'Clear and uplifting — energy without the noise.' },
]

/** The voice a new user gets until they choose one. */
export const DEFAULT_VOICE = 'aurora'

/** How many rotating clips each voice provides. */
export const CLIPS_PER_VOICE = 5

export function isKnownVoice(id: string | null | undefined): boolean {
  return !!id && VOICES.some((v) => v.id === id)
}

/** The bundled clip filenames for a voice, e.g. ["aurora-01.caf", …]. */
export function clipsForVoice(voiceId: string): string[] {
  return Array.from(
    { length: CLIPS_PER_VOICE },
    (_, i) => `${voiceId}-${String(i + 1).padStart(2, '0')}.caf`,
  )
}

/** Whole-days-since-epoch for a date, in the device's local zone. */
function dayNumber(d: Date): number {
  return Math.floor(
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000,
  )
}

/**
 * The clip to play for `date` with `voiceId`, rotating one per calendar day so
 * consecutive mornings never repeat (until the voice's library wraps).
 * Deterministic — same date+voice in, same clip out — so a re-arm on launch
 * picks the same clip as the schedule.
 */
export function soundForDate(date: Date, voiceId: string): string {
  const clips = clipsForVoice(voiceId)
  const idx = ((dayNumber(date) % clips.length) + clips.length) % clips.length
  return clips[idx]
}

/** "HH:MM" 24-hour validity (matches the DB CHECK constraint in 0009). */
export function isValidTime(time: string): boolean {
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)
}
