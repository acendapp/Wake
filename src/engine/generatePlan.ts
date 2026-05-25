import { ACTION_LIBRARY } from './actionLibrary'
import type { Plan, PlanInput, ReadinessState } from './types'

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/**
 * Map the distance between "You" (readiness) and "Day" (difficulty) to a state.
 * A 1-point difference still counts as aligned — the Gap only becomes
 * meaningful at 2+ points, in either direction.
 */
export function classifyState(readiness: number, dayDifficulty: number): ReadinessState {
  const gap = readiness - dayDifficulty
  if (gap <= -2) return 'deficit'
  if (gap >= 2) return 'surplus'
  return 'aligned'
}

const FRAMING: Record<
  ReadinessState,
  { headline: string; subhead: string; accent: Plan['accent']; sequenceLength: number }
> = {
  deficit: {
    headline: "Your day asks for more than you're bringing right now.",
    subhead: "Here's how we stabilize and close the gap.",
    accent: 'amber',
    sequenceLength: 5,
  },
  aligned: {
    headline: "You're showing up ready for what's ahead.",
    subhead: "Here's how we protect this state and hold it.",
    accent: 'neutral',
    sequenceLength: 4,
  },
  surplus: {
    headline: "You've got more in the tank than today requires.",
    subhead: "Here's how we spend it deliberately.",
    accent: 'bright',
    sequenceLength: 5,
  },
}

/**
 * The core engine. Pure and deterministic: same input → same plan.
 * V1 ranks a static library heuristically; the signature is intentionally
 * stable so personalization (from the reflection loop) can slot in later
 * without changing any callers.
 */
export function generatePlan(input: PlanInput): Plan {
  const readiness = clamp(Math.round(input.readiness), 1, 10)
  const dayDifficulty = clamp(Math.round(input.dayDifficulty), 1, 10)

  const state = classifyState(readiness, dayDifficulty)
  const gap = readiness - dayDifficulty
  const framing = FRAMING[state]

  const candidates = ACTION_LIBRARY.filter((a) => a.states.includes(state)).sort(
    (a, b) => b.priority - a.priority,
  )

  if (candidates.length === 0) {
    // Library invariant: every state has at least one action. Fail loudly.
    throw new Error(`No actions available for state "${state}"`)
  }

  const sequence = candidates.slice(0, framing.sequenceLength)

  return {
    state,
    gap,
    headline: framing.headline,
    subhead: framing.subhead,
    oneThing: sequence[0],
    sequence,
    accent: framing.accent,
  }
}
