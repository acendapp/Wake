import type { Plan, ReadinessState } from '../engine/types'

// The You-page stats pipeline. This module is PURE (rows in → numbers out) and
// imports only pure engine types — never the supabase/db layer — so the math is
// unit-tested in isolation. The screen fetches rows via `daysForStats()` and
// passes them to `computeYouStats`. Everything is derived from the user's real
// `days` history — never sampled or faked. When there isn't enough history to be
// honest about a stat, it returns null/—/an empty list and the screen degrades
// to a "still forming" state rather than inventing a number.

/** The columns the stats pipeline reads (also the shape `daysForStats` returns). */
export interface StatsDay {
  local_date: string
  morning_completed_at: string | null
  evening_completed_at: string | null
  /** Set on the "just wake me" path — counts as an active day (see below). */
  woke_at: string | null
  state: ReadinessState | null
  energy: number | null
  mood: number | null
  focus: number | null
  routine_minutes: number | null
  one_thing_slug: string | null
  completed_slugs: string[]
  /** The day's plan — its moves carry the estMinutes used to credit real time
   *  invested (see minutesDone). Null on older rows / a "just wake me" day. */
  plan: Plan | null
}

export type Metric = 'energy' | 'mood' | 'focus'
export type WeekStatus = 'done' | 'missed' | 'ahead'
export type GapKey = 'deficit' | 'aligned' | 'surplus'

export const METRICS: Metric[] = ['energy', 'mood', 'focus']
export const METRIC_LABEL: Record<Metric, string> = { energy: 'Energy', mood: 'Mood', focus: 'Focus' }

// ── Streak milestones ──────────────────────────────────────────────────────────
// Streak lengths worth a one-time celebration. Crossing one fires the celebration
// moment (see StreakCelebration); the last-celebrated value is persisted in prefs
// so it fires exactly once.
export const STREAK_MILESTONES = [1, 2, 3, 5, 7, 10, 14, 21, 30, 50, 75, 100, 150, 200, 365] as const

/**
 * The highest milestone the given streak has reached, or null if it hasn't reached
 * the first one. Returns the reached value (not exact-equality) so the celebration
 * still fires even if the user didn't open the app on the precise day — pair it
 * with a persisted "last celebrated" value to fire each milestone once.
 */
export function milestoneReached(streak: number): number | null {
  let reached: number | null = null
  for (const m of STREAK_MILESTONES) {
    if (streak >= m) reached = m
    else break
  }
  return reached
}

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const SHORT_WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] // index by getUTCDay()
// Week strip is Monday-first; doubled T/S initials are expected.
const WEEK_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export interface PatternCard {
  icon: string // a Feather glyph name; the screen casts it
  title: string
  body: string
}

export interface YouStats {
  /** Per metric, the recent reflection reads (oldest → newest), up to 14. */
  trend: Record<Metric, number[]>
  /** Date labels aligned to the trend series, for the chart scrub readout. */
  trendLabels: string[]
  /** "Energy is running 12% above the week before." — null when too sparse. */
  trendDelta: Record<Metric, string | null>
  /** True once there are ≥2 reflection points to actually draw a line. */
  hasTrend: boolean
  /** Reflections logged so far (drives the "N logged" copy when hasTrend is false). */
  reflectionCount: number
  streak: { current: number; best: number }
  /** Monday-first current week. */
  week: { initial: string; status: WeekStatus }[]
  /** Share of mornings arriving in each state, summing to 100. Null with no check-ins. */
  gapMix: { key: GapKey; pct: number }[] | null
  /** A one-line read on the gap mix, matched to the dominant state. */
  gapRead: string | null
  portfolio: {
    morningsBuilt: number
    timeInvested: string // "45m" | "3.2h"
    strongestDay: string // "Tue" | "—"
    followThrough: string // "86%" | "—"
  }
  /** Conservative, descriptive observations — empty until the data earns one. */
  patterns: PatternCard[]
}

// ── small date + math helpers (UTC, so no TZ drift in the day arithmetic) ──────

