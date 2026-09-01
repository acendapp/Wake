import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AppState } from 'react-native'

import { useAuth } from './auth'
import {
  isBillingConfigured,
  isEntitled as billingIsEntitled,
  logInBilling,
  logOutBilling,
  purchasePlan,
  restorePurchases,
  subscribeEntitlement,
  type PlanId,
} from './billing'

// Subscription entitlement — whether the user has unlocked the app past the
// paywall.
//
// TIERED, like the alarm: when RevenueCat is configured (an API key is set AND the
// native module is present), the entitlement is the real "premium" entitlement
// from the store. Otherwise it falls back to a device-local MOCK so the whole flow
// (paywall → gate → tabs) still works in Expo Go and in key-less testing.
//
// The mock flag is cleared on sign-out so a fresh sign-up always lands back on the
// paywall — handy for iterating. Real billing instead restores from the store on
// sign-in (logInBilling + isEntitled).

const ENTITLED_KEY = 'wake.entitled'

async function getMockEntitled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ENTITLED_KEY)) === 'true'
  } catch {
    return false
  }
}

async function setMockEntitled(value: boolean): Promise<void> {
  try {
    if (value) await AsyncStorage.setItem(ENTITLED_KEY, 'true')
    else await AsyncStorage.removeItem(ENTITLED_KEY)
  } catch {
    // Best-effort; a storage hiccup just means the paywall shows again.
  }
}

// The last entitlement a real store check confirmed, persisted so a transient
// RevenueCat/network error (e.g. an offline reinstall before the SDK has cached
// CustomerInfo) fails OPEN for a previously-paid user instead of bouncing them to
// the paywall. Cleared on sign-out.
const LAST_ENTITLED_KEY = 'wake.lastEntitled'

async function getLastEntitled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(LAST_ENTITLED_KEY)) === 'true'
  } catch {
    return false
  }
}

async function setLastEntitled(value: boolean): Promise<void> {
  try {
    if (value) await AsyncStorage.setItem(LAST_ENTITLED_KEY, 'true')
    else await AsyncStorage.removeItem(LAST_ENTITLED_KEY)
  } catch {
    // Best-effort.
  }
}

type EntitlementContextValue = {
  /** True once the user may pass the paywall (real entitlement, mock, or dev bypass). */
  entitled: boolean
  /** True while a signed-in user's entitlement is still loading. */
  loading: boolean
  /** Purchase a plan. Returns true if the user ends up entitled. With real billing
   *  this runs the store flow; without a key it flips the mock so testing flows. */
  purchase: (plan: PlanId) => Promise<boolean>
  /** Restore prior purchases (real billing only). True → now entitled; false →
   *  the store definitively found nothing; null → the store check errored. */
  restore: () => Promise<boolean | null>
  /** Re-run the authoritative entitlement check for the signed-in user and return
   *  the result. The uid-keyed effect only fires when the uid CHANGES, so this is
   *  how a same-account sign-in (or a dashboard grant made while the user sat on
   *  the paywall) gets picked up without a relaunch. False when signed out. */
  refresh: () => Promise<boolean>
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

  // The uid the provider currently serves — so an in-flight check that resolves
  // after a sign-out/account-switch can't write a stale result into state.
  const uidRef = useRef(uid)
  uidRef.current = uid

  // One authoritative entitlement check for `checkUid`, applied to state (unless
  // the uid moved on mid-flight) and returned so callers can route on the result.
  const check = useCallback(async (checkUid: string): Promise<boolean> => {
    let value: boolean
    if (isBillingConfigured()) {
      await logInBilling(checkUid)
      const checked = await billingIsEntitled() // true | false | null (store error)
      if (checked === null) {
        // Live check failed (RevenueCat outage, or an offline reinstall before the
        // SDK cached CustomerInfo). Fail OPEN for a previously-entitled user so a
        // paying subscriber is never stranded on the paywall by a transient error.
        value = await getLastEntitled()
      } else {
        value = checked
        void setLastEntitled(checked)
      }
    } else {
      value = await getMockEntitled()
    }
    if (uidRef.current === checkUid) {
      setEntitled(value)
      setLoadedFor(checkUid)
    }
    return value
  }, [])

  useEffect(() => {
    if (uid === null) {
      // Signed out — drop the store identity and reset the mock.
      setEntitled(false)
      setDevBypassed(false)
      setLoadedFor(null)
      void setMockEntitled(false)
      void setLastEntitled(false)
      void logOutBilling()
      return
    }
    void check(uid)
  }, [uid, check])

  // Live updates while the app is open. The check above runs only when the
  // signed-in uid changes, so on its own a purchase Apple completed but
  // purchasePackage() never returned for (network drop mid-flow), an Ask-to-Buy
  // approval, or a grant made in the RevenueCat dashboard would all leave a paid
  // user stuck on the paywall until they relaunched. Two catch-alls:
  //   - RevenueCat's CustomerInfo listener, which the SDK fires the moment any of
  //     those land;
  //   - a fresh check whenever the app returns to the foreground, for anything
  //     that happened while it was backgrounded.
  // Both only ever GRANT. A lapse is picked up at the next launch, same as today,
  // so a subscriber is never yanked out of the app mid-reflection.
  useEffect(() => {
    if (uid === null || !isBillingConfigured()) return
    const grant = (value: boolean) => {
      if (!value) return
      setEntitled(true)
      void setLastEntitled(true)
    }
    const unsubscribe = subscribeEntitlement(grant)
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      void billingIsEntitled().then((checked) => grant(checked === true))
    })
    return () => {
      unsubscribe()
      appState.remove()
    }
  }, [uid])

  const purchase = useCallback(async (plan: PlanId) => {
    if (isBillingConfigured()) {
      const ok = await purchasePlan(plan)
      if (ok) {
        setEntitled(true)
        void setLastEntitled(true)
      }
      return ok
    }
    // Billing isn't configured. In dev / Expo Go, flip the mock so the flow can be
    // exercised end-to-end. In production this must NEVER grant access for free —
    // fail closed so a misconfigured build (e.g. a missing RevenueCat key) can't
    // hand out premium instead of taking payment.
    if (!__DEV__) return false
    await setMockEntitled(true)
    setEntitled(true)
    return true
  }, [])

  const restore = useCallback(async (): Promise<boolean | null> => {
    if (!isBillingConfigured()) return false
    const ok = await restorePurchases() // true | false | null (store error)
    if (ok) {
      setEntitled(true)
      void setLastEntitled(true)
    }
    return ok
  }, [])

  const refresh = useCallback(async (): Promise<boolean> => {
    const current = uidRef.current
    if (current === null) return false
    return check(current)
  }, [check])

  const bypass = useCallback(() => {
    // Defense in depth: the paywall only wires this to a __DEV__-gated button, but
    // guard here too so no bypass path can ever grant free premium in production.
    if (!__DEV__) return
    setDevBypassed(true)
  }, [])

  return (
    <EntitlementContext.Provider
      value={{ entitled: entitled || devBypassed, loading, purchase, restore, refresh, bypass }}
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
