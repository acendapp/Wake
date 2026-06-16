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
async function ensureConfigured(): Promise<PurchasesModule | null> {
  const P = getPurchases()
  if (!P || !apiKey()) return null
  if (!configured) {
    P.configure({ apiKey: apiKey() })
    configured = true
  }
  return P
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

/** Whether the signed-in user currently holds the premium entitlement. */
export async function isEntitled(): Promise<boolean> {
  const P = await ensureConfigured()
  if (!P) return false
  try {
    const info = await P.getCustomerInfo()
    return !!info.entitlements.active[ENTITLEMENT_ID]
  } catch {
    return false
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
