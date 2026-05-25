import { describe, expect, it } from 'vitest'
import { classifyState, generatePlan } from './generatePlan'

describe('classifyState', () => {
  it('is deficit when you trail the day by 2+', () => {
    expect(classifyState(6, 8)).toBe('deficit')
    expect(classifyState(3, 9)).toBe('deficit')
  })

  it('is surplus when you exceed the day by 2+', () => {
    expect(classifyState(9, 6)).toBe('surplus')
    expect(classifyState(8, 4)).toBe('surplus')
  })

  it('is aligned within 1 point in either direction', () => {
    expect(classifyState(8, 8)).toBe('aligned')
    expect(classifyState(7, 8)).toBe('aligned')
    expect(classifyState(8, 7)).toBe('aligned')
  })
})

describe('generatePlan', () => {
  it('reports a signed gap', () => {
    expect(generatePlan({ readiness: 6, dayDifficulty: 8 }).gap).toBe(-2)
    expect(generatePlan({ readiness: 9, dayDifficulty: 6 }).gap).toBe(3)
  })

  it('leads with the highest-priority action for the state', () => {
    const deficit = generatePlan({ readiness: 5, dayDifficulty: 8 })
    expect(deficit.state).toBe('deficit')
    expect(deficit.oneThing.slug).toBe('walk-before-first')

    const surplus = generatePlan({ readiness: 9, dayDifficulty: 5 })
    expect(surplus.oneThing.slug).toBe('attack-hardest')
  })

  it('only recommends actions valid for the state', () => {
    const plan = generatePlan({ readiness: 8, dayDifficulty: 8 })
    for (const action of plan.sequence) {
      expect(action.states).toContain(plan.state)
    }
  })

  it('puts the One Thing first in the sequence', () => {
    const plan = generatePlan({ readiness: 5, dayDifficulty: 9 })
    expect(plan.sequence[0]).toBe(plan.oneThing)
  })

  it('clamps out-of-range inputs', () => {
    const plan = generatePlan({ readiness: 99, dayDifficulty: -4 })
    expect(plan.state).toBe('surplus')
    expect(plan.gap).toBe(9) // 10 - 1
  })
})
