// The five morning "length" tiers the user picks in onboarding and the evening
// reflection — the single source of truth mapping them onto the numeric
// `routine_minutes` value every layer already stores.
//
// Two tiers aren't durations at all, so they're encoded as reserved sentinels
// inside routine_minutes (the `days` column allows 0–240, so both fit with no
// schema change). Everything else — plan generation, morning rendering, stats,
// the pickers — maps through the helpers here instead of hardcoding the numbers.
//
//   • 'alarm'  → just the voice alarm, no routine at all (the "just wake me"
//                path). Encoded as 0.
//   • 'focal'  → the alarm plus the single focal-point action, nothing more.
//                Encoded as 1.
//   • 5 / 10 / 15 → a full routine packed to that many minutes.
//
// Note: `profiles.routine_minutes` has a stricter CHECK (1–240) and is only a
// standing hint (never read for daily rendering), so writes there are clamped to
// ≥1 via profileRoutineHint(). The per-day row and the device pref carry the
// exact tier.

export type RoutineTier = 'alarm' | 'focal' | 5 | 10 | 15

/** Encoded routine_minutes value for the two non-duration tiers. */
export const ALARM_ONLY_MINUTES = 0
export const FOCAL_ONLY_MINUTES = 1

/** The real routine durations offered, capped per product at 15 minutes. */
export const MINUTE_TIERS = [5, 10, 15] as const
export const MAX_ROUTINE_MINUTES = 15

/** The default tier when nothing is stored yet (a full 15-minute routine). */
export const DEFAULT_TIER: RoutineTier = 15

/** Interpret a stored routine_minutes into its tier. Unknown/legacy values snap
 *  to the nearest supported minute tier, capping anything over 15 down to 15. */
export function tierFromMinutes(minutes: number | null | undefined): RoutineTier {
  if (minutes == null) return DEFAULT_TIER
  if (minutes <= ALARM_ONLY_MINUTES) return 'alarm'
  if (minutes === FOCAL_ONLY_MINUTES) return 'focal'
  if (minutes <= 7) return 5 // 2–7 (incl. legacy sub-5) → 5
  if (minutes <= 12) return 10 // 8–12 → 10
  return 15 // 13+ (incl. legacy 20/30/60) → capped at 15
}

/** The routine_minutes value to store for a tier. */
export function minutesForTier(tier: RoutineTier): number {
  if (tier === 'alarm') return ALARM_ONLY_MINUTES
  if (tier === 'focal') return FOCAL_ONLY_MINUTES
  return tier
}

/** True when the stored value means "just the alarm, no routine". */
export function isAlarmOnly(minutes: number | null | undefined): boolean {
  return tierFromMinutes(minutes) === 'alarm'
}

/** True when the stored value means "alarm + the single focal-point action". */
export function isFocalOnly(minutes: number | null | undefined): boolean {
  return tierFromMinutes(minutes) === 'focal'
}

/**
 * The minute budget to feed the plan generator. For the two non-duration tiers we
 * still want a well-formed plan (a strong focal point in particular), so they map
 * to a full budget — the morning simply renders less of the result (nothing for
 * 'alarm', only the focal point for 'focal').
 */
export function planBudgetForTier(minutes: number | null | undefined): number {
  const tier = tierFromMinutes(minutes)
  if (tier === 'alarm' || tier === 'focal') return 15
  return tier
}

/** A short display label for the routine tier ("Alarm only", "Focal only", "10 min"). */
export function tierShortLabel(minutes: number | null | undefined): string {
  const tier = tierFromMinutes(minutes)
  if (tier === 'alarm') return 'Alarm only'
  if (tier === 'focal') return 'Focal only'
  return `${tier} min`
}

/** Sanitize a tier value for the profiles.routine_minutes hint (CHECK 1–240). The
 *  profile hint can't hold the alarm-only 0, and doesn't need to distinguish the
 *  two non-duration tiers — the per-day row and the pref carry the exact choice. */
export function profileRoutineHint(minutes: number): number {
  return Math.max(1, Math.round(minutes))
}

/** One option row for the tier chooser. `requiresAlarm` tiers vanish when the
 *  voice alarm toggle is off (they're meaningless without an alarm). */
export type TierOption = {
  tier: RoutineTier
  label: string
  sub: string
  requiresAlarm: boolean
}

/** The chooser options, in the product's order: alarm-dependent tiers first, then
 *  the real routine lengths ascending. */
export const TIER_OPTIONS: TierOption[] = [
  { tier: 'alarm', label: 'Alarm only', sub: 'Just wake me — no routine.', requiresAlarm: true },
  { tier: 'focal', label: 'Alarm + one action', sub: 'Wake, then one high-impact action.', requiresAlarm: true },
  { tier: 5, label: '5 minutes', sub: 'A quick, essential routine.', requiresAlarm: false },
  { tier: 10, label: '10 minutes', sub: 'A fuller morning.', requiresAlarm: false },
  { tier: 15, label: '15 minutes', sub: 'The complete routine.', requiresAlarm: false },
]
