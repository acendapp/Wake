import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { AppState, Platform } from 'react-native'
import { AUTH_STORAGE_KEY, supabase } from './supabase'

// App-wide auth state, backed by Supabase. The session is restored from
// AsyncStorage on launch (see supabase.ts) and kept live via onAuthStateChange,
// so the root layout can gate routes on it. Email + password — social/Apple
// sign-in waits for a dev build (Expo Go can't load the native modules).

type SignUpResult = { error: string | null; needsConfirmation: boolean }

type AuthContextValue = {
  session: Session | null
  /** True until the first session check resolves — hold the splash until then. */
  initializing: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<SignUpResult>
  /** Send a password-reset email. Errors surface as a message, null on success. */
  resetPassword: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  /** Permanently delete the account + all data, then clear the local session. */
  deleteAccount: () => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Map the most common Supabase auth errors to friendlier copy, falling back to
// the raw message for anything unrecognized (better a real cause than a generic
// wall). Matched on the stable substrings Supabase returns.
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials'))
    return 'That email or password doesn’t match. Please try again.'
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'An account with this email already exists. Try signing in instead.'
  if (m.includes('email not confirmed'))
    return 'Please confirm your email, then sign in.'
  if (m.includes('network') || m.includes('failed to fetch'))
    return 'Couldn’t reach the server. Check your connection and try again.'
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setInitializing(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    // Supabase's token auto-refresh timer must be paused while the app is
    // backgrounded and resumed (with an immediate refresh) on foreground —
    // otherwise a session can lapse while backgrounded and the next request 401s.
    // This is the documented React Native wiring; web manages this itself.
    let appStateSub: { remove: () => void } | undefined
    if (Platform.OS !== 'web') {
      supabase.auth.startAutoRefresh()
      appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active') supabase.auth.startAutoRefresh()
        else supabase.auth.stopAutoRefresh()
      })
    }

    return () => {
      active = false
      sub.subscription.unsubscribe()
      appStateSub?.remove()
    }
  }, [])

  const value: AuthContextValue = {
    session,
    initializing,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: error ? friendlyAuthError(error.message) : null }
    },
    signUp: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) return { error: friendlyAuthError(error.message), needsConfirmation: false }
      // When the project requires email confirmation, signUp returns no session.
      return { error: null, needsConfirmation: data.session === null }
    },
    resetPassword: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      return { error: error ? friendlyAuthError(error.message) : null }
    },
    signOut: async () => {
      // Signing out must always work from this device's point of view. Supabase's
      // signOut() keeps the local session whenever the server-side revocation
      // fails (offline, an expired/invalid stored session, a slow network) — which
      // would make a Sign out button appear to do nothing. So: best-effort
      // revocation with a deadline, then a guaranteed local clear.
      const revoke = supabase.auth
        .signOut({ scope: 'local' })
        .catch((e: unknown) => ({ error: e }))
      const deadline = new Promise<{ error: Error }>((resolve) =>
        setTimeout(() => resolve({ error: new Error('Sign out timed out') }), 4000),
      )
      const { error } = await Promise.race([revoke, deadline])
      if (!error) return // success — the SIGNED_OUT event clears `session`

      // Revocation failed or timed out: clear the persisted session ourselves and
      // drop the in-memory one so the root gate navigates away immediately.
      try {
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY)
      } catch {
        // Best-effort; the in-memory clear below still signs this session out.
      }
      setSession(null)
    },
    deleteAccount: async () => {
      // The Edge Function deletes the auth user (cascade purges profiles + days),
      // identifying the caller from their own token. On success the session is dead,
      // so clear it locally and drop in-memory state — the gate routes back to onboarding.
      const { error } = await supabase.functions.invoke('delete-account')
      if (error) {
        return { error: friendlyAuthError(error.message ?? 'Could not delete your account.') }
      }
      try {
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY)
      } catch {
        // Best-effort; the in-memory clear below still ends this session.
      }
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      setSession(null)
      return { error: null }
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
