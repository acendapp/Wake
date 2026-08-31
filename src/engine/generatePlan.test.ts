import { describe, expect, it } from 'vitest'
import { blockedFocalGoals, classifyState, freshnessPenalty, generatePlan } from './generatePlan'

const totalMinutes = (plan: ReturnType<typeof generatePlan>) =>
  plan.sequence.reduce((sum, a) => sum + a.estMinutes, 0)

describe('classifyState', () => {
  it('is deficit whenever you trail the day at all', () => {
    expect(classifyState(7, 8)).toBe('deficit')
    expect(classifyState(6, 8)).toBe('deficit')
    expect(classifyState(3, 9)).toBe('deficit')
  })

  it('is surplus whenever you exceed the day at all', () => {
    expect(classifyState(8, 7)).toBe('surplus')
    expect(classifyState(9, 6)).toBe('surplus')
    expect(classifyState(8, 4)).toBe('surplus')
  })

  it('is aligned only on an exact match', () => {
    expect(classifyState(8, 8)).toBe('aligned')
    expect(classifyState(5, 5)).toBe('aligned')
  })
})

describe('generatePlan', () => {
  it('reports a signed gap', () => {
    expect(generatePlan({ readiness: 6, dayDifficulty: 8 }).gap).toBe(-2)
    expect(generatePlan({ readiness: 9, dayDifficulty: 6 }).gap).toBe(3)
  })

  it('leads with the highest-priority routine goal for the state', () => {
    const deficit = generatePlan({ readiness: 5, dayDifficulty: 8, routineMinutes: 30 })
    expect(deficit.state).toBe('deficit')
    // move-body is the top deficit goal; its largest fitting variant leads.
    expect(deficit.oneThing.title).toBe('Get your body moving')

    const surplus = generatePlan({ readiness: 9, dayDifficulty: 5, routineMinutes: 30 })
    expect(surplus.state).toBe('surplus')
    // prime-body leads surplus; attack-hardest is now day-scope, excluded.
    expect(surplus.oneThing.slug).toBe('prime-body-10')
  })

  it('keeps the One Thing in the sequence, leading unless "get out of bed" is present', () => {
    const plan = generatePlan({ readiness: 5, dayDifficulty: 9, routineMinutes: 20 })
    expect(plan.sequence).toContain(plan.oneThing)
    // sequence[0] is either the One Thing or the chronological "get out of bed".
    const first = plan.sequence[0]
    expect(first === plan.oneThing || first.slug === 'get-up-now-1').toBe(true)
  })

  it('puts "get out of bed" first whenever it is included — nothing comes before it', () => {
    // Deficit with a 20-minute budget packs the 1-minute get-up move.
    const plan = generatePlan({ readiness: 5, dayDifficulty: 9, routineMinutes: 20 })
    const getUp = plan.sequence.find((a) => a.slug === 'get-up-now-1')
    expect(getUp).toBeDefined()
    expect(plan.sequence[0]).toBe(getUp)
    // The Focal Point stays the highest-leverage move, not the chronological first.
    expect(plan.oneThing.title).toBe('Get your body moving')
  })

  it('never exceeds the time budget', () => {
    for (const minutes of [5, 10, 15, 30, 60]) {
      for (const [r, d] of [[5, 8], [8, 8], [9, 5]]) {
        const plan = generatePlan({ readiness: r, dayDifficulty: d, routineMinutes: minutes })
        expect(totalMinutes(plan)).toBeLessThanOrEqual(minutes)
      }
    }
  })

  it('downscales the SAME broad action to fit a tighter budget, never swaps it', () => {
    // Principle B: the headline action is stable; only its duration shrinks.
    const roomy = generatePlan({ readiness: 5, dayDifficulty: 8, routineMinutes: 30 })
    const tight = generatePlan({ readiness: 5, dayDifficulty: 8, routineMinutes: 8 })
    expect(roomy.oneThing.title).toBe('Get your body moving')
    expect(tight.oneThing.title).toBe('Get your body moving')
    expect(tight.oneThing.estMinutes).toBeLessThan(roomy.oneThing.estMinutes)
  })

  it('keeps it a wake-up routine — no single move dominates the budget (breadth)', () => {
    // Principle A: 30 min must not be one long activity. Cap is ~budget/3 ≤ 10.
    const plan = generatePlan({ readiness: 5, dayDifficulty: 8, routineMinutes: 30 })
    for (const step of plan.sequence) {
      expect(step.estMinutes).toBeLessThanOrEqual(10)
    }
    expect(plan.sequence.length).toBeGreaterThanOrEqual(3)
  })

  it('gives every move a broad title and a low-intensity example', () => {
    const plan = generatePlan({ readiness: 5, dayDifficulty: 8, routineMinutes: 30 })
    for (const step of plan.sequence) {
      expect(step.title.length).toBeGreaterThan(0)
      expect(step.example.length).toBeGreaterThan(0)
    }
  })

  it('caps the number of moves by routine length', () => {
    // ≤5 → 3 · 6–10 → 4 · 11–20 → 5 · 21+ → 6 (founder-confirmed table)
    const cases: [number, number][] = [
      [5, 3],
      [10, 4],
      [20, 5],
      [30, 6],
      [120, 6],
    ]
    for (const [minutes, max] of cases) {
      const plan = generatePlan({ readiness: 5, dayDifficulty: 8, routineMinutes: minutes })
      expect(plan.sequence.length).toBeLessThanOrEqual(max)
    }
  })

  it('fits more moves into a larger budget', () => {
    const small = generatePlan({ readiness: 5, dayDifficulty: 8, routineMinutes: 5 })
    const large = generatePlan({ readiness: 5, dayDifficulty: 8, routineMinutes: 60 })
    expect(large.sequence.length).toBeGreaterThan(small.sequence.length)
  })

  it('never recommends day-scope moves in the morning sequence', () => {
    const dayScopeSlugs = ['attack-hardest-1', 'deep-work-block-1', 'protect-first-90-1', 'train-hard-1']
    for (const [r, d] of [[5, 8], [8, 8], [9, 5]]) {
      const plan = generatePlan({ readiness: r, dayDifficulty: d, routineMinutes: 120 })
      for (const step of plan.sequence) {
        expect(dayScopeSlugs).not.toContain(step.slug)
      }
    }
  })

  it('always returns at least a One Thing, even on a sub-minute budget', () => {
    const plan = generatePlan({ readiness: 5, dayDifficulty: 9, routineMinutes: 0 })
    expect(plan.sequence.length).toBeGreaterThanOrEqual(1)
    expect(plan.oneThing).toBeDefined()
  })

  it('defaults the budget when none is given', () => {
    const plan = generatePlan({ readiness: 5, dayDifficulty: 8 })
    expect(plan.sequence.length).toBeGreaterThan(0)
    expect(totalMinutes(plan)).toBeLessThanOrEqual(15)
  })

  it('changes the lead move with intent, on the same Gap', () => {
    const base = { readiness: 5, dayDifficulty: 8, routineMinutes: 20 } as const
    const calm = generatePlan({ ...base, intent: 'calm' })
    const energize = generatePlan({ ...base, intent: 'energize' })
    const focus = generatePlan({ ...base, intent: 'focus' })
    // Same Gap, three different Focal Points — intent steers the lead.
    expect(calm.oneThing.title).toBe('Ease into the morning')
    expect(energize.oneThing.title).toBe('Get your body moving')
    expect(focus.oneThing.title).toBe('Set one intention')
    expect(new Set([calm.oneThing.slug, energize.oneThing.slug, focus.oneThing.slug]).size).toBe(3)
  })

  it('falls back to base priority order when no intent is set', () => {
    const plan = generatePlan({ readiness: 5, dayDifficulty: 8, routineMinutes: 20 })
    // move-body is the highest base-priority deficit routine goal.
    expect(plan.oneThing.title).toBe('Get your body moving')
  })

  it('clamps out-of-range inputs', () => {
    const plan = generatePlan({ readiness: 99, dayDifficulty: -4 })
    expect(plan.state).toBe('surplus')
    expect(plan.gap).toBe(9) // 10 - 1
  })
})

