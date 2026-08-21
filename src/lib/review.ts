import * as Linking from 'expo-linking'

import { getReviewAskedAt, setReviewAskedAt } from './prefs'

// Ask for an App Store review at a genuine high point — a paid user who's kept a
// streak going. iOS itself hard-caps how often the prompt actually shows (3× per
// 365 days, and never to someone who already rated), so our own gate mostly decides
// WHICH milestones get to spend those. We never ask an unpaid user and re-ask at
// most weekly, so with the 7/10/14/21/30… milestones it lands on days 7, 14, 21 —
// a user at their most enthusiastic. Best-effort — it never throws into the caller.
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

const REASK_AFTER_MS = 7 * 24 * 60 * 60 * 1000 // a week

/** Wake's App Store id (apps.apple.com/.../id6791676733). */
const APP_STORE_ID = '6791676733'
/** Deep link straight into the App Store's review composer for Wake. */
const WRITE_REVIEW_URL = `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`

/**
 * Open the App Store review composer — for a tap the user chose themselves (the
 * "Rate Wake" row on You). Deliberately NOT requestReview(): that prompt is
 * throttled by iOS and may silently show nothing, which reads as a broken button.
 * The deep link always opens. Returns false if nothing could open it.
 */
export async function openWriteReview(): Promise<boolean> {
  try {
    await Linking.openURL(WRITE_REVIEW_URL)
    return true
  } catch {
    return false
  }
}

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