/** Whole-days-since-epoch for a "YYYY-MM-DD" string — for consecutive-run math. */
function dayIndex(d: string): number {
  const [y, m, day] = d.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, day) / 86_400_000)
}
function weekdayOf(d: string): number {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay()
}
function labelFor(d: string, today: string): string {
  if (d === today) return 'Today'
  const [, m, day] = d.split('-').map(Number)
  return `${SHORT_MONTHS[m - 1]} ${day}`
}
const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length

/**
 * A day's focal-point slug, or null when the row has no usable plan. `plan` is a
 * JSON column, so an older/hand-edited/corrupt row could be missing `oneThing` —
 * read it defensively so a single bad row can never crash the whole You page.
 */
function focalSlug(r: StatsDay): string | null {
  return r.one_thing_slug ?? null
}

/**
 * Minutes the user actually did on a morning: the estMinutes of the plan moves
 * they checked off (completed_slugs). This is the honest "time invested" — a
 * focal-only morning counts for less than a full sequence, and checking in
 * without doing a move counts for nothing. Falls back to the stored routine
 * budget only for older/corrupt rows with no usable plan, so their credit isn't
 * silently dropped.
 */
function minutesDone(r: StatsDay): number {
  const done = new Set(r.completed_slugs ?? [])
  const seq = r.plan?.sequence
  if (seq && seq.length > 0) {
    return seq.reduce((sum, a) => (done.has(a.slug) ? sum + (a.estMinutes ?? 0) : sum), 0)
  }
  return r.routine_minutes ?? 0
}

/** Time-invested display: minutes under an hour ("45m"), hours once past one
 *  ("3.2h") — small early totals read as real progress, no fake precision. */
function formatInvested(totalMin: number): string {
  if (totalMin < 60) return `${Math.max(0, Math.round(totalMin))}m`
  return `${(totalMin / 60).toFixed(1)}h`
}

/** Integer percentages that sum to exactly 100 (largest-remainder rounding). */
function toPercents(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0)
  if (total === 0) return counts.map(() => 0)
  const raw = counts.map((c) => (c / total) * 100)
  const out = raw.map(Math.floor)
  let remainder = 100 - out.reduce((a, b) => a + b, 0)
  const byFrac = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac)
  for (let k = 0; remainder > 0 && k < byFrac.length; k++, remainder--) out[byFrac[k].i]++
  return out
}

// ── the pure computation ───────────────────────────────────────────────────────

