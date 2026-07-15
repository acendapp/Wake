import { describe, expect, it } from 'vitest'
import {
  CLIPS_PER_VOICE,
  clipsForVoice,
  DEFAULT_VOICE,
  isKnownVoice,
  isValidTime,
  soundForDate,
  VOICES,
} from './alarmCore'

describe('VOICES catalog', () => {
  it('offers both male and female voices, led by the default', () => {
    expect(VOICES.some((v) => v.gender === 'male')).toBe(true)
    expect(VOICES.some((v) => v.gender === 'female')).toBe(true)
    expect(VOICES[0].id).toBe(DEFAULT_VOICE) // Maria (the real, recorded voice) leads
  })

  it('has unique ids and a valid default', () => {
    expect(new Set(VOICES.map((v) => v.id)).size).toBe(VOICES.length)
    expect(isKnownVoice(DEFAULT_VOICE)).toBe(true)
  })

  it('recognizes known vs unknown voices', () => {
    expect(isKnownVoice('aurora')).toBe(true)
    expect(isKnownVoice('nope')).toBe(false)
    expect(isKnownVoice(null)).toBe(false)
  })
})

describe('clipsForVoice', () => {
  it('names files per voice with padded indices', () => {
    expect(clipsForVoice('maria')).toEqual(['maria-01.caf', 'maria-02.caf'])
    expect(clipsForVoice('theo')).toHaveLength(CLIPS_PER_VOICE)
  })
})

describe('soundForDate', () => {
  it('returns a clip belonging to the chosen voice', () => {
    expect(clipsForVoice('theo')).toContain(soundForDate(new Date(2026, 5, 14), 'theo'))
  })

  it('rotates one clip per calendar day, wrapping cleanly', () => {
    const base = new Date(2026, 5, 14)
    const seq = Array.from({ length: CLIPS_PER_VOICE }, (_, i) =>
      soundForDate(new Date(2026, 5, 14 + i), 'aurora'),
    )
    expect(new Set(seq).size).toBe(CLIPS_PER_VOICE)
    expect(soundForDate(new Date(2026, 5, 14 + CLIPS_PER_VOICE), 'aurora')).toBe(
      soundForDate(base, 'aurora'),
    )
  })

  it('is deterministic for the same date + voice', () => {
    const d1 = new Date(2026, 0, 1, 6, 30)
    const d2 = new Date(2026, 0, 1, 23, 59)
    expect(soundForDate(d1, 'nova')).toBe(soundForDate(d2, 'nova'))
  })
})

describe('isValidTime', () => {
  it('accepts valid 24h HH:MM', () => {
    for (const t of ['00:00', '06:30', '09:05', '13:45', '23:59']) {
      expect(isValidTime(t)).toBe(true)
    }
  })

  it('rejects malformed or out-of-range times', () => {
    for (const t of ['24:00', '6:30', '06:60', '0630', '06:5', 'morning', '']) {
      expect(isValidTime(t)).toBe(false)
    }
  })
})
