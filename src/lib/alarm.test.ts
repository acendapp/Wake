import { describe, expect, it } from 'vitest'
import { isValidTime, soundForDate, WAKE_CLIPS } from './alarmCore'

describe('soundForDate', () => {
  it('returns a clip from the library', () => {
    expect(WAKE_CLIPS).toContain(soundForDate(new Date(2026, 5, 14)))
  })

  it('rotates one clip per calendar day, in order', () => {
    const base = new Date(2026, 5, 14) // a fixed local day
    const seq = Array.from({ length: WAKE_CLIPS.length }, (_, i) =>
      soundForDate(new Date(2026, 5, 14 + i)),
    )
    // Consecutive days never repeat until the library wraps.
    expect(new Set(seq).size).toBe(WAKE_CLIPS.length)
    // And it wraps cleanly back to the first clip.
    expect(soundForDate(new Date(2026, 5, 14 + WAKE_CLIPS.length))).toBe(soundForDate(base))
  })

  it('is deterministic for the same date (re-arm picks the same clip)', () => {
    const d1 = new Date(2026, 0, 1, 6, 30)
    const d2 = new Date(2026, 0, 1, 23, 59)
    expect(soundForDate(d1)).toBe(soundForDate(d2))
  })

  it('handles a custom clip list and an empty list', () => {
    expect(soundForDate(new Date(2026, 5, 14), ['a', 'b'])).toMatch(/^[ab]$/)
    expect(soundForDate(new Date(2026, 5, 14), [])).toBe('')
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