export function computeYouStats(rows: StatsDay[], today: string): YouStats {
  const todayIdx = dayIndex(today)

  // Activity = any check-in, reflection, OR a "just wake me" morning that day.
  // Waking well is the habit, so a woke-only day keeps the streak alive. (The
  // query already filters to these, but recomputing keeps the function honest in
  // isolation/tests.)
  const activeIdx = new Set(
    rows
      .filter((r) => r.morning_completed_at || r.evening_completed_at || r.woke_at)
      .map((r) => dayIndex(r.local_date)),
  )

  // ── Streak ──
  const sorted = [...activeIdx].sort((a, b) => a - b)
  let best = sorted.length ? 1 : 0
  let run = sorted.length ? 1 : 0
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1
    if (run > best) best = run
  }
  // Current streak counts back from today, or yesterday if today isn't logged yet
  // (so an un-logged today never reads as a broken streak before evening). One
  // "rest day" of forgiveness: a single missed day mid-run is bridged once, so a
  // hard-won streak doesn't collapse from a single miss. The rest day itself does
  // not count toward the number, and a two-day gap (or a second gap) still breaks
  // the run.
  let current = 0
  // Anchor the current run at today, else yesterday, else the day before — the last
  // case covers a still-alive run whose single grace day was yesterday's miss while
  // today is merely un-logged (not yet a miss). Pre-consuming grace there keeps a
  // hard-won streak from reading 0 all morning before the day's check-in.
  let anchor: number | null = null
  let preGrace = false
  if (activeIdx.has(todayIdx)) anchor = todayIdx
  else if (activeIdx.has(todayIdx - 1)) anchor = todayIdx - 1
  else if (activeIdx.has(todayIdx - 2)) {
    anchor = todayIdx - 2
    preGrace = true
  }
  if (anchor !== null) {
    let graceUsed = preGrace
    for (let i = anchor; ; i--) {
      if (activeIdx.has(i)) current++
      else if (!graceUsed && activeIdx.has(i - 1)) graceUsed = true // bridge one gap
      else break
    }
  }
  // A grace-extended live run can exceed the strict historical best; keep best the
  // longest run ever seen so "current" never reads as larger than "best".
  if (current > best) best = current

  // ── Week strip (Monday-first) ──
  const daysFromMonday = (weekdayOf(today) + 6) % 7
  const mondayIdx = todayIdx - daysFromMonday
  const week = WEEK_INITIALS.map((initial, i) => {
    const idx = mondayIdx + i
    let status: WeekStatus
    if (activeIdx.has(idx)) status = 'done'
    else if (idx >= todayIdx) status = 'ahead' // today (un-logged) or future
    else status = 'missed'
    return { initial, status }
  })

  // ── Trend (reflection reads, set together in the evening) ──
  const reflections = rows.filter(
    (r) => r.energy != null && r.mood != null && r.focus != null,
  )
  const recent = reflections.slice(-14)
  const trend: Record<Metric, number[]> = {
    energy: recent.map((r) => r.energy as number),
    mood: recent.map((r) => r.mood as number),
    focus: recent.map((r) => r.focus as number),
  }
  const trendLabels = recent.map((r) => labelFor(r.local_date, today))
  const trendDelta: Record<Metric, string | null> = {
    energy: deltaLine('energy', trend.energy),
    mood: deltaLine('mood', trend.mood),
    focus: deltaLine('focus', trend.focus),
  }

  // ── Gap mix ──
  const withState = rows.filter((r) => r.state != null)
  let gapMix: YouStats['gapMix'] = null
  let gapRead: string | null = null
  if (withState.length > 0) {
    const keys: GapKey[] = ['deficit', 'aligned', 'surplus']
    const counts = keys.map((k) => withState.filter((r) => r.state === k).length)
    const pcts = toPercents(counts)
    gapMix = keys.map((key, i) => ({ key, pct: pcts[i] }))
    // Dominant state drives the read; on a tie prefer 'aligned' (the steady,
    // non-alarming framing) rather than letting indexOf default to 'deficit'.
    const maxCount = Math.max(...counts)
    const dominant: GapKey = counts[1] === maxCount ? 'aligned' : keys[counts.indexOf(maxCount)]
    gapRead =
      dominant === 'aligned'
        ? "Most mornings, you're matched to what your day asks. The work now is closing the gap on the mornings you wake behind."
        : dominant === 'deficit'
          ? "You're often arriving behind what your day asks. Small morning wins are how that gap closes."
          : 'You frequently arrive with more than the day needs — momentum worth spending well.'
  }

  // ── Portfolio ──
  const mornings = rows.filter((r) => r.morning_completed_at)
  const morningsBuilt = mornings.length
  const totalMin = mornings.reduce((sum, r) => sum + minutesDone(r), 0)
  const timeInvested = formatInvested(totalMin)

  // Strongest weekday by average energy — only claimed with ≥3 reflections.
  let strongestDay = '—'
  if (reflections.length >= 3) {
    const byDay = new Map<number, number[]>()
    for (const r of reflections) {
      const wd = weekdayOf(r.local_date)
      byDay.set(wd, [...(byDay.get(wd) ?? []), r.energy as number])
    }
    // Only claim a strongest day when it's earned: the winner needs ≥2 samples and a
    // clear ≥0.5-point lead over the runner-up, so a single-reflection weekday is
    // never presented as a portfolio fact (which would erode trust in every stat).
    const ranked = [...byDay.entries()]
      .map(([wd, xs]) => ({ wd, n: xs.length, a: avg(xs) }))
      .sort((x, y) => y.a - x.a)
    const top = ranked[0]
    if (top && top.n >= 2 && (ranked.length < 2 || top.a - ranked[1].a >= 0.5)) {
      strongestDay = SHORT_WEEKDAYS[top.wd]
    }
  }

  // Follow-through: share of built mornings whose focal point got checked off.
  const withPlan = rows.filter((r) => focalSlug(r) != null)
  let followThrough = '—'
  if (withPlan.length > 0) {
    const done = withPlan.filter((r) => (r.completed_slugs ?? []).includes(focalSlug(r)!)).length
    followThrough = `${Math.round((done / withPlan.length) * 100)}%`
  }

  // ── Patterns (conservative; descriptive, never causal) ──
  const patterns = computePatterns(rows)

  return {
    trend,
    trendLabels,
    trendDelta,
    hasTrend: recent.length >= 2,
    reflectionCount: reflections.length,
    streak: { current, best },
    week,
    gapMix,
    gapRead,
    portfolio: { morningsBuilt, timeInvested, strongestDay, followThrough },
    patterns,
  }
}

