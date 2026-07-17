import { getReviewAskedAt, setReviewAskedAt } from './prefs'

// Ask for an App Store review at a genuine high point — a paid user who's kept a
// streak going. iOS itself throttles how often the prompt actually shows (~3×/year);
// we add our own gate so we never ask an unpaid user and never more than once per
// ~4 months. Best-effort — it never throws into the caller.
//
// LAZY + GUARDED, like billing.ts: expo-store-review is a native module absent from
// Expo Go and from any build made before it was added. Requiring it behind a
// try/catch keeps importing this file from crashing the app when it's missing.

type StoreReviewModule = typeof import('expo-store-review')

let cached: StoreReviewModule | null | undefined
/** The native module if present in this binary, else null (cached). */
function getStoreReview(): StoreReviewModule | null {
  if (cached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = require('expo-store-review') as StoreReviewModule
    } catch {
      cached = null
    }
  }
  return cached
}

const REASK_AFTER_MS = 120 * 24 * 60 * 60 * 1000 // ~4 months

export async function maybeRequestReview(entitled: boolean): Promise<void> {
  const SR = getStoreReview()
  if (!SR || !entitled) return
  try {
    const askedAt = await getReviewAskedAt()
    if (askedAt && Date.now() - askedAt < REASK_AFTER_MS) return
    if (!(await SR.isAvailableAsync())) return
    // Record before requesting: iOS may silently no-op (its own throttle), and we
    // don't want to re-ask on every future milestone in the meantime.
    await setReviewAskedAt(Date.now())
    await SR.requestReview()
  } catch {
    // best-effort
  }
}
