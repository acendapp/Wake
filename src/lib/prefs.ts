import AsyncStorage from '@react-native-async-storage/async-storage'

// Lightweight, device-local user preferences. Distinct from the per-day `days`
// rows (Supabase): these are standing defaults that have no home in the schema
// yet and will later be seeded by onboarding/settings. Best-effort — every read
// falls back to a sane default so a storage hiccup never blocks the ritual.

const ROUTINE_MINUTES_KEY = 'wake.preferredRoutineMinutes'

/** The out-of-the-box morning-routine length, before the user has set their own. */
export const DEFAULT_ROUTINE_MINUTES = 15

/**
 * The user's standing preferred routine length, as an encoded routine-tier value
 * (see src/lib/routineTier.ts): 0 = alarm only, 1 = alarm + focal action, or the
 * minutes for a full routine. Stored raw; callers interpret it via tierFromMinutes.
 */
export async function getPreferredRoutineMinutes(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(ROUTINE_MINUTES_KEY)
    const n = raw == null ? NaN : Number(raw)
    // Allow 0 (the alarm-only tier); only a missing/negative/NaN value falls back.
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_ROUTINE_MINUTES
  } catch {
    return DEFAULT_ROUTINE_MINUTES
  }
}

/** Remember the routine length the user last chose as their new default. */
export async function setPreferredRoutineMinutes(minutes: number): Promise<void> {
  try {
    await AsyncStorage.setItem(ROUTINE_MINUTES_KEY, String(minutes))
  } catch {
    // Best-effort: the per-day value still persists to the row even if this fails.
  }
}

const CELEBRATED_MILESTONE_KEY = 'wake.celebratedStreakMilestone'

/** The highest streak milestone we've already shown the celebration for, so the
 *  moment fires exactly once. 0 when none has been celebrated yet. */
export async function getCelebratedMilestone(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(CELEBRATED_MILESTONE_KEY)
    const n = raw == null ? 0 : Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

/** Record the milestone just celebrated so it never fires again. */
export async function setCelebratedMilestone(milestone: number): Promise<void> {
  try {
    await AsyncStorage.setItem(CELEBRATED_MILESTONE_KEY, String(milestone))
  } catch {
    // Best-effort: worst case the celebration could re-show once.
  }
}
