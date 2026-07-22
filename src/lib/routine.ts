import { framingFor, generatePlan } from '@/engine/generatePlan'
import {
  buildCandidates,
  buildMessages,
  parsePersonalizedSequence,
  type PersonalizationContext,
  type ReflectionSummary,
} from '@/engine/personalize'
import type { Lookback, Plan, ReadinessState } from '@/engine/types'

import { addDays, getDay, recentReflections, savePlanOptions, type DayRow } from './days'
import type { ProfileRow } from './profile'
import { SEQUENCE_MINUTES } from './routineTier'
import { supabase } from './supabase'

// The Claude personalization orchestration (Model C). Pre-generates tomorrow's
// routine the evening before — one plan per readiness state — and resolves the
// morning's plan by PICKING the pre-generated one for the realized state. Every
// path degrades to the deterministic generatePlan, so a missing cache, an
// unavailable model, or an off-contract response never blocks the user.

const STATES: ReadinessState[] = ['deficit', 'aligned', 'surplus']
const DEFAULT_DEMAND = 5

/** A readiness that classifies to `state` against `dayDifficulty` — used to
 *  materialize each state's framing + deterministic fallback at pre-gen time,
 *  before the real morning readiness is known. */
function representativeReadiness(state: ReadinessState, dayDifficulty: number): number {
  const offset = state === 'deficit' ? -3 : state === 'surplus' ? 3 : 0
  return Math.max(1, Math.min(10, dayDifficulty + offset))
}

function toReflectionSummary(row: DayRow): ReflectionSummary {
  return {
    date: row.local_date,
    lookback: (row.lookback as Lookback | null) ?? null,
    energy: row.energy,
    mood: row.mood,
    focus: row.focus,
    note: row.note,
    completedSlugs: row.completed_slugs ?? [],
  }
}

async function fetchProfile(): Promise<ProfileRow | null> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', userData.user.id).maybeSingle()
  return (data as ProfileRow) ?? null
}

function buildContext(
  state: ReadinessState,
  dayDifficulty: number,
  budget: number,
  profile: ProfileRow | null,
  reflections: ReflectionSummary[],
): PersonalizationContext {
  const readiness = representativeReadiness(state, dayDifficulty)
  return {
    state,
    gap: readiness - dayDifficulty,
    dayDifficulty,
    budgetMinutes: budget,
    intent: profile?.intent ?? null,
    fitnessLevel: profile?.fitness_level ?? null,
    chronotype: profile?.chronotype ?? null,
    frictionPoint: profile?.friction_point ?? null,
    goals: profile?.goals ?? [],
    constraints: profile?.constraints ?? [],
    ageRange: profile?.age_range ?? null,
    sex: profile?.sex ?? null,
    reflections,
  }
}

/** Personalize one state via Claude; fall back to the deterministic plan on any
 *  failure (no key, network error, or an off-contract response). */
async function personalizeState(
  state: ReadinessState,
  dayDifficulty: number,
  budget: number,
  profile: ProfileRow | null,
  reflections: ReflectionSummary[],
): Promise<Plan> {
  const readiness = representativeReadiness(state, dayDifficulty)
  const fallback = generatePlan({
    readiness,
    dayDifficulty,
    routineMinutes: budget,
    intent: profile?.intent ?? null,
  })

  try {
    const ctx = buildContext(state, dayDifficulty, budget, profile, reflections)
    const { system, user } = buildMessages(ctx, buildCandidates(state))
    const { data, error } = await supabase.functions.invoke('generate-routine', {
      body: { system, user },
    })
    if (error || typeof data?.text !== 'string') throw error ?? new Error('No model text')
    const { sequence, oneThing } = parsePersonalizedSequence(data.text, state, budget)
    // Reuse the deterministic framing; swap in the personalized moves. Mark the
    // plan as Claude-built so the dev indicator can tell it apart from a fallback.
    return { ...fallback, sequence, oneThing, source: 'claude' }
  } catch (e) {
    // Every personalization failure degrades silently to the deterministic plan,
    // so a permanently broken Edge Function (bad deploy, missing key) would be
    // invisible. Surface it in development; production still falls back cleanly.
    if (__DEV__) console.warn(`[personalize] ${state} fell back to deterministic:`, e)
    return fallback // already source: 'deterministic' from generatePlan
  }
}

