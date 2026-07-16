import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { useEntitlement } from '@/lib/entitlement'
import { hapticImpact, hapticSelect, hapticSuccess } from '@/lib/haptics'
import { openLegal, PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/lib/legal'
import { day } from '@/theme/colors'

// The paywall. Gate-driven: the root layout sends any onboarded-but-unentitled
// user here, so this screen never navigates itself — granting entitlement flips
// the gate, which routes into the tabs.
//
// MOCK: there is no real billing. "Start Your Free Week" just calls grant().
// When RevenueCat / StoreKit land (a dev build, not Expo Go), swap onStart for
// the real purchase call and wire the footer links — nothing else changes.
//
// PAYWALL_MODE controls dismissibility. 'hard' = no escape; 'soft' = a real
// "Not now" for everyone. Pre-launch/pre-PMF we ship 'soft' so a new user can
// reach the product and form the habit before the pay ask — the flip back to
// 'hard' is a one-liner once conversion data justifies it (see the 5-agent audit:
// account-creation + a hard wall stacked before any value is a severe drop-off).
//
// The pressure valve either way is "View a sample routine": one click-through
// demo morning (the same sample the first-run Today shows), after which the user
// lands back here. A taste of the mechanism, not ongoing value.
const PAYWALL_MODE: 'hard' | 'soft' = 'soft'

type PlanId = 'annual' | 'monthly'

const PLANS: {
  id: PlanId
  name: string
  price: string
  detail: string
}[] = [
  {
    id: 'annual',
    name: 'Commit Annually',
    price: '7 days free, then $59.99/year',
    detail: 'Just $4.99/month',
  },
  {
    id: 'monthly',
    name: 'Flexible Monthly',
    price: '$9.99/month',
    detail: 'No trial included',
  },
]

export default function PaywallScreen() {
  const { purchase, restore, bypass } = useEntitlement()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [selected, setSelected] = useState<PlanId>('annual')
  const [busy, setBusy] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

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

  const onRestore = async () => {
    if (restoring) return
    setRestoring(true)
    setNotice(null)
    const ok = await restore()
    if (!mountedRef.current) return
    setRestoring(false)
    if (!ok) setNotice('No previous purchase found for this account.')
    // On success the gate routes away as entitlement flips.
  }

  // The annual plan carries the 7-day trial; monthly bills immediately. Keep the
  // fine print and the CTA honest about whichever plan is actually selected.
  const isAnnual = selected === 'annual'
  const monthlyPrice = PLANS.find((p) => p.id === 'monthly')?.price ?? '$9.99/month'
  const legalCopy = isAnnual
    ? 'Try your custom sequence free for 7 days. You won’t be charged until your trial ends. Cancel anytime in your system settings.'
    : `Billed ${monthlyPrice}, auto-renewing until you cancel. No free trial on the monthly plan. Cancel anytime in your system settings.`
  const ctaCopy = isAnnual ? 'Start Your Free Week' : 'Subscribe Monthly'

  return (
    <SafeAreaView style={styles.safe}>
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
          {PLANS.map((plan) => {
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: day.background,
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
