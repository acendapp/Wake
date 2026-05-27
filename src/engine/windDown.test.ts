import { describe, expect, it } from 'vitest'
import { EVENING_LIBRARY } from './eveningLibrary'
import { windDownSequence } from './windDown'

describe('windDownSequence', () => {
  it('grows the wind-down as tomorrow gets harder', () => {
    expect(windDownSequence(2)).toHaveLength(3)
    expect(windDownSequence(6)).toHaveLength(4)
    expect(windDownSequence(9)).toHaveLength(5)
  })

  it('orders steps by priority, highest first', () => {
    const steps = windDownSequence(10)
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i - 1].priority).toBeGreaterThanOrEqual(steps[i].priority)
    }
  })

  it('always leads with the top-priority move', () => {
    expect(windDownSequence(1)[0].slug).toBe('screens-down')
  })

  it('only returns moves from the evening library', () => {
    const slugs = new Set(EVENING_LIBRARY.map((s) => s.slug))
    for (const step of windDownSequence(7)) {
      expect(slugs.has(step.slug)).toBe(true)
    }
  })

  it('clamps out-of-range demand', () => {
    expect(windDownSequence(99)).toHaveLength(5)
    expect(windDownSequence(-4)).toHaveLength(3)
  })

  it('is deterministic', () => {
    expect(windDownSequence(8)).toEqual(windDownSequence(8))
  })
})
