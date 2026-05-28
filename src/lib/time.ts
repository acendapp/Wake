// The local hour at which the day tips into "evening": Reflect unlocks, and Today
// stops prompting the morning check-in (pivoting to "set up tomorrow"). Shared by
// both screens so the gate and the pivot never disagree. Tunable; will later key
// off the user's own schedule.
export const EVENING_HOUR = 17
