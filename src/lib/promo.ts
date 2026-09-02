import AsyncStorage from '@react-native-async-storage/async-storage'

import { supabase } from './supabase'

// Promo-code access — creators/friends ride free while their code stays active
// (tables + RPCs in supabase/migrations/0013_promo_access.sql). The entitlement
// layer treats 'active' and 'grace' as entitled; 'grace' additionally surfaces a
// countdown banner (code deactivated → 7 more days, then the hard paywall).
//
// Codes themselves never reach the client: redemption and status go through
// security-definer RPCs keyed off auth.uid().

export type PromoState = 'active' | 'grace' | 'expired' | 'none'
export type PromoStatus = {
  state: PromoState
  /** ISO timestamp the grace window closes — only set when state is 'grace'. */
  graceEndsAt: string | null
}

const NONE: PromoStatus = { state: 'none', graceEndsAt: null }

// Last server-confirmed status, so a transient network error can't bounce a
// promo user to the paywall mid-grace (same fail-open philosophy as
// wake.lastEntitled). A cached grace still expires on time — the stored
// grace_ends_at is re-checked against the clock on every read.
const CACHE_KEY = 'wake.promoStatus'

/** Redeem a code for the signed-in user. 'used' = a trial code this user already
 *  spent (a trial never restarts). 'error' = couldn't reach the server. */
export async function redeemPromo(
  code: string,
): Promise<'ok' | 'invalid' | 'used' | 'rate_limited' | 'error'> {
  try {
    const { data, error } = await supabase.rpc('redeem_promo', { p_code: code })
    if (error) {
      if (__DEV__) console.warn('[promo] redeem_promo failed', error)
      return 'error'
    }
    return data === 'ok' || data === 'invalid' || data === 'used' || data === 'rate_limited'
      ? data
      : 'error'
  } catch (e) {
    if (__DEV__) console.warn('[promo] redeem_promo threw', e)
    return 'error'
  }
}

/** The signed-in user's promo standing, server-authoritative with a local
 *  fail-open cache for offline/transient errors. */
export async function getPromoStatus(): Promise<PromoStatus> {
  try {
    const { data, error } = await supabase.rpc('promo_status')
    if (error) throw error
    const row = (Array.isArray(data) ? data[0] : data) as
      | { state: PromoState; grace_ends_at: string | null }
      | undefined
    const status: PromoStatus = row
      ? { state: row.state, graceEndsAt: row.grace_ends_at ?? null }
      : NONE
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(status))
    } catch {
      // Best-effort cache; a storage hiccup just weakens offline fail-open.
    }
    return status
  } catch (e) {
    if (__DEV__) console.warn('[promo] promo_status failed — using cached status', e)
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY)
      if (!raw) return NONE
      const cached = JSON.parse(raw) as PromoStatus
      // The cache may be stale; the one transition it can compute alone is a
      // grace window that has since closed. Never let a cached grace outlive
      // its own end date.
      if (
        cached.state === 'grace' &&
        cached.graceEndsAt !== null &&
        new Date(cached.graceEndsAt).getTime() <= Date.now()
      ) {
        return { state: 'expired', graceEndsAt: cached.graceEndsAt }
      }
      return cached
    } catch {
      return NONE
    }
  }
}

/** Drop the cached status (sign-out — the next account starts clean). */
export async function clearPromoCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY)
  } catch {
    // Best-effort.
  }
}
