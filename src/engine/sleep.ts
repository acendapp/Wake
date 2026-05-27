import type { SleepPlan } from './types'

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

// The readiness app's sleep stance: a light day is fine on ~7h, a relentless one
// wants ~8.5h, and demand maps linearly between. We round the target to the
// nearest quarter-hour so the prescribed bedtime lands on a clean clock time.
const MIN_HOURS = 7
const MAX_HOURS = 8.5

/** Parse "HH:MM" (24h) into minutes past midnight. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) {
    throw new Error(`Invalid time "${hhmm}" — expected "HH:MM"`)
  }
  return h * 60 + m
}

/** Format minutes past midnight (any sign / magnitude) back to "HH:MM" 24h. */
function toClock(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440 // handle crossing midnight
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Recommend tonight's sleep from tomorrow's demand and the wake time.
 * Pure and deterministic. `wakeTime` is "HH:MM" (24h); the returned `bedtime`
 * is the same format, wrapped correctly when it falls before midnight.
 */
export function recommendSleep(tomorrowDemand: number, wakeTime: string): SleepPlan {
  const demand = clamp(Math.round(tomorrowDemand), 1, 10)
  const raw = MIN_HOURS + ((demand - 1) / 9) * (MAX_HOURS - MIN_HOURS)
  const targetHours = Math.round(raw * 4) / 4 // nearest 15 minutes
  const bedtime = toClock(toMinutes(wakeTime) - targetHours * 60)
  return { targetHours, bedtime, wakeTime }
}
