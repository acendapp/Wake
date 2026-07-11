import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './auth'
import { profileRoutineHint } from './routineTier'
import { supabase } from './supabase'

// The standing per-user profile (`public.profiles`) — the signals captured at
// first-run onboarding. Unlike the per-day `days` rows, these change rarely; they
// seed the (future) personalized morning routine, which reads them server-side.
// The provider loads the row once per session so the root layout can gate
// first-run onboarding on `onboarding_completed_at`.

export type Intent = 'calm' | 'energize' | 'focus'
export type Chronotype = 'early' | 'late' | 'neither'
export type FitnessLevel = 'low' | 'moderate' | 'high'
/** Where the user's mornings tend to break down — which phase to brace for. */
export type FrictionPoint = 'before_up' | 'getting_ready' | 'out_world' | 'all_morning'
export type AgeRange = 'under_25' | '25_34' | '35_44' | '45_54' | '55_plus'
export type Sex = 'female' | 'male' | 'other'

/** Row shape of `public.profiles` (snake_case, as Postgres returns it). */
export type ProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  timezone: string | null
  mode: string | null
  goals: string[]
  intent: Intent | null
  chronotype: Chronotype | null
  fitness_level: FitnessLevel | null
  friction_point: FrictionPoint | null
  routine_minutes: number | null
  constraints: string[]
  age_range: AgeRange | null
  sex: Sex | null
  /** Whether the user wants Wake's voice alarm to wake them. */
  wake_enabled: boolean
  /** Local wall-clock wake time "HH:MM" (24h), or null until set. */
  wake_time: string | null
  /** The chosen alarm voice id (see VOICES in alarmCore). */
  wake_voice: string
  onboarding_completed_at: string | null
  created_at: string
}

/** The answers first-run onboarding collects. The demographics are optional. */
export type OnboardingInput = {
  firstName: string
  lastName?: string | null
  intent: Intent
  chronotype: Chronotype
  frictionPoint?: FrictionPoint | null
  routineMinutes: number
  constraints?: string[]
  ageRange?: AgeRange | null
  sex?: Sex | null
  /** Voice-alarm opt-in + the time to wake, collected in onboarding. */
  wakeEnabled?: boolean
  wakeTime?: string | null
  wakeVoice?: string
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Not signed in')
  return data.user.id
}

/** Read the signed-in user's profile row, or null if it doesn't exist yet. */
export async function getProfile(): Promise<ProfileRow | null> {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as ProfileRow) ?? null
}

/**
 * Write the onboarding answers and stamp completion. Upserts on `id` in case the
 * signup trigger hasn't created the row yet. `routine_minutes` is the canonical,
 * server-readable time-available value; callers also seed the device-local
 * default (see src/lib/prefs.ts) so the evening routine stepper agrees.
 */
export async function saveOnboarding(input: OnboardingInput): Promise<ProfileRow> {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        first_name: input.firstName,
        last_name: input.lastName ?? null,
        intent: input.intent,
        chronotype: input.chronotype,
        friction_point: input.frictionPoint ?? null,
        // Standing hint only (CHECK 1–240): clamp the alarm-only 0 up to 1. The
        // per-day row + device pref carry the exact tier (see routineTier.ts).
        routine_minutes: profileRoutineHint(input.routineMinutes),
        constraints: input.constraints ?? [],
        age_range: input.ageRange ?? null,
        sex: input.sex ?? null,
        wake_enabled: input.wakeEnabled ?? false,
        wake_time: input.wakeTime ?? null,
        ...(input.wakeVoice ? { wake_voice: input.wakeVoice } : {}),
        onboarding_completed_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .select()
    .single()
  if (error) throw error
  return data as ProfileRow
}

/**
 * Patch a subset of the signed-in user's standing signals (the Morning signals
 * settings screen). Only the provided fields are written; the row already exists
 * for any onboarded user. These feed the personalization layer, so changing them
 * shapes the next routine.
 */
