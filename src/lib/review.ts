import * as StoreReview from 'expo-store-review'

import { getReviewAskedAt, setReviewAskedAt } from './prefs'

// Ask for an App Store review at a genuine high point — a paid user who's kept a
// streak going. iOS itself throttles how often the prompt actually shows (~3×/year);
// we add our own gate so we never ask an unpaid user and never more than once per
// ~4 months. Best-effort — it never throws into the caller.

const REASK_AFTER_MS = 120 * 24 * 60 * 60 * 1000 // ~4 months

export async function maybeRequestReview(entitled: boolean): Promise<void> {
  try {
    if (!entitled) return
    const askedAt = await getReviewAskedAt()
    if (askedAt && Date.now() - askedAt < REASK_AFTER_MS) return
    if (!(await StoreReview.isAvailableAsync())) return
    // Record before requesting: iOS may silently no-op (its own throttle), and we
    // don't want to re-ask on every future milestone in the meantime.
    await setReviewAskedAt(Date.now())
    await StoreReview.requestReview()
  } catch {
    // best-effort
  }
}
