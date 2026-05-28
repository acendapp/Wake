// Wake recommendation engine — domain types.
// This module is pure TypeScript with no React/React Native dependencies,
// so it can be unit-tested in isolation and reused on any future surface.

/**
 * The relationship between how the user is showing up ("You") and what the
 * day demands ("Day"). The Gap is never assumed to be a deficit — see below.
 */
export type ReadinessState = 'deficit' | 'aligned' | 'surplus'

export type ActionCategory =
  | 'movement'
  | 'light'
  | 'hydration'
  | 'caffeine'
  | 'nutrition'
  | 'focus'
  | 'digital'
  | 'wind_up'

export type Mode =
  | 'founder'
  | 'athlete'
  | 'exam'
  | 'recovery'
  | 'deep_work'
  | 'social'
  | 'travel'

/** A single recommendable move from the action library. */
export interface Action {
  slug: string
  /** Short imperative — what gets shown as "The One Thing". */
  title: string
  /** One line on the how/why. */
  description: string
  category: ActionCategory
  /** Which readiness states this action is appropriate for. */
  states: ReadinessState[]
  estMinutes: number
  /**
   * Base ranking weight within a state (higher = higher leverage).
   * V1 ordering is heuristic; personalization will later re-weight this
   * per user from the reflection loop.
   */
  priority: number
}

/** Everything the engine needs to produce a morning plan. */
export interface PlanInput {
  /** 1–10 self-report from the morning check-in ("You"). */
  readiness: number
  /** 1–10 day difficulty from calendar/manual input ("Day"). */
  dayDifficulty: number
  /** Optional, for time-aware copy later. */
  now?: Date
  mode?: Mode | null
}

// ── Evening reflection ───────────────────────────────────────────────────────

/** How today landed relative to the morning's call — the engine's error signal. */
export type Lookback = 'behind' | 'matched' | 'ahead'

/** End-of-day self-reads, 1–10 each. Feed trends + personalization, not the
 *  core Gap math (which uses a single morning `readiness`). */
export interface DayReads {
  energy: number
  mood: number
  focus: number
}

/** A single evening wind-down move. The evening mirror of an `Action`. */
export interface WindDownStep {
  slug: string
  /** Short imperative — what gets shown in the wind-down list. */
  title: string
  /** One line on the how/why. */
  description: string
  estMinutes: number
  /** Ranking weight; higher surfaces first and survives shorter sequences. */
  priority: number
}

/** The result the morning screen renders. */
export interface Plan {
  state: ReadinessState
  /** Signed: readiness - dayDifficulty. Negative = behind the day. */
  gap: number
  /** The framing line at the top of the Gap screen. */
  headline: string
  /** The "here's how we handle it" line beneath the headline. */
  subhead: string
  /** The single highest-leverage move. Also sequence[0]. */
  oneThing: Action
  /** The full ordered ritual, oneThing first. */
  sequence: Action[]
  /** UI tone for the state. */
  accent: 'amber' | 'neutral' | 'bright'
}
