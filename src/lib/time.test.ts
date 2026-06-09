import { describe, expect, it } from 'vitest'
import { DAY_ROLLOVER_HOUR, EVENING_HOUR, isEveningNow, logicalNow } from './time'

// The clock model is foundational — every "today/tomorrow" read and the evening
// gate key off these two functions, and the boundaries (3am rollover, the evening
// window that wraps past midnight) are exactly where this kind of logic regresses.

describe('logicalNow — 3am rollover', () => {
  it('shifts the clock back by the rollover hours', () => {
    const noon = new Date(2026, 5, 7, 12, 0, 0) // Jun 7, 12:00 local
    const shifted = logicalNow(noon)
    expect(noon.getTime() - shifted.getTime()).toBe(DAY_ROLLOVER_HOUR * 60 * 60 * 1000)
  })

  it('keeps a 1am moment on the PREVIOUS calendar day', () => {
    const oneAm = new Date(2026, 5, 7, 1, 0, 0) // Jun 7, 01:00 local
    // Before 3am, "today" is still yesterday's date (Jun 6).
    expect(logicalNow(oneAm).getDate()).toBe(6)
  })

  it('rolls to the new day exactly at the rollover hour', () => {
    const threeAm = new Date(2026, 5, 7, DAY_ROLLOVER_HOUR, 0, 0) // Jun 7, 03:00
    expect(logicalNow(threeAm).getDate()).toBe(7)
  })

  it('keeps a midday moment on the same calendar day', () => {
    const afternoon = new Date(2026, 5, 7, 15, 0, 0)
    expect(logicalNow(afternoon).getDate()).toBe(7)
  })
})

describe('isEveningNow — evening window wraps past midnight', () => {
  it('is true from the evening hour onward', () => {
    expect(isEveningNow(new Date(2026, 5, 7, EVENING_HOUR, 0))).toBe(true)
    expect(isEveningNow(new Date(2026, 5, 7, 22, 0))).toBe(true)
  })

  it('stays true after midnight until the rollover hour', () => {
    expect(isEveningNow(new Date(2026, 5, 7, 0, 30))).toBe(true)
    expect(isEveningNow(new Date(2026, 5, 7, DAY_ROLLOVER_HOUR - 1, 59))).toBe(true)
  })

  it('is false from the rollover hour through the afternoon', () => {
    expect(isEveningNow(new Date(2026, 5, 7, DAY_ROLLOVER_HOUR, 0))).toBe(false)
    expect(isEveningNow(new Date(2026, 5, 7, 12, 0))).toBe(false)
    expect(isEveningNow(new Date(2026, 5, 7, EVENING_HOUR - 1, 59))).toBe(false)
  })
})
