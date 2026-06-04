import { GET_UP_SLUG, GOAL_LIBRARY } from './goalLibrary'
import type { Action, Goal, Intent, Plan, PlanInput, ReadinessState } from './types'

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

// If we don't yet know the user's budget, assume a modest morning.
const DEFAULT_ROUTINE_MINUTES = 15
const MIN_ROUTINE_MINUTES = 1
const MAX_ROUTINE_MINUTES = 240
// Hard ceiling on any single wake-up move. This is a get-up-and-out routine,
// not a training block — no move should eat the morning even if budget allows.
const MAX_MOVE_MINUTES = 10

/**
 * How many things to actually check off, by routine length. A short routine
 * shouldn't list six items — past ~6 a morning checklist reads as a chore, and
 * a 5-minute routine packed with one-minute moves feels like busywork. The time
 * budget sets the floor (you can't fit 4 real moves into 5 min); this caps the
 * ceiling. Confirmed with the founder 2026-05-31.
 *
 *   ≤5 min → 3 · 6–10 → 4 · 11–20 → 5 · 21+ → 6
 */
export function maxMoves(budget: number): number {
  if (budget <= 5) return 3
  if (budget <= 10) return 4
  if (budget <= 20) return 5
  return 6
}

/** The routine goals eligible for a state — the vetted candidate set the Claude
 *  layer selects and adapts within. Day-scope goals are never included. */
export function eligibleRoutineGoals(state: ReadinessState): Goal[] {
  return GOAL_LIBRARY.filter((g) => g.scope === 'routine' && g.states.includes(state))
}

/**
 * The most time any single move may take, given the budget. We want breadth
 * (several short activating moves), so a move is capped at the smaller of a hard
 * ceiling and roughly a third of the budget — leaving room for variety. Never
 * below 3, so a tight budget can still place one real move.
 */
export function moveCap(budget: number): number {
  return Math.min(MAX_MOVE_MINUTES, Math.max(3, Math.ceil(budget / 3)))
}

/**
 * Map the distance between "You" (readiness) and "Day" (difficulty) to a state.
 * Alignment means an exact match — any distance at all, in either direction,
 * is a gap (behind the day) or a surplus (ahead of it).
 */
export function classifyState(readiness: number, dayDifficulty: number): ReadinessState {
  const gap = readiness - dayDifficulty
  if (gap < 0) return 'deficit'
  if (gap > 0) return 'surplus'
  return 'aligned'
}

const FRAMING: Record<
  ReadinessState,
  { headline: string; subhead: string; accent: Plan['accent'] }
> = {
  deficit: {
    headline: "Your day asks for more than you're bringing right now.",
    subhead: "Here's how we stabilize and close the gap.",
    accent: 'amber',
  },
  aligned: {
    headline: "You're showing up ready for what's ahead.",
    subhead: "Here's how we protect this state and hold it.",
    accent: 'neutral',
  },
  surplus: {
    headline: "You've got more in the tank than today requires.",
    subhead: "Here's how we spend it deliberately.",
    accent: 'bright',
  },
}

// How much an intent match lifts a goal's rank. Tuned so a matching specialized
// move can clear the top universal staple and take the lead — making calm vs.
// energize vs. focus differ at the Focal Point, not just lower in the list.
const INTENT_BONUS = 30

/**
 * The user's intent is the strongest deterministic prior. A goal that serves the
 * intent is boosted, so the same Gap produces a different mix — and a different
 * lead — per intent. With no intent set, this is a no-op and ranking falls back
 * to base priority.
 */
function rankFor(goal: Goal, intent: Intent | null | undefined): number {
  const matched = intent != null && goal.intents.includes(intent)
  return goal.priority + (matched ? INTENT_BONUS : 0)
}

/** The state-derived framing (headline/subhead/accent) for a plan. Shared so the
 *  personalized plan reuses the same framing as the deterministic one. */
