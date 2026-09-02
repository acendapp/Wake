// The app's clock model. Two ideas:
//
//  1. The day tips into "evening" at EVENING_HOUR: Reflect unlocks, and Today
//     stops prompting the morning check-in (pivoting to "set up tomorrow").
//  2. The day doesn't end at midnight — it ends at DAY_ROLLOVER_HOUR (3am).
//     People reflect after midnight; a 1am reflection belongs to the day being
//     finished, not the calendar date that just started. Everything that reads
//     or writes "today's" row goes through logicalNow()/logicalDate() so the
//     whole app rolls over together at 3am sharp.
//
// Both are shared so no two screens ever disagree. Tunable; will later key off
// the user's own schedule.

export const EVENING_HOUR = 17

/** The local hour the app's "day" actually rolls over (not midnight). */
export const DAY_ROLLOVER_HOUR = 3

/**
 * The Date whose calendar day the app considers "today". Until 3am, that's
 * still yesterday's date — shift the clock back by the rollover and let the
 * calendar fall where it lands.
 */
export function logicalNow(now = new Date()): Date {
  return new Date(now.getTime() - DAY_ROLLOVER_HOUR * 60 * 60 * 1000)
}

/** True during the evening window: EVENING_HOUR through the 3am rollover. */
export function isEveningNow(now = new Date()): boolean {
  const h = now.getHours()
  return h >= EVENING_HOUR || h < DAY_ROLLOVER_HOUR
}

/**
 * Whole days (rounded up) until an ISO timestamp — 0 once it has passed. Drives
 * countdown copy like the promo-grace banner: 6.2 days out reads "in 7 days",
 * under 24h reads "tomorrow"/"today" at the caller's discretion.
 */
export function daysUntil(iso: string, nowMs = Date.now()): number {
  const target = new Date(iso).getTime()
  if (!Number.isFinite(target)) return 0
  return Math.max(0, Math.ceil((target - nowMs) / 86_400_000))
}
