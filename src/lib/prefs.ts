import AsyncStorage from '@react-native-async-storage/async-storage'

// Lightweight, device-local user preferences. Distinct from the per-day `days`
// rows (Supabase): these are standing defaults that have no home in the schema
// yet and will later be seeded by onboarding/settings. Best-effort — every read
// falls back to a sane default so a storage hiccup never blocks the ritual.

const ROUTINE_MINUTES_KEY = 'wake.preferredRoutineMinutes'

/** The out-of-the-box morning-routine length, before the user has set their own. */
export const DEFAULT_ROUTINE_MINUTES = 15

/** The user's standing preferred routine length, in minutes. */
export async function getPreferredRoutineMinutes(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(ROUTINE_MINUTES_KEY)
    const n = raw == null ? NaN : Number(raw)
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_ROUTINE_MINUTES
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
