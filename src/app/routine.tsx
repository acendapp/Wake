import { Feather, Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Loading } from '@/components/Loading'
import { TodayHome } from '@/components/today/TodayHome'
import { generatePlan } from '@/engine/generatePlan'
import type { Action } from '@/engine/types'
import { getDay, logicalDate, saveCompletedSlugs, type DayRow } from '@/lib/days'
import { useEntitlement } from '@/lib/entitlement'
import { hapticSelect, hapticSuccess } from '@/lib/haptics'
import { useProfile } from '@/lib/profile'
import { REC, RECORDING } from '@/lib/recording'
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
//
// SAMPLE MODE (?sample=1): opens on the populated Today home (the same TodayHome
// component the real Today tab renders) filled with a fixed 10-minute deficit
// morning, then the same two-phase ritual. Nothing loads from or writes to the
// store. Two surfaces link here:
//  • The first-run Today page (entitled user, no history) — the click-through
//    ends by directing them to Reflect to set up tomorrow.
//  • The paywall's "View a sample routine" (not yet entitled) — the click-through
//    ends with the compounding pitch and returns them to the paywall.

// Same sheen as Today's START button, so the two read as one mechanism.
const GOLD_GRADIENT = ['#A87F4A', '#8C6736'] as const

// The sample morning: behind (readiness 4) a demanding day (7), with 10 minutes.
// Pure + deterministic, so every new user sees the same well-formed routine.
const SAMPLE_READINESS = 4
const SAMPLE_DAY_DIFFICULTY = 7
const SAMPLE_MINUTES = 10
const SAMPLE_PLAN = generatePlan({
  readiness: SAMPLE_READINESS,
  dayDifficulty: SAMPLE_DAY_DIFFICULTY,
  routineMinutes: SAMPLE_MINUTES,
})

// 'home' (sample only: the populated Today view) → 'focal' → 'sequence'
type Phase = 'home' | 'focal' | 'sequence'

// Fade each top-level screen state in so loading → content and the error / empty
// states never hard-cut (mirrors Today's state fader). Keyed per state so it
// re-animates only on a real state change.
function wrap(key: string, node: ReactNode) {
  return (
    <Animated.View key={key} entering={FadeIn.duration(260)} style={{ flex: 1 }}>
      {node}
    </Animated.View>
  )
}

