import { Platform } from 'react-native'

// RevenueCat billing wrapper. Lazily loaded and KEY-GATED: set the API key(s) to
// turn real billing on; without a key (or in Expo Go, where the native module is
// absent) `isBillingConfigured()` is false and the entitlement layer falls back
// to the dev mock, so the paywall + gate still work for testing.
//
// TO GO LIVE (founder):
//   1. Create a RevenueCat project; add the iOS app + App Store Connect creds.
//   2. Create an entitlement called "premium" and an Offering whose packages are
//      the $59.99/yr (annual) and $9.99/mo (monthly) products from App Store Connect.
//   3. Set EXPO_PUBLIC_REVENUECAT_IOS_KEY (and _ANDROID later) in .env / EAS env.
//   4. Sandbox-test purchase + restore on a real device (needs the $99 + a build).

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? ''
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? ''

/** The entitlement identifier configured in the RevenueCat dashboard. */
const ENTITLEMENT_ID = 'premium'

export type PlanId = 'annual' | 'monthly'
/** Our plan ids → RevenueCat package identifiers (the RC defaults). */
const PACKAGE_FOR_PLAN: Record<PlanId, string> = {
  annual: '$rc_annual',
  monthly: '$rc_monthly',
}

type PurchasesModule = typeof import('react-native-purchases').default
type StoreProduct = import('react-native-purchases').PurchasesStoreProduct
type CustomerInfo = import('react-native-purchases').CustomerInfo

/** Live, store-authoritative pricing for a plan, for display on the paywall. */
export type PlanPricing = {
  /** Localized recurring price exactly as the store charges it, e.g. "$59.99". */
  priceString: string
  /** Numeric recurring price in the product's currency — for computing savings, etc. */
  priceValue: number
  /** Localized per-month equivalent (annual price ÷ 12), or null if not derivable. */
  perMonthString: string | null
  /** Free-trial length in days from the intro offer, or 0 if the plan has none. */
  trialDays: number
}

let cached: PurchasesModule | null | undefined
/** The native Purchases module if present in this binary, else null (cached). */
function getPurchases(): PurchasesModule | null {
  if (cached === undefined) {
    try {
      // Lazy + guarded so this file is safe to import in Expo Go (degrades to mock).
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = require('react-native-purchases').default as PurchasesModule
    } catch {
      cached = null
    }
  }
  return cached
}

function apiKey(): string {
  return Platform.OS === 'android' ? ANDROID_KEY : IOS_KEY
}

/** True when real billing can run: a key is set AND the native module is present. */
export function isBillingConfigured(): boolean {
  return !!apiKey() && !!getPurchases()
}

let configured = false
function ensureConfiguredSync(): PurchasesModule | null {
  const P = getPurchases()
  if (!P || !apiKey()) return null
  if (!configured) {
    P.configure({ apiKey: apiKey() })
    configured = true
  }
  return P
}
async function ensureConfigured(): Promise<PurchasesModule | null> {
  return ensureConfiguredSync()
}

/** Identify the signed-in user to RevenueCat (so entitlements follow the account). */
export async function logInBilling(appUserId: string): Promise<void> {
  const P = await ensureConfigured()
  if (!P) return
  try {
    await P.logIn(appUserId)
  } catch {
    // Non-fatal — entitlement check will just return false.
  }
}

/** Whether the signed-in user holds the premium entitlement: true / false, or null
 *  when the store check errored (unknown — the caller decides how to treat it). */
export async function isEntitled(): Promise<boolean | null> {
  const P = await ensureConfigured()
  if (!P) return false
  try {
    const info = await P.getCustomerInfo()
    return !!info.entitlements.active[ENTITLEMENT_ID]
  } catch {
    // Unknown — a store/network error, not a definitive "not entitled". The caller
    // fails open for a previously-entitled user rather than bouncing them.
    return null
  }
}

