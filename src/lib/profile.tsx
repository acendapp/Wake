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
  onboarding_completed_at: string | null
  created_at: string
}

/** The answers first-run onboarding collects. The demographics are optional. */
export type OnboardingInput = {
  intent: Intent
  chronotype: Chronotype
  frictionPoint: FrictionPoint
  routineMinutes: number
  constraints?: string[]
  ageRange?: AgeRange | null
  sex?: Sex | null
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
        intent: input.intent,
        chronotype: input.chronotype,
        friction_point: input.frictionPoint,
        routine_minutes: input.routineMinutes,
        constraints: input.constraints ?? [],
        age_range: input.ageRange ?? null,
        sex: input.sex ?? null,
        onboarding_completed_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
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
    getProfile()
      .then((p) => {
        if (gen !== fetchGen.current) return
        setProfile(p)
        setLoadedFor(uid)
      })
      .catch(() => {
        if (gen !== fetchGen.current) return
        setProfile(null)
        setLoadedFor(uid)
      })
  }, [uid])

  const refresh = useCallback(async () => {
    if (uid === null) return
    const gen = ++fetchGen.current
    const p = await getProfile()
    if (gen !== fetchGen.current) return
    setProfile(p)
    setLoadedFor(uid)
  }, [uid])

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
