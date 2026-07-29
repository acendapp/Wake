// Wake recommendation engine — domain types.
// This module is pure TypeScript with no React/React Native dependencies,
// so it can be unit-tested in isolation and reused on any future surface.

/**
 * The relationship between how the user is showing up ("You") and what the
 * day demands ("Day"). The Gap is never assumed to be a deficit — see below.
 */
export type ReadinessState = 'deficit' | 'aligned' | 'surplus'

/**
 * The tone the user wants their morning to set, from onboarding. The strongest
 * personalization lever: same Gap, different intent → a different routine, and
 * a different lead move. Mirrors `Intent` in src/lib/profile.tsx.
 */
export type Intent = 'calm' | 'energize' | 'focus'

export type ActionCategory =
  | 'movement'
  | 'transition'
  | 'light'
  | 'hydration'
  | 'caffeine'
  | 'nutrition'
  | 'focus'
  | 'digital'

export type Mode =
  | 'founder'
  | 'athlete'
  | 'exam'
  | 'recovery'
  | 'deep_work'
  | 'social'
  | 'travel'

/**
 * Where a move belongs in the day. The morning sequence only ever pulls
 * `routine` moves; `day` moves (deep work, attack-the-hardest) stay dormant
 * for a future "rest of your day" surface.
 */
export type ActionScope = 'routine' | 'day'

/**
 * A single move the morning screen renders.
 *
 * GUIDING PRINCIPLE (applies to every move, hand-written or LLM-generated):
 *  1. This is a WAKE-UP routine — short moves that get the user out of bed and
 *     out of their room, not a training block. Keep `estMinutes` small; the
 *     engine packs breadth, never one long activity.
 *  2. The `title` is the BROAD ACTION whose mere performance wins the gain —
 *     "Move your body", "Get sunlight", "Read", "Hydrate". NOT a specific
 *     prescription ("do 10 pushups", "walk outside", "read Chapter 3").
 *  3. `example` is a low-intensity, explicitly-optional illustration of what the
 *     action could look like ("a few squats or a short walk — whatever's easy").
 *     It exists so anyone can do their own version regardless of ability; the
 *     gain is attributed to the action, never the example.
 */
export interface Action {
  slug: string
  /** The broad action, imperative — what gets shown as "The One Thing". */
  title: string
  /** Low-intensity, optional illustration of the action. Gain is in the action. */
  example: string
  /** One line on the how/why — attribute the benefit to the action itself. */
  description: string
  category: ActionCategory
  estMinutes: number
}

/**
 * A goal worth pursuing for a given state — the unit the engine *selects*, and
 * the rail the LLM personalizes within. Each goal owns one or more variants:
 * the SAME broad action expressed at different durations (e.g. "Get sunlight"
 * for 10 minutes outside vs. 2 minutes at a window), so a move can be scaled to
 * the budget instead of dropped. Variants differ in time/example, never in the
 * underlying action.
 */
export interface Goal {
  slug: string
  /** Internal label for the underlying job, e.g. "cardio activation". */
  label: string
  category: ActionCategory
  scope: ActionScope
  /** Which readiness states this goal is appropriate for. */
  states: ReadinessState[]
  /**
   * Which intents this goal serves well. A move that fits the user's intent is
   * boosted in ranking and can take the lead. Universal staples (hydrate,
   * sunlight) list all three; specialized moves lean (cold splash → energize,
   * settle-your-mind → calm + focus).
   */
  intents: Intent[]
  /**
   * Base ranking weight within a state (higher = higher leverage).
   * V1 ordering is heuristic; personalization will later re-weight this
   * per user from the reflection loop.
   */
  priority: number
  /**
   * Performable expressions of the goal, **sorted by estMinutes descending**.
   * The engine picks the largest variant that fits the remaining budget.
   * Every goal must have at least one variant.
   */
  variants: Action[]
}

/** Everything the engine needs to produce a morning plan. */
export interface PlanInput {
  /** 1–10 self-report from the morning check-in ("You"). */
  readiness: number
  /** 1–10 day difficulty from calendar/manual input ("Day"). */
  dayDifficulty: number
  /**
   * Minutes the user has for the morning routine (from the profile, or last
   * night's reflection). The sequence is packed to fit this. Omitted → default.
   */
  routineMinutes?: number | null
  /** The user's morning intent (from onboarding). Steers selection and the lead. */
  intent?: Intent | null
  /**
   * Recent focal-point slugs (the stored `one_thing_slug` per morning), most
   * recent first. A goal whose variant recently led gets a decaying rank penalty
   * so the focal point rotates through near-equal moves instead of repeating for
   * a user parked in one readiness state. Empty/omitted → no penalty (identical
   * to the pre-freshness behavior).
   */
  recentFocalSlugs?: string[] | null
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
  /**
   * The single highest-leverage move. Usually sequence[0] — except when
   * "get out of bed" is in the plan, which always leads the sequence
   * chronologically while the One Thing stays the highest-leverage move.
   */
  oneThing: Action
  /** The full ordered ritual (chronological; oneThing is in here). */
  sequence: Action[]
  /** UI tone for the state. */
  accent: 'amber' | 'neutral' | 'bright'
  /**
   * Who built this plan: 'claude' when the personalization layer produced and
   * validated it, 'deterministic' when the engine packer did (the fallback, and
   * the sample routine). Used only by a dev-only indicator so we can see whether
   * personalization actually ran — never shown to real users.
   */
  source?: 'claude' | 'deterministic'
}
