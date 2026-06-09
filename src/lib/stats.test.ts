import { describe, expect, it } from 'vitest'
import { computeTodayInsight, computeYouStats, type StatsDay } from './stats'
import type { Plan } from '../engine/types'

// A throwaway plan whose focal slug we control, for follow-through / patterns.
function plan(focalSlug: string): Plan {
  const move = {
    slug: focalSlug,
    title: 'Move',
    example: 'x',
    description: 'y',
    category: 'movement' as const,
    estMinutes: 3,
  }
  return {
    state: 'deficit',
    gap: -2,
    headline: 'h',
    subhead: 's',
    oneThing: move,
    sequence: [move],
    accent: 'amber',
    source: 'deterministic',
  }
}

// Build a StatsDay with sensible defaults; override what a test cares about.
function mk(date: string, o: Partial<StatsDay> = {}): StatsDay {
  return {
    local_date: date,
    morning_completed_at: o.morning_completed_at ?? null,
    evening_completed_at: o.evening_completed_at ?? null,
    state: o.state ?? null,
    energy: o.energy ?? null,
    mood: o.mood ?? null,
    focus: o.focus ?? null,
    routine_minutes: o.routine_minutes ?? null,
    plan: o.plan ?? null,
    completed_slugs: o.completed_slugs ?? [],
  }
}

const M = '2026-06-01T08:00:00Z' // a stamp meaning "this happened"

describe('computeYouStats — streak', () => {
  it('counts a consecutive run ending today', () => {
    const rows = ['2026-06-01', '2026-06-02', '2026-06-03'].map((d) =>
      mk(d, { morning_completed_at: M }),
    )
    const s = computeYouStats(rows, '2026-06-03')
    expect(s.streak.current).toBe(3)
    expect(s.streak.best).toBe(3)
  })

  it("keeps the streak alive if today isn't logged yet but yesterday was", () => {
    const rows = ['2026-06-01', '2026-06-02'].map((d) => mk(d, { evening_completed_at: M }))
    const s = computeYouStats(rows, '2026-06-03') // today not logged
    expect(s.streak.current).toBe(2)
  })

  it('breaks the current streak after a two-day gap, but remembers the best', () => {
    const rows = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-08'].map((d) =>
      mk(d, { morning_completed_at: M }),
    )
    const s = computeYouStats(rows, '2026-06-09') // only the 8th is recent
    expect(s.streak.current).toBe(1)
    expect(s.streak.best).toBe(3)
  })

  it('is zero with no history', () => {
    expect(computeYouStats([], '2026-06-03').streak).toEqual({ current: 0, best: 0 })
  })
})

describe('computeYouStats — week strip', () => {
  it('marks logged days done, future days ahead, and missed days missed', () => {
    // 2026-06-03 is a Wednesday → week is Mon 06-01 … Sun 06-07.
    const rows = [mk('2026-06-01', { morning_completed_at: M }), mk('2026-06-02', { morning_completed_at: M })]
    const s = computeYouStats(rows, '2026-06-03')
    const statuses = s.week.map((d) => d.status)
    expect(statuses[0]).toBe('done') // Mon
    expect(statuses[1]).toBe('done') // Tue
    expect(statuses[2]).toBe('ahead') // Wed (today, not logged)
    expect(statuses[6]).toBe('ahead') // Sun (future)
    expect(s.week).toHaveLength(7)
  })

  it('marks an un-logged past day in the week as missed', () => {
    const rows = [mk('2026-06-01', { morning_completed_at: M })]
    const s = computeYouStats(rows, '2026-06-03')
    expect(s.week[1].status).toBe('missed') // Tue passed with no activity
  })
})

describe('computeYouStats — gap mix', () => {
  it('returns percentages that sum to 100', () => {
    const rows = [
      ...Array(2).fill(0).map((_, i) => mk(`2026-06-0${i + 1}`, { state: 'deficit', morning_completed_at: M })),
      ...Array(5).fill(0).map((_, i) => mk(`2026-06-1${i}`, { state: 'aligned', morning_completed_at: M })),
      ...Array(3).fill(0).map((_, i) => mk(`2026-06-2${i}`, { state: 'surplus', morning_completed_at: M })),
    ]
    const s = computeYouStats(rows, '2026-06-30')
    expect(s.gapMix).not.toBeNull()
    expect(s.gapMix!.reduce((a, b) => a + b.pct, 0)).toBe(100)
    expect(s.gapRead).toContain('matched') // aligned dominates
  })

  it('is null with no check-ins', () => {
    expect(computeYouStats([], '2026-06-03').gapMix).toBeNull()
  })
})

