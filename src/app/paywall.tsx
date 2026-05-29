import { Feather } from '@expo/vector-icons'
import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { useEntitlement } from '@/lib/entitlement'
import { day } from '@/theme/colors'

// The paywall. Gate-driven: the root layout sends any onboarded-but-unentitled
// user here, so this screen never navigates itself — granting entitlement flips
// the gate, which routes into the tabs.
//
// MOCK: there is no real billing. "Start Your Free Week" just calls grant().
// When RevenueCat / StoreKit land (a dev build, not Expo Go), swap onStart for
// the real purchase call and wire the footer links — nothing else changes.
//
// PAYWALL_MODE controls dismissibility. 'hard' = no escape (production intent);
// 'soft' = a real "Not now" for everyone. We ship 'hard' but keep the flip a
// one-liner — see the conversation: soft-first is the pre-PMF-friendly default.
// Until billing is real, a dev-only bypass keeps the app reachable in testing.
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
  const { grant, bypass } = useEntitlement()
  const insets = useSafeAreaInsets()
  const [selected, setSelected] = useState<PlanId>('annual')
  const [busy, setBusy] = useState(false)

  const onStart = async () => {
    setBusy(true)
    // MOCK purchase — flips the entitlement flag; the gate then routes to tabs.
    await grant()
    // No setBusy(false): the screen unmounts as the gate navigates away.
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headline}>Your best days begin here.</Text>
          <Text style={styles.body}>
            Unlock your personalized morning operating sequence. Establish your daily
            ritual, budget your cognitive energy, and clear the morning chaos.
          </Text>
        </View>

        <View style={styles.plans}>
          {PLANS.map((plan) => {
            const on = selected === plan.id
            return (
              <Pressable
                key={plan.id}
                style={[styles.plan, on && styles.planOn]}
                onPress={() => setSelected(plan.id)}
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
        <Text style={styles.legal}>
          Try your custom sequence free for 7 days. You won’t be charged until your trial
          ends. Cancel anytime with a single tap in your system settings.
        </Text>

        <Pressable
          style={[styles.cta, busy && styles.ctaDisabled]}
          onPress={onStart}
          disabled={busy}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color={day.onAccent} />
          ) : (
            <Text style={styles.ctaLabel}>Start Your Free Week</Text>
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

        <View style={styles.links}>
          {/* MOCK: wire these to real URLs / restore when billing is real. */}
          <Pressable accessibilityRole="link">
            <Text style={styles.linkText}>Restore Purchase</Text>
          </Pressable>
          <Text style={styles.linkDot}>·</Text>
          <Pressable accessibilityRole="link">
            <Text style={styles.linkText}>Terms of Service</Text>
          </Pressable>
          <Text style={styles.linkDot}>·</Text>
          <Pressable accessibilityRole="link">
            <Text style={styles.linkText}>Privacy Policy</Text>
          </Pressable>
        </View>

        {__DEV__ && PAYWALL_MODE === 'hard' && (
          <Pressable onPress={bypass} style={styles.devBypass} accessibilityRole="button">
            <Text style={styles.devBypassLabel}>Skip for now (dev only)</Text>
          </Pressable>
        )}
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
  devBypass: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  devBypassLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    color: day.gold,
    textDecorationLine: 'underline',
  },
})
