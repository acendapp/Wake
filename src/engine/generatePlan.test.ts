import { describe, expect, it } from 'vitest'
import { classifyState, generatePlan } from './generatePlan'

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
    expect(deficit.oneThing.title).toBe('Get your blood moving')

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
    expect(plan.oneThing.title).toBe('Get your blood moving')
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
    expect(roomy.oneThing.title).toBe('Get your blood moving')
    expect(tight.oneThing.title).toBe('Get your blood moving')
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
    expect(energize.oneThing.title).toBe('Get your blood moving')
    expect(focus.oneThing.title).toBe('Set one intention')
    expect(new Set([calm.oneThing.slug, energize.oneThing.slug, focus.oneThing.slug]).size).toBe(3)
  })

  it('falls back to base priority order when no intent is set', () => {
    const plan = generatePlan({ readiness: 5, dayDifficulty: 8, routineMinutes: 20 })
    // move-body is the highest base-priority deficit routine goal.
    expect(plan.oneThing.title).toBe('Get your blood moving')
  })

  it('clamps out-of-range inputs', () => {
    const plan = generatePlan({ readiness: 99, dayDifficulty: -4 })
    expect(plan.state).toBe('surplus')
    expect(plan.gap).toBe(9) // 10 - 1
  })
})
