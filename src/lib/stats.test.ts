import { describe, expect, it } from 'vitest'
import {
  computeTodayInsight,
  computeYouStats,
  milestoneReached,
  type StatsDay,
} from './stats'

describe('milestoneReached', () => {
  it('returns null below the first milestone', () => {
    expect(milestoneReached(0)).toBeNull()
  })

  it('fires exactly on a milestone value', () => {
    expect(milestoneReached(3)).toBe(3)
    expect(milestoneReached(7)).toBe(7)
    expect(milestoneReached(30)).toBe(30)
  })

  it('returns the highest milestone reached, not exact-match only', () => {
    // A user who didn't open on the exact day still gets the last milestone.
    expect(milestoneReached(6)).toBe(5)
    expect(milestoneReached(13)).toBe(10)
    expect(milestoneReached(29)).toBe(21)
    expect(milestoneReached(1000)).toBe(365)
  })
})

// Build a StatsDay with sensible defaults; override what a test cares about.
function mk(date: string, o: Partial<StatsDay> = {}): StatsDay {
  return {
    local_date: date,
    morning_completed_at: o.morning_completed_at ?? null,
    evening_completed_at: o.evening_completed_at ?? null,
    woke_at: o.woke_at ?? null,
    state: o.state ?? null,
    energy: o.energy ?? null,
    mood: o.mood ?? null,
    focus: o.focus ?? null,
    routine_minutes: o.routine_minutes ?? null,
    one_thing_slug: o.one_thing_slug ?? null,
    completed_slugs: o.completed_slugs ?? [],
    plan: o.plan ?? null,
  }
}

