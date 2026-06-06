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
import { supabase } from './supabase'

// The Claude personalization orchestration (Model C). Pre-generates tomorrow's
// routine the evening before — one plan per readiness state — and resolves the
// morning's plan by PICKING the pre-generated one for the realized state. Every
// path degrades to the deterministic generatePlan, so a missing cache, an
// unavailable model, or an off-contract response never blocks the user.

const STATES: ReadinessState[] = ['deficit', 'aligned', 'surplus']
const DEFAULT_BUDGET = 15
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
  } catch {
    return fallback // already source: 'deterministic' from generatePlan
  }
}

/**
 * Evening pre-generation: build and cache tomorrow's routine for all three
 * states. Call after the evening reflection writes tomorrow's demand + budget.
 * Best-effort — swallows errors so it never blocks the reflection from saving.
 */
export async function pregenerateTomorrow(today: string): Promise<void> {
  try {
    const tomorrow = addDays(today, 1)
    const [profile, reflectionRows, tomorrowRow] = await Promise.all([
      fetchProfile(),
      recentReflections(5),
      getDay(tomorrow),
    ])
    const dayDifficulty = tomorrowRow?.day_difficulty ?? DEFAULT_DEMAND
    const budget = tomorrowRow?.routine_minutes ?? DEFAULT_BUDGET
    const reflections = reflectionRows.map(toReflectionSummary)

    const plans = await Promise.all(
      STATES.map((state) => personalizeState(state, dayDifficulty, budget, profile, reflections)),
    )
    const options: Partial<Record<ReadinessState, Plan>> = {}
    STATES.forEach((state, i) => {
      options[state] = plans[i]
    })
    await savePlanOptions(tomorrow, options)
  } catch {
    // Pre-gen is an optimization; the morning falls back to a deterministic plan.
  }
}

/**
 * Morning resolution: return the pre-generated plan for the realized state if we
 * have one, otherwise compute a deterministic plan. Either way the gap is set
 * from the actual morning readiness.
 */
export function resolveMorningPlan(input: {
  readiness: number
  dayDifficulty: number
  routineMinutes?: number | null
  intent?: ProfileRow['intent']
  options?: DayRow['plan_options']
}): Plan {
  const fallback = generatePlan({
    readiness: input.readiness,
    dayDifficulty: input.dayDifficulty,
    routineMinutes: input.routineMinutes,
    intent: input.intent,
  })
  const cached = input.options?.[fallback.state]
  // Trust the cache only if it was actually built for this state. A plan stored
  // under the wrong key (e.g. the impossible-state slot at a demand extreme, or
  // any future labeling drift) would otherwise leak the wrong state's moves;
  // ignore it and use the deterministic plan instead.
  if (!cached || cached.state !== fallback.state) return fallback
  // The cached plan was framed at pre-gen time; correct the gap and framing to
  // the realized morning.
  return { ...cached, gap: fallback.gap, ...framingFor(fallback.state) }
}