describe('computeYouStats — trend', () => {
  it('builds reflection series and flags hasTrend at ≥2 points', () => {
    const rows = ['2026-06-01', '2026-06-02', '2026-06-03'].map((d, i) =>
      mk(d, { evening_completed_at: M, energy: 5 + i, mood: 6, focus: 4 }),
    )
    const s = computeYouStats(rows, '2026-06-03')
    expect(s.trend.energy).toEqual([5, 6, 7])
    expect(s.hasTrend).toBe(true)
    expect(s.trendLabels[s.trendLabels.length - 1]).toBe('Today')
    expect(s.reflectionCount).toBe(3)
  })

  it('caps the series at 14 of the most recent reflections', () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      mk(`2026-06-${String(i + 1).padStart(2, '0')}`, { evening_completed_at: M, energy: i, mood: 5, focus: 5 }),
    )
    const s = computeYouStats(rows, '2026-06-20')
    expect(s.trend.energy).toHaveLength(14)
    expect(s.trend.energy[0]).toBe(6) // dropped the first 6
  })

  it('computes a delta line only with two full weeks of reflections', () => {
    const sparse = computeYouStats(
      ['2026-06-01', '2026-06-02'].map((d) => mk(d, { evening_completed_at: M, energy: 5, mood: 5, focus: 5 })),
      '2026-06-02',
    )
    expect(sparse.trendDelta.energy).toBeNull()

    // 10 points is still a partial prior week → no delta (would be misleading).
    const partial = computeYouStats(
      Array.from({ length: 10 }, (_, i) =>
        mk(`2026-06-${String(i + 1).padStart(2, '0')}`, { evening_completed_at: M, energy: 6, mood: 6, focus: 6 }),
      ),
      '2026-06-10',
    )
    expect(partial.trendDelta.energy).toBeNull()

    // 14 points: prior week avg 4, recent week avg 8 → +100% above.
    const rows = Array.from({ length: 14 }, (_, i) =>
      mk(`2026-06-${String(i + 1).padStart(2, '0')}`, {
        evening_completed_at: M,
        energy: i < 7 ? 4 : 8,
        mood: 5,
        focus: 5,
      }),
    )
    const rich = computeYouStats(rows, '2026-06-14')
    expect(rich.trendDelta.energy).toBe('Energy is running 100% above your previous seven.')
  })
})

describe('computeYouStats — portfolio', () => {
  it('counts mornings, sums routine minutes to hours, and computes follow-through', () => {
    const rows = [
      mk('2026-06-01', { morning_completed_at: M, routine_minutes: 30, plan: plan('a'), completed_slugs: ['a'] }),
      mk('2026-06-02', { morning_completed_at: M, routine_minutes: 30, plan: plan('b'), completed_slugs: [] }),
    ]
    const s = computeYouStats(rows, '2026-06-02')
    expect(s.portfolio.morningsBuilt).toBe(2)
    expect(s.portfolio.hoursInvested).toBe('1.0h') // 60 min
    expect(s.portfolio.followThrough).toBe('50%') // 1 of 2 focal points done
  })

  it('shows em dashes when there is nothing to measure', () => {
    const s = computeYouStats([], '2026-06-03')
    expect(s.portfolio.followThrough).toBe('—')
    expect(s.portfolio.strongestDay).toBe('—')
    expect(s.portfolio.hoursInvested).toBe('0h')
  })
})

describe('computeYouStats — patterns', () => {
  it('surfaces the focal-point observation only when the data earns it', () => {
    // 3 done @ energy 8, 3 skipped @ energy 5 → +3 lift, both groups ≥3.
    const rows = [
      ...Array(3).fill(0).map((_, i) => mk(`2026-06-0${i + 1}`, { plan: plan('a'), completed_slugs: ['a'], energy: 8 })),
      ...Array(3).fill(0).map((_, i) => mk(`2026-06-1${i}`, { plan: plan('a'), completed_slugs: [], energy: 5 })),
    ]
    const s = computeYouStats(rows, '2026-06-30')
    expect(s.patterns).toHaveLength(1)
    expect(s.patterns[0].title).toMatch(/focal point/i)
  })

  it('stays empty when a group is too small', () => {
    const rows = [
      mk('2026-06-01', { plan: plan('a'), completed_slugs: ['a'], energy: 8 }),
      ...Array(3).fill(0).map((_, i) => mk(`2026-06-1${i}`, { plan: plan('a'), completed_slugs: [], energy: 5 })),
    ]
    expect(computeYouStats(rows, '2026-06-30').patterns).toHaveLength(0)
  })
})

describe('computeTodayInsight', () => {
  it('returns a line when focal completion clearly tracks higher energy', () => {
    const rows = [
      ...Array(3).fill(0).map((_, i) => mk(`2026-06-0${i + 1}`, { plan: plan('a'), completed_slugs: ['a'], energy: 8 })),
      ...Array(3).fill(0).map((_, i) => mk(`2026-06-1${i}`, { plan: plan('a'), completed_slugs: [], energy: 5 })),
    ]
    expect(computeTodayInsight(rows)).toBe(
      'Days you finish your focal point, your energy runs about 3.0 higher.',
    )
  })

  it('returns null when the data is too thin or the gap is small', () => {
    expect(computeTodayInsight([])).toBeNull()
    const flat = Array(6)
      .fill(0)
      .map((_, i) => mk(`2026-06-0${i + 1}`, { plan: plan('a'), completed_slugs: i < 3 ? ['a'] : [], energy: 6 }))
    expect(computeTodayInsight(flat)).toBeNull() // no lift
  })
})