// A minimal plan carrying only the moves' slug + estMinutes — all `minutesDone`
// reads. Cast past the full Plan shape, which the stats math never touches.
function planWith(moves: { slug: string; estMinutes: number }[]): StatsDay['plan'] {
  return { sequence: moves } as unknown as StatsDay['plan']
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

  it('keeps a still-alive streak visible before check-in when yesterday was the grace day', () => {
    // Ran 06-01..06-03, missed 06-04 (the one grace day), today (06-05) not logged
    // yet. The run is still alive and must read 3 all morning — not collapse to 0
    // until the check-in re-anchors it.
    const rows = ['2026-06-01', '2026-06-02', '2026-06-03'].map((d) =>
      mk(d, { morning_completed_at: M }),
    )
    const s = computeYouStats(rows, '2026-06-05') // 06-04 missed, 06-05 un-logged
    expect(s.streak.current).toBe(3)
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

  it('forgives a single missed day (one rest day) without counting it', () => {
    // 06-04 is missed; the run either side stays alive as one streak of 5 (the
    // rest day itself does not add to the count).
    const rows = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-05', '2026-06-06'].map((d) =>
      mk(d, { morning_completed_at: M }),
    )
    const s = computeYouStats(rows, '2026-06-06')
    expect(s.streak.current).toBe(5)
    expect(s.streak.best).toBe(5)
  })

  it('only forgives one gap — a second missed day still breaks the run', () => {
    // Gaps at 06-05 and 06-03: only the most-recent gap is bridged, so the run is
    // 06-06 + 06-04 = 2.
    const rows = ['2026-06-01', '2026-06-02', '2026-06-04', '2026-06-06'].map((d) =>
      mk(d, { morning_completed_at: M }),
    )
    const s = computeYouStats(rows, '2026-06-06')
    expect(s.streak.current).toBe(2)
  })

  it('counts a "just wake me" day (woke_at only) toward the streak', () => {
    const rows = [
      mk('2026-06-01', { morning_completed_at: M }),
      mk('2026-06-02', { woke_at: M }), // just woke, no check-in
      mk('2026-06-03', { morning_completed_at: M }),
    ]
    const s = computeYouStats(rows, '2026-06-03')
    expect(s.streak.current).toBe(3)
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

  it('computes a delta line only once there are two full four-morning windows', () => {
    const sparse = computeYouStats(
      ['2026-06-01', '2026-06-02'].map((d) => mk(d, { evening_completed_at: M, energy: 5, mood: 5, focus: 5 })),
      '2026-06-02',
    )
    expect(sparse.trendDelta.energy).toBeNull()

    // 6 points is still a partial prior window → no delta (would be misleading).
    const partial = computeYouStats(
      Array.from({ length: 6 }, (_, i) =>
        mk(`2026-06-${String(i + 1).padStart(2, '0')}`, { evening_completed_at: M, energy: 6, mood: 6, focus: 6 }),
      ),
      '2026-06-06',
    )
    expect(partial.trendDelta.energy).toBeNull()

    // 8 points: prior four avg 4, recent four avg 8 → +100% above.
    const rows = Array.from({ length: 8 }, (_, i) =>
      mk(`2026-06-${String(i + 1).padStart(2, '0')}`, {
        evening_completed_at: M,
        energy: i < 4 ? 4 : 8,
        mood: 5,
        focus: 5,
      }),
    )
    const rich = computeYouStats(rows, '2026-06-08')
    expect(rich.trendDelta.energy).toBe('Energy is running 100% above your previous four mornings.')
  })
})

describe('computeYouStats — portfolio', () => {
  it('credits the estMinutes of the moves actually completed', () => {
    const rows = [
      mk('2026-06-01', {
        morning_completed_at: M,
        one_thing_slug: 'focal',
        completed_slugs: ['focal', 'stretch'],
        plan: planWith([
          { slug: 'focal', estMinutes: 5 },
          { slug: 'stretch', estMinutes: 10 },
          { slug: 'skipped', estMinutes: 30 },
        ]),
      }),
    ]
    const s = computeYouStats(rows, '2026-06-01')
    expect(s.portfolio.morningsBuilt).toBe(1)
    // 5 + 10 done; the skipped 30-min move earns nothing → 15 min, shown as minutes.
    expect(s.portfolio.timeInvested).toBe('15m')
    expect(s.portfolio.followThrough).toBe('100%')
  })

  it('switches to hours once the total passes sixty minutes', () => {
    const move = (m: number) => planWith([{ slug: 'x', estMinutes: m }])
    const rows = [
      mk('2026-06-01', { morning_completed_at: M, one_thing_slug: 'x', completed_slugs: ['x'], plan: move(45) }),
      mk('2026-06-02', { morning_completed_at: M, one_thing_slug: 'x', completed_slugs: ['x'], plan: move(45) }),
    ]
    const s = computeYouStats(rows, '2026-06-02')
    expect(s.portfolio.timeInvested).toBe('1.5h') // 90 min
  })

  it('falls back to the stored routine budget for rows without a plan', () => {
    const rows = [
      mk('2026-06-01', { morning_completed_at: M, routine_minutes: 30, one_thing_slug: 'a', completed_slugs: ['a'] }),
      mk('2026-06-02', { morning_completed_at: M, routine_minutes: 30, one_thing_slug: 'b', completed_slugs: [] }),
    ]
    const s = computeYouStats(rows, '2026-06-02')
    expect(s.portfolio.morningsBuilt).toBe(2)
    expect(s.portfolio.timeInvested).toBe('1.0h') // 60 min, from the budget fallback
    expect(s.portfolio.followThrough).toBe('50%') // 1 of 2 focal points done
  })

  it('shows em dashes / zero when there is nothing to measure', () => {
    const s = computeYouStats([], '2026-06-03')
    expect(s.portfolio.followThrough).toBe('—')
    expect(s.portfolio.strongestDay).toBe('—')
    expect(s.portfolio.timeInvested).toBe('0m')
  })
})

describe('computeYouStats — patterns', () => {
  // Patterns are gated on ≥10 active days (MIN_DAYS_FOR_PATTERNS); rows here set
  // morning_completed_at so each counts as an active day.
  const active = { morning_completed_at: '2026-06-01T08:00:00Z' }

  it('surfaces the focal-point observation only when the data earns it', () => {
    // 10 active days: 5 done @ energy 8, 5 skipped @ energy 5 → +3 lift, both groups ≥3.
    const rows = [
      ...Array(5).fill(0).map((_, i) => mk(`2026-06-0${i + 1}`, { ...active, one_thing_slug: 'a', completed_slugs: ['a'], energy: 8 })),
      ...Array(5).fill(0).map((_, i) => mk(`2026-06-1${i}`, { ...active, one_thing_slug: 'a', completed_slugs: [], energy: 5 })),
    ]
    const s = computeYouStats(rows, '2026-06-30')
    expect(s.patterns).toHaveLength(1)
    expect(s.patterns[0].title).toMatch(/focal point/i)
  })

  it('stays empty when a group is too small', () => {
    const rows = [
      ...Array(2).fill(0).map((_, i) => mk(`2026-06-0${i + 1}`, { ...active, one_thing_slug: 'a', completed_slugs: ['a'], energy: 8 })),
      ...Array(8).fill(0).map((_, i) => mk(`2026-06-1${i}`, { ...active, one_thing_slug: 'a', completed_slugs: [], energy: 5 })),
    ]
    expect(computeYouStats(rows, '2026-06-30').patterns).toHaveLength(0)
  })

  it('stays locked before 10 active days, even when the math would qualify', () => {
    // 4 done + 4 skipped — computePatterns' own thresholds are met, but only 8
    // active days are on record, so the 10-day unlock keeps the box closed.
    const rows = [
      ...Array(4).fill(0).map((_, i) => mk(`2026-06-0${i + 1}`, { ...active, one_thing_slug: 'a', completed_slugs: ['a'], energy: 8 })),
      ...Array(4).fill(0).map((_, i) => mk(`2026-06-1${i}`, { ...active, one_thing_slug: 'a', completed_slugs: [], energy: 5 })),
    ]
    expect(computeYouStats(rows, '2026-06-30').patterns).toHaveLength(0)
  })
})

describe('computeTodayInsight', () => {
  it('returns a line when focal completion clearly tracks higher energy', () => {
    const rows = [
      ...Array(3).fill(0).map((_, i) => mk(`2026-06-0${i + 1}`, { one_thing_slug: 'a', completed_slugs: ['a'], energy: 8 })),
      ...Array(3).fill(0).map((_, i) => mk(`2026-06-1${i}`, { one_thing_slug: 'a', completed_slugs: [], energy: 5 })),
    ]
    expect(computeTodayInsight(rows)).toBe(
      'Days you finish your focal point, your energy runs about 3.0 higher.',
    )
  })

  it('returns null when the data is too thin or the gap is small', () => {
    expect(computeTodayInsight([])).toBeNull()
    const flat = Array(6)
      .fill(0)
      .map((_, i) => mk(`2026-06-0${i + 1}`, { one_thing_slug: 'a', completed_slugs: i < 3 ? ['a'] : [], energy: 6 }))
    expect(computeTodayInsight(flat)).toBeNull() // no lift
  })
})