// In-flight guard, keyed by target date: focus/launch can fire the safety-net
// re-arm repeatedly, and the evening hook could overlap it — never run two
// pre-gens for the same date at once (each is three Claude calls).
const inFlight = new Set<string>()

/**
 * Build and cache one date's routine for all three readiness states via Claude,
 * reading that date's demand + budget (defaults when the row isn't set yet).
 * Best-effort — swallows errors so it never blocks the caller. Returns true only
 * when fresh options were actually written, so a caller can reload to pick them
 * up (and skip reloading when nothing changed, avoiding a refetch loop).
 */
export async function pregeneratePlansFor(targetDate: string): Promise<boolean> {
  if (inFlight.has(targetDate)) return false
  inFlight.add(targetDate)
  try {
    const [profile, reflectionRows, targetRow] = await Promise.all([
      fetchProfile(),
      recentReflections(5),
      getDay(targetDate),
    ])
    const dayDifficulty = targetRow?.day_difficulty ?? DEFAULT_DEMAND
    // Fixed generation budget — the focal point plus an optional sequence. The user
    // self-paces by doing or skipping; there's no per-user routine length.
    const budget = SEQUENCE_MINUTES
    const reflections = reflectionRows.map(toReflectionSummary)

    const plans = await Promise.all(
      STATES.map((state) => personalizeState(state, dayDifficulty, budget, profile, reflections)),
    )
    const options: Partial<Record<ReadinessState, Plan>> = {}
    STATES.forEach((state, i) => {
      options[state] = plans[i]
    })
    await savePlanOptions(targetDate, options)
    return true
  } catch {
    // Pre-gen is an optimization; the morning falls back to a deterministic plan.
    return false
  } finally {
    inFlight.delete(targetDate)
  }
}

/**
 * Evening pre-generation: build and cache tomorrow's routine for all three
 * states. Call after the evening reflection writes tomorrow's demand + budget.
 * Best-effort — swallows errors so it never blocks the reflection from saving.
 */
export function pregenerateTomorrow(today: string): Promise<boolean> {
  return pregeneratePlansFor(addDays(today, 1))
}

/**
 * Morning resolution: return the pre-generated plan for the realized state if we
 * have one, otherwise compute a deterministic plan. Either way the gap is set
 * from the actual morning readiness.
 */
export function resolveMorningPlan(input: {
  readiness: number
  dayDifficulty: number
  intent?: ProfileRow['intent']
  options?: DayRow['plan_options']
}): Plan {
  const fallback = generatePlan({
    readiness: input.readiness,
    dayDifficulty: input.dayDifficulty,
    routineMinutes: SEQUENCE_MINUTES,
    intent: input.intent,
  })
  const cached = input.options?.[fallback.state]
  // Trust the cache only if it was actually built for this state AND is structurally
  // complete. `plan_options` is a JSON column, so a partial/older-shape entry (e.g. a
  // pre-gen interrupted mid-write) could have `state` set but no `oneThing`/`sequence` —
  // letting it through would crash saveMorning, which reads `plan.oneThing.slug`. A plan
  // stored under the wrong key would also leak the wrong state's moves. Either way,
  // fall back to the deterministic plan.
  if (
    !cached ||
    cached.state !== fallback.state ||
    !cached.oneThing?.slug ||
    !Array.isArray(cached.sequence) ||
    cached.sequence.length === 0
  )
    return fallback
  // The cached plan was framed at pre-gen time; correct the gap and framing to
  // the realized morning.
  return { ...cached, gap: fallback.gap, ...framingFor(fallback.state) }
}
