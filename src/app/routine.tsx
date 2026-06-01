import { Feather, Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Loading } from '@/components/Loading'
import type { Action } from '@/engine/types'
import { getDay, localDate, saveCompletedSlugs, type DayRow } from '@/lib/days'
import { day } from '@/theme/colors'

// The morning routine, performed. Pushed from Today's START button — a focused,
// full-screen ritual with no tab bar:
//
//  1. The Focal Point, alone. One action, its example, and a single Completed
//     button. This is the only thing that's asked of the user.
//  2. After completing it: the rest of the sequence as an explicitly-optional
//     checklist ("extra time, extra lift") that can be checked off in any order.
//
// Every check-off persists immediately to today's row (completed_slugs), which
// is what the evening reflection reads — a morning tracked here never gets
// re-asked "which of these did you do?" at night.

// Same sheen as Today's START button, so the two read as one mechanism.
const GOLD_GRADIENT = ['#A87F4A', '#8C6736'] as const

type Phase = 'focal' | 'sequence'

export default function RoutineScreen() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [row, setRow] = useState<DayRow | null>(null)
  const [completed, setCompleted] = useState<string[]>([])
  const [phase, setPhase] = useState<Phase>('focal')
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getDay(localDate())
      .then((r) => {
        if (!active) return
        setRow(r)
        const slugs = r?.completed_slugs ?? []
        setCompleted(slugs)
        // Focal point already done earlier → resume on the checklist.
        if (r?.plan && slugs.includes(r.plan.oneThing.slug)) setPhase('sequence')
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const plan = row?.plan ?? null
  const focal = plan?.oneThing ?? null
  // The optional remainder — everything in the sequence except the focal point.
  const rest: Action[] = plan ? plan.sequence.filter((a) => a.slug !== plan.oneThing.slug) : []

  // Optimistic check-off: the UI flips instantly, the write follows. A failed
  // write surfaces quietly and the evening reflection remains the safety net.
  const persist = (slugs: string[]) => {
    setCompleted(slugs)
    setSaveError(null)
    saveCompletedSlugs(localDate(), slugs).catch(() => {
      setSaveError('Couldn’t save just now — tonight’s reflection will catch anything missed.')
    })
  }

  const completeFocal = () => {
    if (!focal) return
    if (!completed.includes(focal.slug)) persist([...completed, focal.slug])
    setPhase('sequence')
  }

  const toggle = (slug: string) => {
    persist(
      completed.includes(slug) ? completed.filter((s) => s !== slug) : [...completed, slug],
    )
  }

  const close = () => router.back()

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Loading label="Getting your morning…" />
      </SafeAreaView>
    )
  }

  // ── No plan yet (deep link / not checked in) ────────────────────────────────
  if (!plan || !focal) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Header onClose={close} />
        <View style={styles.emptyWrap}>
          <Feather name="sunrise" size={26} color={day.gold} />
          <Text style={styles.emptyTitle}>No routine yet.</Text>
          <Text style={styles.emptyBody}>
            Check in on Today first — your morning gets built the moment you do.
          </Text>
          <Pressable style={styles.button} onPress={close} accessibilityRole="button">
            <LinearGradient colors={GOLD_GRADIENT} style={styles.buttonFill}>
              <Text style={styles.buttonLabel}>Back to Today</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const doneCount = rest.filter((a) => completed.includes(a.slug)).length

  // ── Phase 1: the Focal Point, alone ─────────────────────────────────────────
  if (phase === 'focal') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Header onClose={close} />
        <Animated.View entering={FadeIn.duration(400)} style={styles.focalWrap}>
          <View style={styles.focalHero}>
            <Feather name="sun" size={24} color={day.gold} />
            <Text style={styles.eyebrow}>Your focal point</Text>
            <Text style={styles.focalTitle}>{focal.title}</Text>
            {focal.example ? <Text style={styles.focalExample}>{focal.example}</Text> : null}
            {focal.description ? (
              <Text style={styles.focalWhy}>{focal.description}</Text>
            ) : null}
            <View style={styles.timeChip}>
              <Feather name="clock" size={13} color={day.muted} />
              <Text style={styles.timeChipLabel}>about {focal.estMinutes} min</Text>
            </View>
          </View>

          <View>
            {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
            <Pressable style={styles.button} onPress={completeFocal} accessibilityRole="button">
              <LinearGradient colors={GOLD_GRADIENT} style={styles.buttonFill}>
                <Feather name="check" size={18} color="#FFFFFF" />
                <Text style={styles.buttonLabel}>Completed</Text>
              </LinearGradient>
            </Pressable>
            <Pressable style={styles.quietLink} onPress={close} accessibilityRole="button">
              <Text style={styles.quietLabel}>Back to Today</Text>
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>
    )
  }

  // ── Phase 2: done + the optional rest ───────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Header onClose={close} />
      <ScrollView contentContainerStyle={styles.sequenceScroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(450)}>
          <View style={styles.doneHero}>
            <View style={styles.doneCircle}>
              <Feather name="check" size={26} color={day.onAccent} />
            </View>
            <Text style={styles.doneTitle}>That&rsquo;s the day&rsquo;s biggest lever — done.</Text>
            <Text style={styles.doneSub}>{focal.title}</Text>
          </View>

          <View style={styles.starRow}>
            <View style={styles.starLine} />
            <Ionicons name="star" size={11} color={day.gold} style={styles.starIcon} />
            <View style={styles.starLine} />
          </View>
        </Animated.View>

        {rest.length > 0 && (
          <Animated.View entering={FadeInDown.duration(450).delay(150)}>
            <Text style={styles.eyebrowLeft}>Go further · optional</Text>
            <Text style={styles.optionalCopy}>
              The rest of your morning, if you have the time. Nothing here is required — but
              each move you add builds on what you&rsquo;ve already done.
            </Text>

            <View style={styles.list}>
              {rest.map((a) => {
                const done = completed.includes(a.slug)
                return (
                  <Pressable
                    key={a.slug}
                    style={[styles.itemRow, done && styles.itemRowDone]}
                    onPress={() => toggle(a.slug)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done }}
                  >
                    <View style={[styles.checkCircle, done && styles.checkCircleOn]}>
                      {done && <Feather name="check" size={14} color={day.onAccent} />}
                    </View>
                    <View style={styles.itemText}>
                      <Text style={[styles.itemTitle, done && styles.itemTitleDone]}>
                        {a.title}
                      </Text>
                      {a.example ? <Text style={styles.itemExample}>{a.example}</Text> : null}
                    </View>
                    <Text style={styles.itemMinutes}>{a.estMinutes} min</Text>
                  </Pressable>
                )
              })}
            </View>

            <Text style={styles.progressLine}>
              {doneCount === rest.length
                ? 'Everything done. That’s a complete morning.'
                : `${doneCount} of ${rest.length} extra moves done`}
            </Text>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.duration(450).delay(300)}>
          {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
          <Pressable style={styles.button} onPress={close} accessibilityRole="button">
            <LinearGradient colors={GOLD_GRADIENT} style={styles.buttonFill}>
              <Text style={styles.buttonLabel}>Back to Today</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

// Minimal chrome: just a close affordance, top-right. The ritual is the screen.
function Header({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Feather name="x" size={22} color={day.muted} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: day.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 10,
  },

  // ── Focal phase ─────────────────────────────────────────────────────────────
  focalWrap: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  focalHero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40, // optical centering: lifts the block slightly above true center
  },
  eyebrow: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: day.muted,
    marginTop: 18,
  },
  focalTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 38,
    lineHeight: 46,
    color: day.text,
    textAlign: 'center',
    marginTop: 12,
  },
  focalExample: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontStyle: 'italic',
    fontSize: 17,
    lineHeight: 26,
    color: day.muted,
    textAlign: 'center',
    marginTop: 14,
    maxWidth: 300,
  },
  focalWhy: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: day.muted,
    textAlign: 'center',
    marginTop: 22,
    maxWidth: 320,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    backgroundColor: day.surface,
  },
  timeChipLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 13,
    color: day.muted,
  },

  // ── Sequence phase ──────────────────────────────────────────────────────────
  sequenceScroll: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 32,
  },
  doneHero: {
    alignItems: 'center',
    marginTop: 12,
  },
  doneCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: day.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  doneTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 24,
    lineHeight: 32,
    color: day.text,
    textAlign: 'center',
    marginTop: 20,
    maxWidth: 320,
  },
  doneSub: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontStyle: 'italic',
    fontSize: 15,
    color: day.muted,
    marginTop: 8,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    marginBottom: 8,
  },
  starLine: {
    width: 36,
    height: 1,
    backgroundColor: day.gold,
    opacity: 0.5,
  },
  starIcon: {
    marginHorizontal: 10,
  },
  eyebrowLeft: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: day.muted,
    marginTop: 26,
  },
  optionalCopy: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14.5,
    lineHeight: 22,
    color: day.muted,
    marginTop: 10,
  },
  list: {
    marginTop: 18,
    gap: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: day.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  itemRowDone: {
    borderColor: day.gold,
    backgroundColor: '#FBF6EC', // a whisper of gold so done rows read as settled
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: day.border,
    backgroundColor: day.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkCircleOn: {
    backgroundColor: day.gold,
    borderColor: day.gold,
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: day.text,
  },
  itemTitleDone: {
    color: day.gold,
  },
  itemExample: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: day.muted,
    marginTop: 4,
  },
  itemMinutes: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 13,
    color: day.muted,
    marginTop: 2,
  },
  progressLine: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 13.5,
    color: day.gold,
    textAlign: 'center',
    marginTop: 20,
  },

  // ── Shared ──────────────────────────────────────────────────────────────────
  button: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 28,
  },
  buttonFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 17,
  },
  buttonLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  quietLink: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  quietLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    color: day.muted,
    textDecorationLine: 'underline',
  },
  error: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 13.5,
    color: day.negative,
    textAlign: 'center',
    marginTop: 12,
  },

  // ── Empty state ─────────────────────────────────────────────────────────────
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  emptyTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 24,
    color: day.text,
    marginTop: 16,
  },
  emptyBody: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    lineHeight: 23,
    color: day.muted,
    textAlign: 'center',
    marginTop: 10,
  },
})
