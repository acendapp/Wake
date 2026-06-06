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
  state: ReadinessState | null
  energy: number | null
  mood: number | null
  focus: number | null
  routine_minutes: number | null
  plan: Plan | null
  completed_slugs: string[]
}

export type Metric = 'energy' | 'mood' | 'focus'
export type WeekStatus = 'done' | 'missed' | 'ahead'
export type GapKey = 'deficit' | 'aligned' | 'surplus'

export const METRICS: Metric[] = ['energy', 'mood', 'focus']
export const METRIC_LABEL: Record<Metric, string> = { energy: 'Energy', mood: 'Mood', focus: 'Focus' }

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
    hoursInvested: string // "7.2h"
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

  // Activity = any check-in or reflection that day. (The query already filters to
  // these, but recomputing keeps the function honest in isolation/tests.)
  const activeIdx = new Set(
    rows
      .filter((r) => r.morning_completed_at || r.evening_completed_at)
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
  // (so an un-logged today never reads as a broken streak before evening).
  let current = 0
  const anchor = activeIdx.has(todayIdx) ? todayIdx : activeIdx.has(todayIdx - 1) ? todayIdx - 1 : null
  if (anchor !== null) {
    for (let i = anchor; activeIdx.has(i); i--) current++
  }

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
    const dominant = keys[counts.indexOf(Math.max(...counts))]
    gapRead =
      dominant === 'aligned'
        ? "Most mornings, you're matched to what your day asks. The work now is turning deficits into alignment."
        : dominant === 'deficit'
          ? "You're often arriving behind what your day asks. Small morning wins are how that gap closes."
          : 'You frequently arrive with more than the day needs — momentum worth spending well.'
  }

  // ── Portfolio ──
  const mornings = rows.filter((r) => r.morning_completed_at)
  const morningsBuilt = mornings.length
  const totalMin = mornings.reduce((sum, r) => sum + (r.routine_minutes ?? 0), 0)
  const hoursInvested = totalMin === 0 ? '0h' : `${(totalMin / 60).toFixed(1)}h`

  // Strongest weekday by average energy — only claimed with ≥3 reflections.
  let strongestDay = '—'
  if (reflections.length >= 3) {
    const byDay = new Map<number, number[]>()
    for (const r of reflections) {
      const wd = weekdayOf(r.local_date)
      byDay.set(wd, [...(byDay.get(wd) ?? []), r.energy as number])
    }
    let bestDay = -1
    let bestAvg = -Infinity
    for (const [wd, xs] of byDay) {
      const a = avg(xs)
      if (a > bestAvg) {
        bestAvg = a
        bestDay = wd
      }
    }
    if (bestDay >= 0) strongestDay = SHORT_WEEKDAYS[bestDay]
  }

  // Follow-through: share of built mornings whose focal point got checked off.
  const withPlan = rows.filter((r) => r.plan != null)
  let followThrough = '—'
  if (withPlan.length > 0) {
    const done = withPlan.filter((r) =>
      (r.completed_slugs ?? []).includes((r.plan as NonNullable<StatsDay['plan']>).oneThing.slug),
    ).length
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
    portfolio: { morningsBuilt, hoursInvested, strongestDay, followThrough },
    patterns,
  }
}

/** "<Metric> is running X% above/below the week before." Null when too sparse. */
function deltaLine(metric: Metric, series: number[]): string | null {
  // Need two full 7-day weeks to honestly compare "this week vs the week before".
  // Below 14 points the prior window would be a partial week, making the % a lie.
  if (series.length < 14) return null
  const recent = series.slice(-7)
  const prior = series.slice(-14, -7)
  const pct = Math.round(((avg(recent) - avg(prior)) / avg(prior)) * 100)
  const label = METRIC_LABEL[metric]
  if (pct >= 1) return `${label} is running ${pct}% above the week before.`
  if (pct <= -1) return `${label} is running ${Math.abs(pct)}% below the week before.`
  return `${label} is holding steady week to week.`
}

/**
 * One descriptive observation, only when the data clearly earns it: on mornings
 * the focal point is completed, is reported energy meaningfully higher? Requires
 * ≥3 days in each group and a ≥0.5-point gap. Phrased descriptively (same-day
 * association, not a causal claim). Returns [] otherwise — the screen then shows
 * an honest "still learning" card instead of inventing a pattern.
 */
function computePatterns(rows: StatsDay[]): PatternCard[] {
  const usable = rows.filter((r) => r.plan != null && r.energy != null)
  const doneEnergy: number[] = []
  const skipEnergy: number[] = []
  for (const r of usable) {
    const focal = (r.plan as NonNullable<StatsDay['plan']>).oneThing.slug
    const did = (r.completed_slugs ?? []).includes(focal)
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
  const usable = rows.filter((r) => r.plan != null && r.energy != null)
  const done: number[] = []
  const skip: number[] = []
  for (const r of usable) {
    const focal = (r.plan as NonNullable<StatsDay['plan']>).oneThing.slug
    ;((r.completed_slugs ?? []).includes(focal) ? done : skip).push(r.energy as number)
  }
  if (done.length < 3 || skip.length < 3) return null
  const lift = avg(done) - avg(skip)
  if (lift < 0.5) return null
  return `Days you finish your focal point, your energy runs about ${lift.toFixed(1)} higher.`
}
