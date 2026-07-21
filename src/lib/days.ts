import type { DayReads, Lookback, Plan, ReadinessState } from '@/engine/types'
import type { StatsDay } from './stats'
import { supabase } from './supabase'
import { logicalNow } from './time'

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
  // Set when the user acknowledges the morning alarm but chooses "Not today" —
  // just wake, no routine. Counts toward the streak (waking well is the habit).
  woke_at: string | null
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

/**
 * "YYYY-MM-DD" of the app's logical today — the 3am→3am day (see src/lib/time.ts).
 * Every screen that touches "today's" row uses this, so a 1am reflection lands on
 * the day being finished and the whole app rolls over together at 3am.
 */
export function logicalDate(): string {
  return localDate(logicalNow())
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

// Write-through in-memory cache of day rows. Lets a screen returning to focus paint
// the freshest known row synchronously (peekDay) — no network flash — while it still
// revalidates via getDay. Keyed by local_date for the current user; a user change
// (or sign-out via clearDayCache) drops it so one account never sees another's rows.
let cacheUserId: string | null = null
const dayCache = new Map<string, DayRow | null>()

function cachePut(userId: string, date: string, row: DayRow | null): void {
  if (cacheUserId !== userId) {
    dayCache.clear()
    cacheUserId = userId
  }
  dayCache.set(date, row)
}

/** The last-known row for a date, synchronously (undefined if never loaded). A
 *  best-effort optimistic value — callers still revalidate with getDay. */
export function peekDay(date: string): DayRow | null | undefined {
  return dayCache.get(date)
}

/** Drop all cached rows — call on sign-out so the next user starts clean. */
export function clearDayCache(): void {
  dayCache.clear()
  cacheUserId = null
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
  const row = data as DayRow
  cachePut(userId, date, row)
  return row
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
  const row = (data as DayRow) ?? null
  cachePut(userId, date, row)
  return row
}

/**
 * The "just wake me" path: the user acknowledged the morning alarm but chose to
 * skip the routine today. Records woke_at (idempotent — only sets it if not
 * already stamped) so the day counts toward the streak without a check-in.
 */
export async function markWoke(date: string): Promise<DayRow> {
  const userId = await currentUserId()
  const existing = await getDay(date)
  if (existing?.woke_at) return existing
  return upsertDay(userId, date, { woke_at: new Date().toISOString() })
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

/**
 * Morning routine tracking: persist which moves have been checked off, as they
 * happen. Written by the /routine screen on every toggle (focal point and the
 * optional rest), and read back by the evening reflection — a morning that was
 * tracked live never gets re-asked "which of these did you do?".
 */
export async function saveCompletedSlugs(date: string, slugs: string[]): Promise<DayRow> {
  const userId = await currentUserId()
  return upsertDay(userId, date, { completed_slugs: slugs })
}

/** Cache the evening-pregenerated per-state routines onto the day they target. */
export async function savePlanOptions(
  date: string,
  options: Partial<Record<ReadinessState, Plan>>,
): Promise<void> {
  const userId = await currentUserId()
  await upsertDay(userId, date, { plan_options: options })
}

// The stats row shape lives in stats.ts (kept pure/testable); re-export it here so
// callers can get it alongside `daysForStats`. Type-only — no runtime dependency.
export type { StatsDay }

/**
 * Every day with any activity, oldest → newest — the source for the You page's
 * real stats (streak, trends, gap mix, portfolio). Bounded to a generous window
 * so the query stays light; an early-stage user is well within it.
 *
 * The query orders NEWEST-first so the `limit` keeps the most recent days (past
 * the cap it's the oldest history that drops off, never today's data); the result
 * is reversed back to oldest → newest for the stats pipeline.
 */
export async function daysForStats(limit = 400): Promise<StatsDay[]> {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('days')
    .select(
      'local_date, morning_completed_at, evening_completed_at, woke_at, state, energy, mood, focus, routine_minutes, one_thing_slug, completed_slugs',
    )
    .eq('user_id', userId)
    .or('morning_completed_at.not.is.null,evening_completed_at.not.is.null,woke_at.not.is.null')
    .order('local_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as StatsDay[]).reverse()
}

/**
 * Every day that had a plan, newest first — the source for the Library's
 * "My moves" collection (which moves the engine has actually prescribed to this
 * user, and which of them they completed). Trimmed to the columns it needs.
 */
export async function daysWithPlans(): Promise<
  Pick<DayRow, 'local_date' | 'plan' | 'completed_slugs'>[]
> {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('days')
    .select('local_date, plan, completed_slugs')
    .eq('user_id', userId)
    .not('plan', 'is', null)
    .order('local_date', { ascending: false })
    .limit(400) // newest-first, so this keeps the most recent ~400 mornings
  if (error) throw error
  return (data ?? []) as Pick<DayRow, 'local_date' | 'plan' | 'completed_slugs'>[]
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

/**
 * Evening reflection: writes today's review and tomorrow's setup.
 *
 * Order matters — these are two non-atomic writes, so tomorrow's setup is
 * written FIRST and today's `evening_completed_at` stamp LAST. That way the
 * completion stamp is the commit point: if the first write fails, today is never
 * marked done, and the user simply retries (both upserts are idempotent). A
 * "done" day therefore always implies tomorrow is set up — never a half state.
 */
export async function saveEvening(
  date: string,
  input: {
    reads: DayReads
    note?: string
    tomorrowDemand: number
    routineMinutes: number
  },
): Promise<void> {
  const userId = await currentUserId()
  // Clamp to the column's CHECK range (0–240) so a stray stored preference can
  // never make the write throw a constraint violation and block the reflection.
  // 0 and 1 are the encoded alarm-only / focal-only tiers (see routineTier.ts).
  const routineMinutes = Math.max(0, Math.min(240, Math.round(input.routineMinutes)))
  await upsertDay(userId, addDays(date, 1), {
    day_difficulty: input.tomorrowDemand,
    routine_minutes: routineMinutes,
    // Invalidate any cached pre-gen for tomorrow: editing the reflection can change
    // demand/length, and a plan built for the old inputs must not survive. pregenerate-
    // Tomorrow (fired right after this in finish()) repopulates; if it can't (offline),
    // the morning safely falls back to a deterministic plan rather than serving a
    // stale one that mismatches the row.
    plan_options: null,
  })
  await upsertDay(userId, date, {
    energy: input.reads.energy,
    mood: input.reads.mood,
    focus: input.reads.focus,
    note: input.note ?? null,
    evening_completed_at: new Date().toISOString(),
  })
}
