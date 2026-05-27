// Small, dependency-free clock helpers shared by the Reflect ritual. All times
// are "HH:MM" 24h strings; display formatting to 12h happens at the edge.

// The local hour at which the day tips into "evening": Reflect unlocks, and Today
// stops prompting the morning check-in (pivoting to "set up tomorrow"). Shared by
// both screens so the gate and the pivot never disagree. Tunable; will later key
// off the user's own leave-by/bedtime.
export const EVENING_HOUR = 17


/** Shift an "HH:MM" time by a signed number of minutes, wrapping past midnight. */
export function shiftClock(hhmm: string, deltaMinutes: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = (((h * 60 + m + deltaMinutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Format "HH:MM" 24h as a friendly 12h string, e.g. "06:30" -> "6:30 AM". */
export function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

/** Render a quarter-hour duration like 7.75 as "7h 45m" (or "8h" when even). */
export function formatHours(hours: number): string {
  const whole = Math.floor(hours)
  const mins = Math.round((hours - whole) * 60)
  return mins === 0 ? `${whole}h` : `${whole}h ${mins}m`
}
