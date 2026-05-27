import { EVENING_LIBRARY } from './eveningLibrary'
import type { WindDownStep } from './types'

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

// The harder tomorrow looks, the more deliberately we protect tonight — so the
// wind-down grows from a light 3 steps to a full 5 as demand climbs. Mirrors the
// morning plan, where a deficit day also earns a longer sequence.
function lengthForDemand(demand: number): number {
  if (demand >= 8) return 5
  if (demand >= 5) return 4
  return 3
}

/**
 * Build tonight's wind-down from tomorrow's demand. Pure and deterministic:
 * the top-priority moves, as many as the demand warrants, highest first.
 */
export function windDownSequence(tomorrowDemand: number): WindDownStep[] {
  const demand = clamp(Math.round(tomorrowDemand), 1, 10)
  const ranked = [...EVENING_LIBRARY].sort((a, b) => b.priority - a.priority)
  return ranked.slice(0, lengthForDemand(demand))
}