export async function updateProfile(patch: {
  intent?: Intent
  chronotype?: Chronotype
  routineMinutes?: number
  wakeEnabled?: boolean
  wakeTime?: string | null
  wakeVoice?: string
}): Promise<ProfileRow> {
  const userId = await currentUserId()
  const dbPatch: Record<string, unknown> = {}
  if (patch.intent !== undefined) dbPatch.intent = patch.intent
  if (patch.chronotype !== undefined) dbPatch.chronotype = patch.chronotype
  if (patch.routineMinutes !== undefined) dbPatch.routine_minutes = profileRoutineHint(patch.routineMinutes)
  if (patch.wakeEnabled !== undefined) dbPatch.wake_enabled = patch.wakeEnabled
  if (patch.wakeTime !== undefined) dbPatch.wake_time = patch.wakeTime
  if (patch.wakeVoice !== undefined) dbPatch.wake_voice = patch.wakeVoice
  const { data, error } = await supabase
    .from('profiles')
    .update(dbPatch)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data as ProfileRow
}

// ── provider ─────────────────────────────────────────────────────────────────

type ProfileContextValue = {
  profile: ProfileRow | null
  /** True while a signed-in user's profile is still being loaded. */
  loading: boolean
  /** Re-read the row (e.g. right after onboarding writes completion). */
  refresh: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const uid = session?.user.id ?? null
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  // Bumped by every load path; an in-flight read whose generation is stale when
  // it resolves is discarded. This makes a post-save refresh() authoritative
  // even if the session-change auto-fetch resolves after it — which happens when
  // the account is created mid-onboarding (sign-up fires the fetch, then we save
  // and refresh). Without this, the stale fetch could clobber the saved profile
  // and bounce the user back into onboarding.
  const fetchGen = useRef(0)

  // Derived so there's no stale-false window: a signed-in user whose profile we
  // haven't loaded for *this* uid is "loading". On sign-in `loadedFor` still
  // holds the previous value, so `loading` flips true in the same render the
  // session changes — the root gate never sees a signed-in user with a null
  // profile and wrongly bounces them into onboarding.
  const loading = uid !== null && loadedFor !== uid

  useEffect(() => {
    if (uid === null) {
      fetchGen.current++
      setProfile(null)
      setLoadedFor(null)
      return
    }
    const gen = ++fetchGen.current
    let cancelled = false
    const stale = () => cancelled || gen !== fetchGen.current
    ;(async () => {
      // Retry transient failures (a network blip at launch). Critically, a fetch
      // ERROR is never treated as an empty profile: nulling it here would make the
      // root gate read an onboarded user as "not onboarded" and bounce them back
      // into onboarding. So on success we set the profile; on persistent failure
      // we only mark this uid loaded (to release the splash) and leave any prior
      // profile intact — we never overwrite a real profile with null on error.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const p = await getProfile()
          if (stale()) return
          setProfile(p)
          setLoadedFor(uid)
          return
        } catch {
          if (stale()) return
          if (attempt < 2) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
        }
      }
      if (stale()) return
      setLoadedFor(uid)
    })()
    return () => {
      cancelled = true
    }
  }, [uid])

  // Resolves the signed-in user at call time (not from the closure): callers that
  // captured `refresh` before signing up — onboarding creates the account and then
  // refreshes in the same async flow — would otherwise hold a stale `uid === null`
  // no-op, leaving the gate waiting on a profile fetch that never comes.
  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    const currentUid = data.session?.user.id ?? null
    if (currentUid === null) return
    const gen = ++fetchGen.current
    // Mirror the session-load effect: retry transient failures and never throw —
    // refresh() is awaited inside the onboarding save flow, so an unguarded reject
    // here would surface as an unhandled rejection right after a successful save.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const p = await getProfile()
        if (gen !== fetchGen.current) return
        setProfile(p)
        setLoadedFor(currentUid)
        return
      } catch {
        if (gen !== fetchGen.current) return
        if (attempt < 2) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
      }
    }
    // Persisted failure: release the gate for this uid; the profile re-reads on the
    // next session-change or screen visit rather than leaving the splash hung.
    if (gen === fetchGen.current) setLoadedFor(currentUid)
  }, [])

  return (
    <ProfileContext.Provider value={{ profile, loading, refresh }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider')
  return ctx
}