/**
 * "<Metric> is running X% above/below the seven before." Null when too sparse.
 *
 * Compares the last 7 reflection reads against the 7 before them. Because users
 * skip days, those aren't guaranteed to be consecutive calendar weeks — so the
 * copy says "your previous seven," which is exactly what's measured, rather than
 * claiming a literal week-over-week comparison the gaps wouldn't support.
 */
function deltaLine(metric: Metric, series: number[]): string | null {
  // Need 8 reads so the prior window is a full four — enough to put a real, moving
  // number in front of a trial user, without claiming a week the gaps wouldn't support.
  if (series.length < 8) return null
  const recent = series.slice(-4)
  const prior = series.slice(-8, -4)
  const pct = Math.round(((avg(recent) - avg(prior)) / avg(prior)) * 100)
  const label = METRIC_LABEL[metric]
  if (pct >= 1) return `${label} is running ${pct}% above your previous four mornings.`
  if (pct <= -1) return `${label} is running ${Math.abs(pct)}% below your previous four mornings.`
  return `${label} is holding steady across your last eight.`
}

/**
 * One descriptive observation, only when the data clearly earns it: on mornings
 * the focal point is completed, is reported energy meaningfully higher? Requires
 * ≥3 days in each group and a ≥0.5-point gap. Phrased descriptively (same-day
 * association, not a causal claim). Returns [] otherwise — the screen then shows
 * an honest "still learning" card instead of inventing a pattern.
 */
function computePatterns(rows: StatsDay[]): PatternCard[] {
  const usable = rows.filter((r) => focalSlug(r) != null && r.energy != null)
  const doneEnergy: number[] = []
  const skipEnergy: number[] = []
  for (const r of usable) {
    const did = (r.completed_slugs ?? []).includes(focalSlug(r)!)
    ;(did ? doneEnergy : skipEnergy).push(r.energy as number)
  }
  if (doneEnergy.length < 3 || skipEnergy.length < 3) return []
  const lift = avg(doneEnergy) - avg(skipEnergy)
  if (lift < 0.5) return []
  return [
    {
      icon: 'trending-up',
      title: 'Your focal point pays off',
      body: `On mornings you complete your focal point, you report energy around ${avg(doneEnergy).toFixed(
        1,
      )} — about ${lift.toFixed(1)} higher than the mornings you skip it.`,
    },
  ]
}

/**
 * A short, real one-liner for the Today screen's insight slot — or null when the
 * data can't yet support an honest one. Same conservative basis as the You-page
 * pattern (focal-completion vs that day's energy): ≥3 days in each group and a
 * ≥0.5-point gap, phrased as a same-day association, never a causal claim.
 */
export function computeTodayInsight(rows: StatsDay[]): string | null {
  const usable = rows.filter((r) => focalSlug(r) != null && r.energy != null)
  const done: number[] = []
  const skip: number[] = []
  for (const r of usable) {
    ;((r.completed_slugs ?? []).includes(focalSlug(r)!) ? done : skip).push(r.energy as number)
  }
  if (done.length < 3 || skip.length < 3) return null
  const lift = avg(done) - avg(skip)
  if (lift < 0.5) return null
  return `Days you finish your focal point, your energy runs about ${lift.toFixed(1)} higher.`
}