describe('freshnessPenalty', () => {
  // 'move-body' owns variants 'move-body-8' / 'move-body-3' (the stored focal slug).
  it('is zero with no recent focal history', () => {
    expect(freshnessPenalty('move-body', [])).toBe(0)
  })

  it('is zero for a goal whose variants have not recently led', () => {
    expect(freshnessPenalty('move-body', ['sunlight-3', 'set-intention-2'])).toBe(0)
  })

  it('penalizes a recent focal goal, heaviest for the most recent morning', () => {
    const yesterday = freshnessPenalty('move-body', ['move-body-3'])
    const twoDaysAgo = freshnessPenalty('move-body', ['sunlight-3', 'move-body-3'])
    expect(yesterday).toBeGreaterThan(twoDaysAgo)
    expect(twoDaysAgo).toBeGreaterThan(0)
  })

  it('sums across occurrences so a repeatedly-led goal drops furthest', () => {
    const once = freshnessPenalty('move-body', ['move-body-3'])
    const twice = freshnessPenalty('move-body', ['move-body-3', 'move-body-8'])
    expect(twice).toBeGreaterThan(once)
  })
})

describe('generatePlan — focal-point rotation', () => {
  const base = { readiness: 5, dayDifficulty: 8, routineMinutes: 20 } as const

  it('is unchanged when there is no focal history', () => {
    const plain = generatePlan(base)
    const withEmpty = generatePlan({ ...base, recentFocalSlugs: [] })
    expect(withEmpty.oneThing.slug).toBe(plain.oneThing.slug)
    expect(withEmpty.sequence.map((a) => a.slug)).toEqual(plain.sequence.map((a) => a.slug))
  })

  it('never repeats yesterday’s focal point (no intent set)', () => {
    const plain = generatePlan(base)
    const next = generatePlan({ ...base, recentFocalSlugs: [plain.oneThing.slug] })
    expect(next.oneThing.slug).not.toBe(plain.oneThing.slug)
  })

  it('never repeats yesterday’s focal point (with an intent match)', () => {
    // Even the strongest intent-matched lead rotates: the cluster gap is smaller
    // than the leading freshness weight, so a user who never leaves 'energize' /
    // deficit still gets a fresh One Thing each morning.
    const plain = generatePlan({ ...base, intent: 'energize' })
    const next = generatePlan({
      ...base,
      intent: 'energize',
      recentFocalSlugs: [plain.oneThing.slug],
    })
    expect(next.oneThing.slug).not.toBe(plain.oneThing.slug)
  })

  it('cycles the lead: no back-to-back repeats, real breadth, and the top move returns', () => {
    // Simulate a user parked in one state across several mornings, feeding each
    // day's focal point into the next day's history (most-recent first).
    const history: string[] = []
    const leads: string[] = []
    for (let day = 0; day < 14; day++) {
      const lead = generatePlan({ ...base, recentFocalSlugs: history }).oneThing.slug
      leads.push(lead)
      history.unshift(lead)
    }
    // No two consecutive mornings share a focal point — the whole point.
    for (let i = 1; i < leads.length; i++) {
      expect(leads[i]).not.toBe(leads[i - 1])
    }
    // The deep freshness curve makes the lead tour the library, not just the top
    // scorers: two weeks should surface a genuinely varied set of focal points.
    expect(new Set(leads).size).toBeGreaterThanOrEqual(5)
    // The highest-leverage move (day 1's lead) is not suppressed forever — it
    // reclaims the lead as its penalty decays.
    expect(leads.slice(1)).toContain(leads[0])
  })
})