export default function RoutineScreen() {
  const router = useRouter()
  // Sample mode flag (see header comment); entitlement tells the two sample
  // origins apart (first-run Today vs. the paywall).
  const { sample } = useLocalSearchParams<{ sample?: string }>()
  const isSample = sample === '1'
  const { entitled } = useEntitlement()
  // For the sample's home view greeting — paywall visitors and first-run users
  // have both completed onboarding, so a first name exists.
  const { profile } = useProfile()

  const [loading, setLoading] = useState(!isSample)
  const [loadError, setLoadError] = useState(false)
  const [row, setRow] = useState<DayRow | null>(null)
  const [completed, setCompleted] = useState<string[]>([])
  // The sample opens on the beautiful Today home; a real morning opens on focal.
  const [phase, setPhase] = useState<Phase>(isSample ? 'home' : 'focal')
  const [saveError, setSaveError] = useState<string | null>(null)

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = useCallback(() => {
    if (isSample) return // nothing to load — the sample plan is fixed
    setLoading(true)
    setLoadError(false)
    getDay(logicalDate())
      .then((r) => {
        if (!mounted.current) return
        setRow(r)
        // RECORDING: ignore any real completed steps so every take starts fresh on
        // the focal phase (never resumes as "already done"). See recording.ts.
        const slugs = RECORDING ? [] : (r?.completed_slugs ?? [])
        setCompleted(slugs)
        // Focal point already done earlier → resume on the checklist.
        if (!RECORDING && r?.plan && slugs.includes(r.plan.oneThing.slug)) setPhase('sequence')
        setLoading(false)
      })
      .catch(() => {
        if (!mounted.current) return
        // A real fetch failure is distinct from "not checked in yet" (which loads
        // fine and just has no plan) — surface it as a retryable error, not the
        // "no routine yet" empty state that would wrongly send them to Today.
        setLoadError(true)
        setLoading(false)
      })
  }, [isSample])

  useEffect(() => {
    load()
  }, [load])

  const plan = isSample ? SAMPLE_PLAN : (row?.plan ?? null)
  const focal = plan?.oneThing ?? null
  // The optional remainder — everything in the sequence except the focal point.
  const rest: Action[] = plan ? plan.sequence.filter((a) => a.slug !== plan.oneThing.slug) : []
  // ⚠️ RECORDING overrides (marketing footage) — display only; focal.slug still
  // drives completion. See src/lib/recording.ts.
  const focalTitle = RECORDING ? REC.focalTitle : (focal?.title ?? '')
  const focalExample = RECORDING ? REC.focalExample : (focal?.example ?? '')

  // Optimistic check-off: the UI flips instantly, the write follows. A failed
  // write surfaces quietly and the evening reflection remains the safety net.
  // Sample mode never writes — the check-offs are just for the feel of it.
  //
  // Writes are chained so rapid taps persist in tap order: each save waits for the
  // previous to settle, so an earlier request can't land after a later one and
  // leave `completed_slugs` stale relative to what's on screen.
  const writeChain = useRef<Promise<unknown>>(Promise.resolve())
  const persist = (slugs: string[]) => {
    setCompleted(slugs)
    if (isSample) return
    setSaveError(null)
    writeChain.current = writeChain.current
      .catch(() => {})
      .then(() => saveCompletedSlugs(logicalDate(), slugs))
      .catch(() => {
        if (mounted.current)
          setSaveError('Couldn’t save just now — tonight’s reflection will catch anything missed.')
      })
  }

  const completeFocal = () => {
    if (!focal) return
    if (!completed.includes(focal.slug)) {
      hapticSuccess()
      persist([...completed, focal.slug])
    }
    setPhase('sequence')
  }

  const toggle = (slug: string) => {
    hapticSelect()
    persist(
      completed.includes(slug) ? completed.filter((s) => s !== slug) : [...completed, slug],
    )
  }

  const close = () => router.back()

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return wrap(
      'loading',
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Loading label="Getting your morning…" />
      </SafeAreaView>,
    )
  }

  // ── Load failed (network/store error, not "not checked in") ──────────────────
  if (loadError) {
    return wrap(
      'error',
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Header onClose={close} />
        <View style={styles.emptyWrap}>
          <Feather name="cloud-off" size={26} color={day.muted} />
          <Text style={styles.emptyTitle}>Couldn’t load your morning.</Text>
          <Text style={styles.emptyBody}>Check your connection and try again.</Text>
          <Pressable style={styles.button} onPress={load} accessibilityRole="button">
            <LinearGradient colors={GOLD_GRADIENT} style={styles.buttonFill}>
              <Text style={styles.buttonLabel}>Try again</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  // ── Sample, phase 0: the populated Today home, exactly as the real one renders.
  // START drops into the focal phase; the X returns to wherever they came from
  // (the paywall, or the first-run Today page). ────────────────────────────────
  if (isSample && phase === 'home') {
    return (
      <TodayHome
        userName={profile?.first_name?.trim() || 'there'}
        weather={null}
        readiness={SAMPLE_READINESS}
        dayDifficulty={SAMPLE_DAY_DIFFICULTY}
        gapState={SAMPLE_PLAN.state}
        plan={SAMPLE_PLAN}
        completedSlugs={completed}
        lastNight="Steady"
        insight="Days you finish your focal point, your energy runs about 2 points higher."
        onStart={() => setPhase('focal')}
        onClose={close}
      />
    )
  }

  // ── No plan yet (deep link / not checked in) ────────────────────────────────
  if (!plan || !focal) {
    return wrap(
      'empty',
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
          {/* Sample mode: name the hypothetical so the routine reads as an example. */}
          {isSample && (
            <Text style={styles.sampleNote}>
              A sample morning — ten minutes, built as if you woke up behind a demanding day.
            </Text>
          )}
          <View style={styles.focalHero}>
            <Feather name="sun" size={24} color={day.gold} />
            <Text style={styles.eyebrow}>{isSample ? 'Sample · your focal point' : 'Your focal point'}</Text>
            <Text style={styles.focalTitle}>{focalTitle}</Text>
            {focalExample ? <Text style={styles.focalExample}>{focalExample}</Text> : null}
            {!RECORDING && focal.description ? (
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
              {/* A paywall visitor's "back" is the paywall, not Today. */}
              <Text style={styles.quietLabel}>
                {isSample && !entitled ? 'Back' : 'Back to Today'}
              </Text>
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
            <Text style={styles.doneTitle}>The hardest part is behind you — the day is yours.</Text>
            <Text style={styles.doneSub}>{focalTitle}</Text>
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
          {/* Sample mode hands off by origin: an entitled first-run user goes to
              Reflect (the real loop starts by setting up tomorrow); a paywall
              visitor gets the compounding pitch and returns to the paywall.
              A real morning just returns to Today. */}
          {isSample ? (
            <>
              <Text style={styles.sampleHandoff}>
                {entitled
                  ? 'That’s the shape of a morning. Yours will be built for how you actually wake up — starting tomorrow.'
                  : 'That was a sample, built for no one in particular. Yours will be built from your own mornings — and every check-in and reflection makes it sharper.'}
              </Text>
              <Pressable
                style={styles.button}
                onPress={entitled ? () => router.replace('/reflect') : close}
                accessibilityRole="button"
              >
                <LinearGradient colors={GOLD_GRADIENT} style={styles.buttonFill}>
                  <Text style={styles.buttonLabel}>
                    {entitled ? 'Set up tomorrow in Reflect' : 'Start your free week'}
                  </Text>
                </LinearGradient>
              </Pressable>
              {entitled && (
                <Pressable style={styles.quietLink} onPress={close} accessibilityRole="button">
                  <Text style={styles.quietLabel}>Back to Today</Text>
                </Pressable>
              )}
            </>
          ) : (
            <Pressable style={styles.button} onPress={close} accessibilityRole="button">
              <LinearGradient colors={GOLD_GRADIENT} style={styles.buttonFill}>
                <Text style={styles.buttonLabel}>Back to Today</Text>
              </LinearGradient>
            </Pressable>
          )}
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
  // Sample mode framing lines — quiet, editorial, never competing with the move.
  sampleNote: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 21,
    color: day.muted,
    textAlign: 'center',
    marginTop: 8,
    alignSelf: 'center',
    maxWidth: 300,
  },
  sampleHandoff: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14.5,
    lineHeight: 22,
    color: day.muted,
    textAlign: 'center',
    marginTop: 26,
    alignSelf: 'center',
    maxWidth: 320,
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
    flexGrow: 1, // lets the content center vertically when it fits on screen
    justifyContent: 'center',
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
    backgroundColor: day.goldTint, // a whisper of gold so done rows read as settled
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