export function framingFor(state: ReadinessState): (typeof FRAMING)[ReadinessState] {
  return FRAMING[state]
}

/**
 * Pick the largest variant of a goal that fits within `budget` active minutes.
 * Variants are stored sorted by estMinutes descending, so the first one that
 * fits is the largest. Returns null if even the smallest variant is too big.
 * This is what scales "go for a run" down to "10 pushups" when time is short.
 */
function fitVariant(goal: Goal, budget: number): Action | null {
  return goal.variants.find((v) => v.estMinutes <= budget) ?? null
}

/**
 * The core engine. Pure and deterministic: same input → same plan.
 *
 * V1 ranks a vetted goal library heuristically and packs the highest-leverage
 * moves into the user's time budget, scaling each move to fit. This is the
 * rail the LLM personalizes within and the fallback when the model is slow or
 * unavailable — it is intentionally simple (greedy by priority). Nuanced
 * breadth-vs-depth allocation is the model's job, not the packer's.
 *
 * The signature is stable so personalization can slot in without touching callers.
 */
export function generatePlan(input: PlanInput): Plan {
  const readiness = clamp(Math.round(input.readiness), 1, 10)
  const dayDifficulty = clamp(Math.round(input.dayDifficulty), 1, 10)
  const budget = clamp(
    Math.round(input.routineMinutes ?? DEFAULT_ROUTINE_MINUTES),
    MIN_ROUTINE_MINUTES,
    MAX_ROUTINE_MINUTES,
  )

  const state = classifyState(readiness, dayDifficulty)
  const gap = readiness - dayDifficulty
  const framing = FRAMING[state]

  // Only morning-routine goals for this state, ranked by leverage and then lifted
  // by how well each serves the user's intent (the strongest prior we have).
  const candidates = GOAL_LIBRARY.filter(
    (g) => g.scope === 'routine' && g.states.includes(state),
  ).sort((a, b) => rankFor(b, input.intent) - rankFor(a, input.intent))

  if (candidates.length === 0) {
    // Library invariant: every state has at least one routine goal. Fail loudly.
    throw new Error(`No routine goals available for state "${state}"`)
  }

  // Greedy pack: walk goals by priority, take the largest variant that fits both
  // the remaining budget AND the per-move cap, so one move can't eat the morning.
  // A near-free move (1 min) almost always makes it; a costly one downscales.
  const cap = moveCap(budget)
  const limit = maxMoves(budget)
  const sequence: Action[] = []
  let remaining = budget
  for (const goal of candidates) {
    if (sequence.length >= limit) break
    const variant = fitVariant(goal, Math.min(remaining, cap))
    if (variant) {
      sequence.push(variant)
      remaining -= variant.estMinutes
    }
  }

  // Guarantee a One Thing even when the budget is below every variant of the
  // top goal: fall back to the smallest variant of the highest-priority goal.
  if (sequence.length === 0) {
    const top = candidates[0]
    sequence.push(top.variants[top.variants.length - 1])
  }

  // The One Thing is the highest-leverage move — locked in before any reorder.
  const oneThing = sequence[0]

  // Chronological invariant: getting out of bed can't follow anything else. If
  // it made the cut, it leads the sequence (the One Thing above is unaffected).
  orderGetUpFirst(sequence)

  return {
    state,
    gap,
    headline: framing.headline,
    subhead: framing.subhead,
    oneThing,
    sequence,
    accent: framing.accent,
    source: 'deterministic',
  }
}

/**
 * Reorder a sequence in place so "Get out of bed right away" is first whenever
 * it's present — you can't do anything else before it. Shared by the
 * deterministic packer and the personalized-plan validator.
 */
export function orderGetUpFirst(sequence: Action[]): void {
  const i = sequence.findIndex((a) => a.slug === GET_UP_SLUG)
  if (i > 0) {
    const [getUp] = sequence.splice(i, 1)
    sequence.unshift(getUp)
  }
}
