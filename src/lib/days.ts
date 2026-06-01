import type { DayReads, Lookback, Plan, ReadinessState } from '@/engine/types'
import { supabase } from './supabase'

// The store layer over `public.days` — one row per user per local date. Screens
// and the engine go through these functions, never the supabase client directly,
// so swapping storage later (or mocking in tests) touches nothing else.
//
// A single evening reflection writes TWO rows: today's review (look-back, reads,
// note, completion) and tomorrow's setup (demand, routine length). The morning
// check-in writes today's readiness + computed plan.

/** Row shape of `public.days` (snake_case, as Postgres returns it). */
export type DayRow = {
  id: string
  user_id: string
  local_date: string
  readiness: number | null
  day_difficulty: number | null
  state: ReadinessState | null
  gap: number | null
  one_thing_slug: string | null
  plan: Plan | null
  morning_completed_at: string | null
  energy: number | null
  focus: number | null
  mood: number | null
  did_one_thing: boolean | null
  evening_completed_at: string | null
  lookback: Lookback | null
  note: string | null
  completed_slugs: string[]
  // How long tomorrow's morning routine should run, in minutes. Set the evening
  // before; defaults to the user's standing preference (see src/lib/prefs.ts).
  routine_minutes: number | null
  // Evening-pregenerated, Claude-personalized routines, one per readiness state.
  // The morning check-in picks the one matching the realized state (see 0006 +
  // src/lib/routine.ts). Null when no pre-gen ran — the morning falls back to a
  // deterministic plan.
  plan_options: Partial<Record<ReadinessState, Plan>> | null
  // Vestigial (replaced by routine_minutes in migration 0003): no longer written,
  // kept so the type still mirrors the live table for older rows.
  leave_by: string | null
  sleep_target_hours: number | null
  sleep_bedtime: string | null
  created_at: string
}

/** "YYYY-MM-DD" in the device's local time — matches `days.local_date`. */
export function localDate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Shift a "YYYY-MM-DD" local date by whole days (handles month/year rollover). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return localDate(new Date(y, m - 1, d + n))
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Not signed in')
  return data.user.id
}

async function upsertDay(
  userId: string,
  date: string,
  patch: Record<string, unknown>,
): Promise<DayRow> {
  // Upsert on (user_id, local_date): only the columns in `patch` are written, so
  // an evening write never clobbers that day's morning fields, and vice versa.
  const { data, error } = await supabase
    .from('days')
    .upsert(
      { user_id: userId, local_date: date, ...patch },
      { onConflict: 'user_id,local_date' },
    )
    .select()
    .single()
  if (error) throw error
  return data as DayRow
}

/** Read one day's row, or null if it doesn't exist yet. */
export async function getDay(date: string): Promise<DayRow | null> {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('days')
    .select('*')
    .eq('user_id', userId)
    .eq('local_date', date)
    .maybeSingle()
  if (error) throw error
  return (data as DayRow) ?? null
}

/** Morning check-in: the one-tap readiness + the plan the engine produced. */
export async function saveMorning(
  date: string,
  input: { readiness: number; dayDifficulty: number; plan: Plan },
): Promise<DayRow> {
  const userId = await currentUserId()
  return upsertDay(userId, date, {
    readiness: input.readiness,
    day_difficulty: input.dayDifficulty,
    state: input.plan.state,
    gap: input.plan.gap,
    one_thing_slug: input.plan.oneThing.slug,
    plan: input.plan,
    morning_completed_at: new Date().toISOString(),
  })
}

/** Cache the evening-pregenerated per-state routines onto the day they target. */
export async function savePlanOptions(
  date: string,
  options: Partial<Record<ReadinessState, Plan>>,
): Promise<void> {
  const userId = await currentUserId()
  await upsertDay(userId, date, { plan_options: options })
}

/**
 * How many days the user has actually shown up for (a morning check-in or an
 * evening reflection). Drives the You page's cold-start gate: trends and
 * patterns only render once there's enough history to be honest about.
 */
export async function completedDayCount(): Promise<number> {
  const userId = await currentUserId()
  const { count, error } = await supabase
    .from('days')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .or('morning_completed_at.not.is.null,evening_completed_at.not.is.null')
  if (error) throw error
  return count ?? 0
}

/** Recent completed evening reflections, newest first — the personalization signal. */
export async function recentReflections(limit = 5): Promise<DayRow[]> {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('days')
    .select('*')
    .eq('user_id', userId)
    .not('evening_completed_at', 'is', null)
    .order('local_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as DayRow[]) ?? []
}

/** Evening reflection: writes today's review and tomorrow's setup in one go. */
export async function saveEvening(
  date: string,
  input: {
    lookback: Lookback
    reads: DayReads
    note?: string
    completedSlugs?: string[]
    tomorrowDemand: number
    routineMinutes: number
  },
): Promise<void> {
  const userId = await currentUserId()
  await upsertDay(userId, date, {
    lookback: input.lookback,
    energy: input.reads.energy,
    mood: input.reads.mood,
    focus: input.reads.focus,
    note: input.note ?? null,
    completed_slugs: input.completedSlugs ?? [],
    evening_completed_at: new Date().toISOString(),
  })
  await upsertDay(userId, addDays(date, 1), {
    day_difficulty: input.tomorrowDemand,
    routine_minutes: input.routineMinutes,
  })
}