describe('blockedFocalGoals — the lead-cooldown rule', () => {
  // 'move-body' owns variants 'move-body-8' / 'move-body-3'.
  it('blocks yesterday’s focal goal, at the goal grain', () => {
    const b = blockedFocalGoals([{ date: '2026-08-09', slug: 'move-body-3' }], '2026-08-10')
    expect(b.has('move-body')).toBe(true)
  })

  it('blocks any single appearance inside the cooldown window', () => {
    // 12 days ago — well past the old weekly rules, still inside the 16-day cooldown.
    const b = blockedFocalGoals([{ date: '2026-08-08', slug: 'move-body-8' }], '2026-08-20')
    expect(b.has('move-body')).toBe(true)
  })

  it('does not block once the appearance has aged out of the cooldown', () => {
    // 17 days ago — one past LEAD_COOLDOWN_DAYS.
    const b = blockedFocalGoals([{ date: '2026-08-03', slug: 'move-body-3' }], '2026-08-20')
    expect(b.has('move-body')).toBe(false)
  })

  it('ignores entries dated today or later (a same-day re-check-in)', () => {
    const b = blockedFocalGoals([{ date: '2026-08-10', slug: 'move-body-3' }], '2026-08-10')
    expect(b.has('move-body')).toBe(false)
  })

  it('ignores unknown slugs instead of throwing', () => {
    const b = blockedFocalGoals([{ date: '2026-08-09', slug: 'not-a-real-slug' }], '2026-08-10')
    expect(b.size).toBe(0)
  })
})

describe('generatePlan — hard no-repeat enforcement', () => {
  const base = { readiness: 5, dayDifficulty: 8, routineMinutes: 20 } as const
  const dateFor = (i: number) => new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10)

  it('a goal on cooldown cannot lead, even when it tops the ranking', () => {
    const lead = generatePlan(base).oneThing.slug
    // A single appearance 6 days ago — the decaying soft penalty alone would let
    // the top-ranked move back through; the cooldown must not.
    const history = [{ date: dateFor(4), slug: lead }]
    const next = generatePlan({ ...base, recentFocalHistory: history, planDate: dateFor(10) })
    expect(next.oneThing.slug).not.toBe(lead)
  })

  it('30 simulated mornings: 15+ distinct focal points, none repeating inside the cooldown', () => {
    const history: { date: string; slug: string }[] = []
    const leads: string[] = []
    for (let i = 0; i < 30; i++) {
      const lead = generatePlan({
        ...base,
        intent: 'energize',
        recentFocalHistory: history,
        planDate: dateFor(i),
      }).oneThing.slug
      leads.push(lead)
      history.unshift({ date: dateFor(i), slug: lead })
    }
    // The founder target: at least 15–20 different focal points across a month.
    expect(new Set(leads).size).toBeGreaterThanOrEqual(15)
    // And no goal leads twice within the cooldown window.
    for (let i = 0; i < leads.length; i++) {
      for (let j = i + 1; j < leads.length && j - i <= 16; j++) {
        expect(leads[j]).not.toBe(leads[i])
      }
    }
  })

  it('a blocked goal may still appear in the sequence, just not lead', () => {
    const plain = generatePlan(base)
    const lead = plain.oneThing.slug
    const next = generatePlan({
      ...base,
      recentFocalHistory: [{ date: dateFor(9), slug: lead }],
      planDate: dateFor(10),
    })
    expect(next.oneThing.slug).not.toBe(lead)
    // The rules govern the focal point only — the goal is not banished outright.
    // (It may or may not be re-packed depending on budget; assert nothing broke.)
    expect(next.sequence.length).toBeGreaterThan(0)
  })
})