/**
 * Subscribe to RevenueCat's pushed CustomerInfo updates. The SDK fires these
 * whenever the entitlement picture changes while the app is open — after a
 * purchase or restore, a renewal, an Ask-to-Buy approval, or a grant/refund made
 * in the dashboard — so the caller doesn't have to poll or wait for a relaunch.
 * Returns an unsubscribe; a no-op when billing isn't configured.
 */
export function subscribeEntitlement(onChange: (entitled: boolean) => void): () => void {
  const P = ensureConfiguredSync()
  if (!P) return () => {}
  const listener = (info: CustomerInfo) => onChange(!!info.entitlements.active[ENTITLEMENT_ID])
  P.addCustomerInfoUpdateListener(listener)
  return () => {
    P.removeCustomerInfoUpdateListener(listener)
  }
}

/** Purchase a plan. Returns true if the user ends up entitled. */
export async function purchasePlan(plan: PlanId): Promise<boolean> {
  const P = await ensureConfigured()
  if (!P) return false
  try {
    const offerings = await P.getOfferings()
    const current = offerings.current
    if (!current) return false
    const pkg =
      current.availablePackages.find((p) => p.identifier === PACKAGE_FOR_PLAN[plan]) ??
      current.availablePackages[0]
    if (!pkg) return false
    const { customerInfo } = await P.purchasePackage(pkg)
    return !!customerInfo.entitlements.active[ENTITLEMENT_ID]
  } catch {
    // Includes user-cancelled — caller just stays on the paywall.
    return false
  }
}

/** Restore prior purchases. Returns true if the user ends up entitled. */
export async function restorePurchases(): Promise<boolean> {
  const P = await ensureConfigured()
  if (!P) return false
  try {
    const info = await P.restorePurchases()
    return !!info.entitlements.active[ENTITLEMENT_ID]
  } catch {
    return false
  }
}

/** Days of free trial from a product's intro offer (0 when it isn't a free trial). */
function trialDaysOf(prod: StoreProduct): number {
  const intro = prod.introPrice
  if (!intro || intro.price !== 0) return 0
  const n = intro.periodNumberOfUnits ?? 0
  switch (intro.periodUnit) {
    case 'DAY':
      return n
    case 'WEEK':
      return n * 7
    case 'MONTH':
      return n * 30
    case 'YEAR':
      return n * 365
    default:
      return 0
  }
}

/** The per-month equivalent of an annual price, localized in the product's currency. */
function perMonthOf(prod: StoreProduct): string | null {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: prod.currencyCode,
    }).format(prod.price / 12)
  } catch {
    return null
  }
}

/**
 * Live pricing for the paywall, read from the current offering. Returns null when
 * billing isn't configured (Expo Go / no key) or the offering can't be fetched, so
 * the paywall falls back to its own copy. Only the plans actually present are keyed.
 */
export async function getPlanPricing(): Promise<Partial<Record<PlanId, PlanPricing>> | null> {
  const P = await ensureConfigured()
  if (!P) return null
  try {
    const current = (await P.getOfferings()).current
    if (!current) return null
    const out: Partial<Record<PlanId, PlanPricing>> = {}
    for (const plan of ['annual', 'monthly'] as PlanId[]) {
      const prod = current.availablePackages.find(
        (p) => p.identifier === PACKAGE_FOR_PLAN[plan],
      )?.product
      if (!prod) continue
      out[plan] = {
        priceString: prod.priceString,
        priceValue: prod.price,
        perMonthString: plan === 'annual' ? perMonthOf(prod) : null,
        trialDays: trialDaysOf(prod),
      }
    }
    return Object.keys(out).length ? out : null
  } catch {
    return null
  }
}

/** Clear the RevenueCat identity on sign-out. */
export async function logOutBilling(): Promise<void> {
  const P = getPurchases()
  if (!P || !apiKey() || !configured) return
  try {
    await P.logOut()
  } catch {
    // Non-fatal.
  }
}
