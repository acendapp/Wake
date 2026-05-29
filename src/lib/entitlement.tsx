import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { useAuth } from './auth'

// Subscription entitlement — whether the user has unlocked the app past the
// paywall. THIS IS A MOCK. There is no real billing yet: `grant()` simply flips
// a device-local flag so the rest of the flow (and the root gate) can be built
// and tested in Expo Go. When real billing lands (RevenueCat / StoreKit, which
// require a dev build), swap getEntitled/grant for the real entitlement check —
// the provider's shape and every caller stay the same.
//
// The flag is cleared on sign-out (see the effect) so a fresh sign-up always
// lands back on the paywall — handy for iterating on it. A real entitlement
// would instead be restored from the store on sign-in.

const ENTITLED_KEY = 'wake.entitled'

async function getEntitled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ENTITLED_KEY)) === 'true'
  } catch {
    return false
  }
}

async function setEntitledStored(value: boolean): Promise<void> {
  try {
    if (value) await AsyncStorage.setItem(ENTITLED_KEY, 'true')
    else await AsyncStorage.removeItem(ENTITLED_KEY)
  } catch {
    // Best-effort; a storage hiccup just means the paywall shows again.
  }
}

type EntitlementContextValue = {
  /** True once the user may pass the paywall (real grant or a dev bypass). */
  entitled: boolean
  /** True while a signed-in user's entitlement is still loading. */
  loading: boolean
  /** Mark the user entitled (mock "purchase"). Persists across launches. */
  grant: () => Promise<void>
  /** Dev-only, in-memory pass. Not persisted, so a relaunch re-shows the paywall. */
  bypass: () => void
}

const EntitlementContext = createContext<EntitlementContextValue | undefined>(undefined)

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const uid = session?.user.id ?? null
  const [entitled, setEntitled] = useState(false)
  const [devBypassed, setDevBypassed] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  // Mirrors ProfileProvider: a signed-in user we haven't loaded for *this* uid
  // is still "loading", so the gate never flashes the wrong screen.
  const loading = uid !== null && loadedFor !== uid

  useEffect(() => {
    let active = true
    if (uid === null) {
      // Signed out — reset the mock so the next sign-up sees the paywall again.
      setEntitled(false)
      setDevBypassed(false)
      setLoadedFor(null)
      void setEntitledStored(false)
      return
    }
    getEntitled().then((v) => {
      if (!active) return
      setEntitled(v)
      setLoadedFor(uid)
    })
    return () => {
      active = false
    }
  }, [uid])

  const grant = useCallback(async () => {
    await setEntitledStored(true)
    setEntitled(true)
  }, [])

  const bypass = useCallback(() => setDevBypassed(true), [])

  return (
    <EntitlementContext.Provider
      value={{ entitled: entitled || devBypassed, loading, grant, bypass }}
    >
      {children}
    </EntitlementContext.Provider>
  )
}

export function useEntitlement() {
  const ctx = useContext(EntitlementContext)
  if (!ctx) throw new Error('useEntitlement must be used within an EntitlementProvider')
  return ctx
}
