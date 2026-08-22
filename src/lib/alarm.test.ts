import { describe, expect, it } from 'vitest'
import {
  CLIPS_PER_VOICE,
  clipsForVoice,
  dateToTime,
  DEFAULT_VOICE,
  DEFAULT_WAKE_TIME,
  isKnownVoice,
  isValidTime,
  soundForDate,
  timeToDate,
  VOICES,
} from './alarmCore'

describe('VOICES catalog', () => {
  it('is non-empty, led by the default, with a name on every voice', () => {
    expect(VOICES.length).toBeGreaterThan(0)
    expect(VOICES[0].id).toBe(DEFAULT_VOICE) // Maria (the real, recorded voice) leads
    expect(VOICES.every((v) => v.name.length > 0)).toBe(true)
  })

  it('has unique ids and a valid default', () => {
    expect(new Set(VOICES.map((v) => v.id)).size).toBe(VOICES.length)
    expect(isKnownVoice(DEFAULT_VOICE)).toBe(true)
  })

  it('recognizes known vs unknown voices', () => {
    expect(isKnownVoice('maria')).toBe(true)
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

// The wheel ↔ "HH:MM" bridge. The wake time is the heart of the app, so this is
// exhaustive: every minute of the day must survive the round trip untouched.
describe('timeToDate / dateToTime', () => {
  it('round-trips every minute of the day exactly', () => {
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m++) {
        const hhmm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        expect(dateToTime(timeToDate(hhmm))).toBe(hhmm)
      }
    }
  })

  it('produces a stored-shape string the DB CHECK constraint accepts', () => {
    for (const hhmm of ['00:00', '00:01', '09:05', '12:00', '23:59']) {
      expect(isValidTime(dateToTime(timeToDate(hhmm)))).toBe(true)
    }
  })

  it('pads single-digit hours and minutes', () => {
    expect(dateToTime(new Date(2000, 0, 15, 7, 5))).toBe('07:05')
    expect(dateToTime(new Date(2000, 0, 15, 0, 0))).toBe('00:00')
  })

  it('keeps midnight and noon in 24-hour form', () => {
    expect(dateToTime(timeToDate('00:00'))).toBe('00:00') // 12:00 AM
    expect(dateToTime(timeToDate('12:00'))).toBe('12:00') // 12:00 PM
  })

  it('zeroes seconds and milliseconds so the wheel never drifts', () => {
    const d = timeToDate('06:30')
    expect(d.getSeconds()).toBe(0)
    expect(d.getMilliseconds()).toBe(0)
  })

  it('falls back to the default for malformed or empty input', () => {
    for (const bad of ['', '7:00', '25:00', '06:60', 'morning', '07:00:00']) {
      expect(dateToTime(timeToDate(bad))).toBe(DEFAULT_WAKE_TIME)
    }
  })

  it('builds on a fixed, transition-free day rather than today', () => {
    const d = timeToDate('02:30')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2000, 0, 15])
    expect(dateToTime(d)).toBe('02:30') // the hour DST would skip survives
  })
})
