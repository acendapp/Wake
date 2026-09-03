import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '@/lib/auth'
import { getPlanPricing, type PlanPricing } from '@/lib/billing'
import { useEntitlement } from '@/lib/entitlement'
import { hapticImpact, hapticSelect, hapticSuccess } from '@/lib/haptics'
import { openLegal, PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/lib/legal'
import { redeemPromo } from '@/lib/promo'
import { day } from '@/theme/colors'

// The paywall. Gate-driven: the root layout sends any onboarded-but-unentitled
// user here, so this screen never navigates itself — granting entitlement flips
// the gate, which routes into the tabs.
//
// Billing is real (RevenueCat — see lib/billing.ts): the CTA runs the store
// purchase and the prices shown come live from the current offering. Without an
// API key or the native module (Expo Go), it degrades to a device-local mock and
// the hardcoded PLANS copy below, so the whole flow still works for testing.
//
// PAYWALL_MODE controls dismissibility. 'hard' = no escape; 'soft' = a real
// "Not now" for everyone. LAUNCHING 'hard': every user must start the 7-day free
// trial (or subscribe) to enter — the trial is the low-friction "taste it first"
// valve, so there's no value stacked behind a pay-only wall. Flip to 'soft' only
// if conversion data later argues for free access before the pay ask (see the
// 5-agent audit: account-creation + a hard wall before any value risks drop-off).
//
// The pressure valve either way is "View a sample routine": one click-through
// demo morning (the same sample the first-run Today shows), after which the user
// lands back here. A taste of the mechanism, not ongoing value.
const PAYWALL_MODE: 'hard' | 'soft' = 'hard'

type PlanId = 'annual' | 'monthly'

const PLANS: {
  id: PlanId
  name: string
  price: string
  detail: string
}[] = [
  {
    id: 'annual',
    name: 'Yearly',
    price: '7 days free, then $39.99/year',
    detail: 'Just $3.33/month',
  },
  {
    id: 'monthly',
    name: 'Monthly',
    price: '$5.99/month',
    detail: 'No trial included',
  },
]

export default function PaywallScreen() {
  const { purchase, restore, refresh, promoGraceEndsAt, bypass } = useEntitlement()
  const { session, signOut } = useAuth()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [selected, setSelected] = useState<PlanId>('annual')
  const [busy, setBusy] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [pricing, setPricing] = useState<Partial<Record<PlanId, PlanPricing>> | null>(null)
  // Promo-code entry, tucked behind a quiet link so the purchase flow stays clean.
  const [codeOpen, setCodeOpen] = useState(false)
  const [code, setCode] = useState('')
  const [codeBusy, setCodeBusy] = useState(false)

  // Pull live, localized prices from the store offering so the paywall never drifts
  // from what's actually charged. Null (Expo Go / no key / offline) keeps the copy below.
  useEffect(() => {
    let active = true
    void getPlanPricing().then((p) => {
      if (active) setPricing(p)
    })
    return () => {
      active = false
    }
  }, [])

  // The gate usually unmounts this screen on success; guard the post-await setState
  // for the failure paths where it stays mounted.
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const onStart = async () => {
    hapticImpact()
    setBusy(true)
    setNotice(null)
    // Real billing runs the store flow; with no key set this flips the mock. On
    // success the gate routes to tabs and unmounts this screen. On failure (e.g.
    // the user cancelled), drop back so they can try again.
    const ok = await purchase(selected)
    if (ok) hapticSuccess()
    if (!ok && mountedRef.current) {
      setBusy(false)
      setNotice('Purchase didn’t complete. You can try again.')
    }
  }

  const onApplyCode = async () => {
    if (codeBusy || !code.trim()) return
    setCodeBusy(true)
    setNotice(null)
    const res = await redeemPromo(code.trim())
    if (res === 'ok') {
      hapticSuccess()
      // refresh() picks up the redemption and flips entitled; the gate then
      // routes into the tabs and unmounts this screen.
      await refresh()
    }
    if (!mountedRef.current) return
    setCodeBusy(false)
    if (res === 'invalid') setNotice('That code isn’t active.')
    else if (res === 'used') setNotice('You’ve already used this code’s free access.')
    else if (res === 'rate_limited') setNotice('Too many tries — wait an hour and try again.')
    else if (res === 'error')
      setNotice('Couldn’t check that code. Check your connection and try again.')
  }

  const onRestore = async () => {
    if (restoring) return
    setRestoring(true)
    setNotice(null)
    const ok = await restore() // true | false | null (store error)
    if (!mountedRef.current) return
    setRestoring(false)
    // A store/network error is NOT "you never bought anything" — say what
    // actually happened so a paying user doesn't conclude their purchase is gone.
    if (ok === null) setNotice('Couldn’t reach the App Store. Check your connection and try again.')
    else if (!ok) setNotice('No previous purchase found for this account.')
    // On success the gate routes away as entitlement flips.
  }

  // Overlay live store prices onto the plan copy; fall back to the static PLANS
  // whenever billing isn't configured (Expo Go, no key, offline).
  const plans = PLANS.map((base) => {
    const live = pricing?.[base.id]
    if (!live) return base
    if (base.id === 'annual') {
      const priceLine =
        live.trialDays > 0
          ? `${live.trialDays} days free, then ${live.priceString}/year`
          : `${live.priceString}/year`
      return {
        ...base,
        price: priceLine,
        detail: live.perMonthString ? `Just ${live.perMonthString}/month` : base.detail,
      }
    }
    return { ...base, price: `${live.priceString}/month` }
  })

  // The yearly-vs-monthly saving, for the badge on the annual plan. Computed from
  // live numeric prices when available (so it stays right in every currency), else
  // the known tiers — $39.99/yr against $5.99/mo × 12 ≈ 44% (repriced Sep 2026).
  const savingsPct = (() => {
    const a = pricing?.annual?.priceValue
    const m = pricing?.monthly?.priceValue
    if (a && m && m > 0) {
      const pct = Math.round((1 - a / (m * 12)) * 100)
      return pct > 0 ? pct : null
    }
    return 44
  })()
  const savingsBadge = savingsPct != null ? `Save ${savingsPct}%` : null

  // The annual plan carries the 7-day trial; monthly bills immediately. Keep the
  // fine print and the CTA honest about whichever plan is actually selected.
  //
  // Apple 3.1.2(c): a free-trial flow MUST state, near the CTA, how long the trial
  // lasts, the exact amount billed after it, and that it auto-renews. Prices/trial
  // come from the live offering where available, with the launch terms as fallback.
  const isAnnual = selected === 'annual'
  const monthlyPrice = plans.find((p) => p.id === 'monthly')?.price ?? '$5.99/month'
  const annualTrialDays = pricing?.annual?.trialDays ?? 7
  const annualPrice = pricing?.annual?.priceString ?? '$39.99'
  // The store is the authority on whether a trial exists. If it reports the annual
  // product with NO intro offer (misconfigured in App Store Connect, or this user
  // already used a trial in the group), Apple will charge immediately — so the
  // fine print and CTA must say that, never "0-day free trial" / "Start Your Free
  // Week". Promising a trial the store won't honor is a 3.1.2(c) problem.
  const annualHasTrial = annualTrialDays > 0
  const legalCopy = isAnnual
    ? annualHasTrial
      ? `${annualTrialDays}-day free trial, then ${annualPrice}/year. Your subscription renews automatically — your payment method is charged ${annualPrice} at the end of the free trial and every year after, unless you cancel at least 24 hours before the trial ends. Cancel anytime in your device Settings.`
      : `${annualPrice}/year, charged now and automatically renewing every year until you cancel. Cancel anytime in your device Settings.`
    : `${monthlyPrice}, charged now and automatically renewing every month until you cancel. No free trial on the monthly plan. Cancel anytime in your device Settings.`
  const ctaCopy = isAnnual
    ? annualHasTrial
      ? 'Start Your Free Week'
      : 'Subscribe Yearly'
    : 'Subscribe Monthly'

  return (
    <SafeAreaView style={styles.safe}>
      {/* Scrollable so the CTA + fine print are always reachable — on small iPhones
          and in the iPad compatibility window (Apple Guideline 4), where a fixed
          layout clipped the bottom of the page. */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.content}>
        {/* Dev-only escape hatch, top-right. __DEV__ is false in production
            builds, so this never ships — the real paywall stays hard. */}
        {__DEV__ && (
          <View style={styles.devSkipRow}>
            <Pressable onPress={bypass} hitSlop={10} accessibilityRole="button">
              <Text style={styles.devSkipLabel}>Skip</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.header}>
          <Text style={styles.headline}>Every morning, it knows you better.</Text>
          <Text style={styles.body}>
            Wake builds each day&rsquo;s routine from how you actually wake up — and learns
            from every check-in and reflection. Day one is a good morning. Day thirty is
            built from thirty mornings of you.
          </Text>
        </View>

        <View style={styles.plans}>
          {plans.map((plan) => {
            const on = selected === plan.id
            return (
              <Pressable
                key={plan.id}
                style={({ pressed }) => [styles.plan, on && styles.planOn, pressed && { opacity: 0.92 }]}
                onPress={() => {
                  hapticSelect()
                  setSelected(plan.id)
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                {plan.id === 'annual' && savingsBadge && (
                  <View style={[styles.saveBadge, on && styles.saveBadgeOn]}>
                    <Text style={[styles.saveBadgeText, on && styles.saveBadgeTextOn]}>
                      {savingsBadge}
                    </Text>
                  </View>
                )}
                <View style={styles.planText}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                  <Text style={styles.planDetail}>{plan.detail}</Text>
                </View>
                <View style={[styles.radio, on && styles.radioOn]}>
                  {on && <Feather name="check" size={15} color={day.onAccent} />}
                </View>
              </Pressable>
            )
          })}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <Text style={styles.legal}>{legalCopy}</Text>

        <Pressable
          style={({ pressed }) => [styles.cta, busy && styles.ctaDisabled, pressed && !busy && { opacity: 0.88 }]}
          onPress={onStart}
          disabled={busy}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color={day.onAccent} />
          ) : (
            <Text style={styles.ctaLabel}>{ctaCopy}</Text>
          )}
        </Pressable>

        {PAYWALL_MODE === 'soft' && (
          <Pressable
            onPress={bypass}
            style={styles.dismiss}
            accessibilityRole="button"
          >
            <Text style={styles.dismissLabel}>Not now</Text>
          </Pressable>
        )}

        {/* A promo-grace visitor still HAS access — they came here from the
            countdown banner to subscribe. The hard wall must not trap them. */}
        {promoGraceEndsAt !== null && PAYWALL_MODE !== 'soft' && (
          <Pressable
            onPress={() => router.replace('/')}
            style={styles.dismiss}
            accessibilityRole="button"
          >
            <Text style={styles.dismissLabel}>Not now</Text>
          </Pressable>
        )}

        {/* Returning users (and the App Review demo account) sign in here rather than
            being trapped behind the hard wall with only a new-account path. The gate
            only routes signed-in users to this screen, so the copy must not read like
            a logged-out state — "Already have an account?" convinced a stranded
            subscriber they'd somehow been signed out. */}
        <Pressable
          onPress={() => router.push('/sign-in')}
          disabled={busy}
          style={styles.signInRow}
          accessibilityRole="button"
        >
          <Text style={styles.signInText}>
            Not you? <Text style={styles.signInLink}>Sign in with a different account</Text>
          </Text>
        </Pressable>

        {/* Promo codes: creators/friends ride free (lib/promo.ts). A quiet link
            so the purchase flow stays the star; expands to an inline input. */}
        {codeOpen ? (
          <View style={styles.codeRow}>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={setCode}
              placeholder="Promo code"
              placeholderTextColor={day.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              editable={!codeBusy}
              onSubmitEditing={onApplyCode}
              returnKeyType="go"
            />
            <Pressable
              style={[styles.codeApply, (codeBusy || !code.trim()) && styles.ctaDisabled]}
              onPress={onApplyCode}
              disabled={codeBusy || !code.trim()}
              accessibilityRole="button"
            >
              {codeBusy ? (
                <ActivityIndicator color={day.onAccent} />
              ) : (
                <Text style={styles.codeApplyLabel}>Apply</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setCodeOpen(true)}
            disabled={busy}
            style={styles.signInRow}
            accessibilityRole="button"
          >
            <Text style={styles.signInText}>
              Have a promo code? <Text style={styles.signInLink}>Enter it</Text>
            </Text>
          </Pressable>
        )}

        {/* The taste-before-you-commit valve: one demo morning, then back here.
            Disabled mid-purchase so it can't push the sample on top of the gate's
            navigation into the tabs. */}
        <Pressable
          onPress={() => router.push({ pathname: '/routine', params: { sample: '1' } })}
          disabled={busy}
          style={[styles.sampleLink, busy && styles.ctaDisabled]}
          accessibilityRole="button"
        >
          <Text style={styles.sampleLinkLabel}>View a sample routine</Text>
        </Pressable>

        {/* Name the signed-in account and offer a way out. Without this, a signed-in
            user who lost their entitlement reads the paywall as "logged out" and has
            no self-service path but deleting the app. */}
        <View style={styles.accountRow}>
          <Text style={styles.linkText}>Signed in as {session?.user.email ?? 'your account'}</Text>
          <Text style={styles.linkDot}>·</Text>
          <Pressable onPress={signOut} disabled={busy} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.linkText, styles.signOutLink]}>Sign out</Text>
          </Pressable>
        </View>

        <View style={styles.links}>
          {/* Restore runs RevenueCat's restore when billing is configured; with no
              key it reports nothing to restore. Terms + Privacy open the hosted docs
              (placeholder URLs in src/lib/legal.ts until the real ones exist). */}
          <Pressable onPress={onRestore} disabled={restoring} accessibilityRole="link">
            <Text style={styles.linkText}>{restoring ? 'Restoring…' : 'Restore Purchase'}</Text>
          </Pressable>
          <Text style={styles.linkDot}>·</Text>
          <Pressable onPress={() => openLegal(TERMS_OF_SERVICE_URL)} accessibilityRole="link">
            <Text style={styles.linkText}>Terms of Service</Text>
          </Pressable>
          <Text style={styles.linkDot}>·</Text>
          <Pressable onPress={() => openLegal(PRIVACY_POLICY_URL)} accessibilityRole="link">
            <Text style={styles.linkText}>Privacy Policy</Text>
          </Pressable>
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: day.background,
  },
  // flexGrow keeps the header/plans and the footer spread apart on tall screens,
  // while still letting the whole thing scroll when the viewport is too short.
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 24,
  },
  // Dev-only skip, tucked in the top-right corner above the headline.
  devSkipRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: -12, // tighten into the safe-area gap so the headline barely moves
    marginBottom: 4,
  },
  devSkipLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    color: day.muted,
    textDecorationLine: 'underline',
  },
  header: {
    marginBottom: 32,
  },
  headline: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 34,
    lineHeight: 42,
    color: day.text,
  },
  body: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 16,
    lineHeight: 25,
    color: day.muted,
    marginTop: 16,
  },
  plans: {
    gap: 14,
  },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: day.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  planOn: {
    borderColor: day.gold,
    borderWidth: 2,
  },
  planText: {
    flex: 1,
    gap: 3,
  },
  planName: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    color: day.text,
  },
  // "Save 50%" pill notched into the annual card's top border — an opaque background
  // cuts the border line behind it. Quiet gold tint normally; fills gold when the
  // plan is selected so the value pops at the moment of choice.
  saveBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    zIndex: 2,
    backgroundColor: day.goldTint,
    borderWidth: 1,
    borderColor: day.gold,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  saveBadgeOn: {
    backgroundColor: day.gold,
    borderColor: day.gold,
  },
  saveBadgeText: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.3,
    color: day.gold,
  },
  saveBadgeTextOn: {
    color: day.onAccent,
  },
  planPrice: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 15,
    color: day.text,
  },
  planDetail: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 13,
    color: day.muted,
  },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: day.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 14,
  },
  radioOn: {
    backgroundColor: day.gold,
    borderColor: day.gold,
  },
  footer: {
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  legal: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    lineHeight: 17,
    color: day.muted,
    textAlign: 'center',
    marginBottom: 14,
  },
  notice: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: day.gold,
    textAlign: 'center',
    marginBottom: 10,
  },
  cta: {
    backgroundColor: day.gold,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
    color: day.onAccent,
  },
  dismiss: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dismissLabel: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 15,
    color: day.muted,
  },
  // "Already have an account? Sign in" — the escape hatch out of the hard wall.
  signInRow: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  signInText: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    color: day.muted,
  },
  signInLink: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    color: day.gold,
    textDecorationLine: 'underline',
  },
  // "View a sample routine" — quiet but real, directly under the CTA.
  sampleLink: {
    alignItems: 'center',
    paddingVertical: 13,
  },
  sampleLinkLabel: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 15,
    color: day.gold,
    textDecorationLine: 'underline',
  },
  // Inline promo-code entry: input + Apply, matching the sign-in screen's fields.
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    marginBottom: 2,
  },
  codeInput: {
    flex: 1,
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    color: day.text,
    backgroundColor: day.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  codeApply: {
    backgroundColor: day.gold,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeApplyLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 14,
    color: day.onAccent,
  },
  // "Signed in as … · Sign out" — quiet, same weight as the legal links below.
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  signOutLink: {
    textDecorationLine: 'underline',
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  linkText: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 11,
    color: day.muted,
  },
  linkDot: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 11,
    color: day.muted,
  },
})
