import { Feather } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Animated,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Scale } from '@/components/reflect/Scale'
import { WakeRoutineStep } from '@/components/reflect/WakeRoutineStep'
import type { ReadinessState } from '@/engine/types'
import { applyWakeAlarm, DEFAULT_VOICE } from '@/lib/alarm'
import { addDays, getDay, logicalDate, peekDay, saveEvening } from '@/lib/days'
import { pregenerateTomorrow } from '@/lib/routine'
import { errorMessage } from '@/lib/errors'
import {
  DEFAULT_ROUTINE_MINUTES,
  getPreferredRoutineMinutes,
  setPreferredRoutineMinutes,
} from '@/lib/prefs'
import { updateProfile, useProfile } from '@/lib/profile'
import { isEveningNow, logicalNow } from '@/lib/time'
import { day } from '@/theme/colors'

const DEFAULT_WAKE_TIME = '07:00'

// Intro background fade: a top→bottom gradient that holds the app's cream over
// the top ~15%, fades out by ~40% down, and is transparent below — so the image
// fills the bottom ~60% while the title sits on a clean cream field up top.
const INTRO_FADE = [day.background, day.background, `${day.background}00`] as const
const INTRO_FADE_LOCATIONS = [0, 0.15, 0.4] as const

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// This morning's call, rebuilt from the stored morning check-in so the look-back
// compares against what actually happened — with a gentle fallback if there was
// no check-in today.
function recapLine(state: ReadinessState, dayDifficulty: number): string {
  switch (state) {
    case 'deficit':
      return `You woke behind a ${dayDifficulty}/10 day — a morning to restore.`
    case 'aligned':
      return `You woke Ready, matched to a ${dayDifficulty}/10 day.`
    case 'surplus':
      return `You woke Charged, ahead of a ${dayDifficulty}/10 day.`
  }
}

const NO_MORNING_RECAP = 'No check-in this morning — just go on how today felt.'

// The evening ritual, trimmed to its core: today's reads, tomorrow's demand, and
// the combined wake-alarm + morning-length setup. One beat per screen.
const ALL_STEPS = ['reads', 'demand', 'wakeRoutine'] as const
type StepKey = (typeof ALL_STEPS)[number]

type Phase = 'intro' | 'flow' | 'done'

export default function ReflectScreen() {
  // Recompute the clock-derived values on every focus: the tab can sit mounted
  // across the 5pm evening threshold (or the 3am rollover), and without this the
  // gate would stay shut — or the weekday header stale — until some other state
  // change forced a re-render.
  const [, setFocusTick] = useState(0)
  useFocusEffect(
    useCallback(() => {
      setFocusTick((t) => t + 1)
    }, []),
  )
  // useFocusEffect misses the app being foregrounded while Reflect is already the
  // active tab, so the evening gate / weekday header could stay stale across a
  // background/foreground cycle over the 5pm or 3am threshold. Recompute on
  // AppState → active too.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setFocusTick((t) => t + 1)
    })
    return () => sub.remove()
  }, [])

  // Logical clock: until 3am, "tonight" still belongs to yesterday's date, so
  // the weekday header, the evening gate, and every row read/write agree.
  const weekday = WEEKDAYS[logicalNow().getDay()]
  const isEvening = isEveningNow()

  // Wake-alarm: the combined setup step confirms tomorrow's wake time and whether
  // the voice alarm is on at all, writing back to the standing profile pref.
  const { profile, refresh: refreshProfile } = useProfile()

  // This morning's call, loaded from today's stored row — it anchors the intro
  // recap. If tonight's reflection was already saved (evening_completed_at set —
  // e.g. the app reloaded since), every answer is restored from the two rows it
  // was written to and the screen resumes on the done phase, where "Edit tonight's
  // check-in" reopens the flow with those answers — never a blank intro.
  // Seed from the day cache (Today warms it) so the personalized recap + a restored
  // "done" phase are correct on first paint — no swap from the fallback text, and no
  // flash of the intro before a saved reflection restores. The effect below still runs
  // to confirm and to load the full answer set (for editing) when the cache is cold.
  const [morningCall, setMorningCall] = useState(() => {
    const row = peekDay(logicalDate())
    return row?.state && row.day_difficulty != null
      ? recapLine(row.state, row.day_difficulty)
      : NO_MORNING_RECAP
  })

  const [phase, setPhase] = useState<Phase>(() => {
    const row = peekDay(logicalDate())
    return row?.evening_completed_at ? 'done' : 'intro'
  })
  const [step, setStep] = useState(0)

  // The flow is a fixed three beats now, so the step list never changes.
  const activeSteps = ALL_STEPS

  // Answers.
  const [energy, setEnergy] = useState(6)
  const [mood, setMood] = useState(6)
  const [focus, setFocus] = useState(6)
  const [demand, setDemand] = useState(5)
  const [routineMinutes, setRoutineMinutes] = useState(DEFAULT_ROUTINE_MINUTES)
  // The voice-alarm toggle defaults on; seeded from the profile below.
  const [wakeEnabled, setWakeEnabled] = useState(true)
  const [wakeTime, setWakeTime] = useState(DEFAULT_WAKE_TIME)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Seed the wake toggle + time from the standing profile (outside the flow, so an
  // in-progress edit is never clobbered when the provider refreshes).
  useEffect(() => {
    if (phase === 'flow') return
    if (profile?.wake_time) setWakeTime(profile.wake_time)
    if (profile?.wake_enabled != null) setWakeEnabled(profile.wake_enabled)
  }, [profile?.wake_time, profile?.wake_enabled, phase])

  // Guards the post-await setState in finish() — the only place that mutates state
  // after an awaited write, so a close mid-save can't set state on an unmounted tree.
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Load today's stored row (and tomorrow's, for a saved reflection's setup half).
  // Runs once on mount — after every state hook above so the restore can seed them.
  useEffect(() => {
    let active = true
    Promise.all([getDay(logicalDate()), getDay(addDays(logicalDate(), 1))])
      .then(([row, tomorrow]) => {
        if (!active) return
        const restoring = !!row?.evening_completed_at
        if (row) {
          if (row.state && row.day_difficulty != null) {
            setMorningCall(recapLine(row.state, row.day_difficulty))
          }
          if (restoring) {
            // Tonight's reflection is already saved (e.g. the app reloaded since):
            // restore every answer and resume on the done screen — never a blank
            // intro. "Edit tonight's check-in" reopens the flow with these values.
            if (row.energy != null) setEnergy(row.energy)
            if (row.mood != null) setMood(row.mood)
            if (row.focus != null) setFocus(row.focus)
            // Demand + routine length live on tomorrow's row (see saveEvening).
            if (tomorrow?.day_difficulty != null) setDemand(tomorrow.day_difficulty)
            if (tomorrow?.routine_minutes != null) setRoutineMinutes(tomorrow.routine_minutes)
            setPhase('done')
          }
        }
        // Fresh reflection only: seed the routine length from the standing
        // preference. Skipped when restoring, so it can never clobber the length
        // actually saved for tomorrow (the two used to race in separate effects).
        if (!restoring) {
          getPreferredRoutineMinutes().then((m) => {
            if (active) setRoutineMinutes(m)
          })
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Close the ritual back to Today. The bottom tab bar is hidden for the whole
  // Reflect tab statically in (tabs)/_layout.tsx (not via in-screen setOptions),
  // which is what keeps entering/leaving the tab flicker-free; the X / Done buttons
  // are the way out. Phase is left as-is, so re-opening resumes where they were.
  const router = useRouter()
  const close = () => router.navigate('/')

  // A soft fade as each beat (and phase) changes — the evening wind-down feel.
  const fade = useRef(new Animated.Value(1)).current
  useEffect(() => {
    fade.setValue(0)
    Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }).start()
  }, [phase, step, fade])

  const key = activeSteps[step]
  const isLast = step === activeSteps.length - 1

  // Persist the whole reflection on finish: today's review + tomorrow's setup.
  const finish = async () => {
    if (saving) return
    setSaving(true)
    setSaveError(null)
    try {
      await saveEvening(logicalDate(), {
        reads: { energy, mood, focus },
        tomorrowDemand: demand,
        routineMinutes,
      })
      // Remember this length as the new standing default for next time.
      void setPreferredRoutineMinutes(routineMinutes)
      // Persist the wake toggle + tomorrow's time, and arm/cancel the alarm to
      // match (best-effort — the reflection is already saved, so a failure here
      // never blocks it).
      try {
        await updateProfile({ wakeEnabled, wakeTime })
        await applyWakeAlarm({
          enabled: wakeEnabled,
          time: wakeEnabled ? wakeTime : null,
          voice: profile?.wake_voice ?? DEFAULT_VOICE,
        })
        void refreshProfile()
      } catch {
        // non-fatal
      }
      // Pre-generate tomorrow's personalized routine in the background (best-effort,
      // off the hot path) so the morning open is instant. Never blocks the ritual.
      void pregenerateTomorrow(logicalDate())
      if (mounted.current) setPhase('done')
    } catch (e) {
      if (mounted.current) setSaveError(errorMessage(e, 'Couldn’t save just now — give it another try.'))
    } finally {
      if (mounted.current) setSaving(false)
    }
  }

  const back = () => (step === 0 ? setPhase('intro') : setStep((s) => s - 1))
  const next = () => (isLast ? finish() : setStep((s) => s + 1))

  // ── Gate ────────────────────────────────────────────────────────────────────
  // Reflect is an evening ritual — closing out a day that isn't over yet doesn't
  // land. Before evening (and before you've begun), a gentle wall instead of the
  // ritual. The threshold is shared with Today, so Today's "set up tomorrow"
  // pivot only appears once this is unlocked (no dead-end link).
  if (!isEvening && phase === 'intro') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <RitualHeader onClose={close} />
        <View style={styles.gateWrap}>
          <Feather name="moon" size={26} color={day.gold} />
          <Text style={styles.gateTitle}>Come back this evening.</Text>
          <Text style={styles.gateBody}>
            Reflect opens tonight, once the day&rsquo;s behind you — that&rsquo;s when closing
            it out actually lands.
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  // ── Intro ──────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <View style={styles.safe}>
        {/* Full-bleed background that fades into the cream up top. */}
        <Image
          source={require('../../../assets/images/reflect-bg.jpg')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={250}
        />
        <LinearGradient
          colors={INTRO_FADE}
          locations={INTRO_FADE_LOCATIONS}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
          <RitualHeader onClose={close} />
          <View style={styles.introWrap}>
            <View>
              <Text style={styles.eyebrow}>{weekday} evening</Text>
              <Text style={styles.introTitle}>Let&rsquo;s close out {weekday}.</Text>
              <Text style={styles.introRecap}>{morningCall}</Text>
              <Text style={styles.introBody}>
                A minute of reflection now helps you finish today and start tomorrow clearer.
              </Text>
            </View>
            <Pressable
              style={styles.beginButton}
              onPress={() => {
                setStep(0)
                setPhase('flow')
              }}
              accessibilityRole="button"
            >
              <Text style={styles.beginLabel}>Begin tonight&rsquo;s reflection</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    )
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Image
          source={require('../../../assets/images/reflect-bg.jpg')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={250}
        />
        <LinearGradient
          colors={INTRO_FADE}
          locations={INTRO_FADE_LOCATIONS}
          style={StyleSheet.absoluteFill}
        />
        <RitualHeader onClose={close} />
        <Animated.View style={[styles.doneWrap, { opacity: fade }]}>
          <View>
            <Text style={styles.eyebrow}>You&rsquo;re set for tomorrow</Text>
            <Text style={styles.doneTitle}>Rest well.</Text>
          </View>

          <View>
            <Pressable style={styles.beginButton} onPress={close} accessibilityRole="button">
              <Text style={styles.beginLabel}>Done</Text>
            </Pressable>
            <Pressable
              style={styles.editLink}
              onPress={() => {
                setStep(0)
                setPhase('flow')
              }}
              accessibilityRole="button"
            >
              <Text style={styles.editLabel}>Edit tonight&rsquo;s check-in</Text>
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>
    )
  }

  // ── Flow ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Same evening image as the intro, washed far back so it reads as a faint
          texture behind the questions rather than a full background. */}
      <Image
        source={require('../../../assets/images/reflect-bg.jpg')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={250}
      />
      <View style={[StyleSheet.absoluteFill, styles.flowWash]} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <RitualHeader onClose={close} onBack={back}>
          <View style={styles.dots}>
            {activeSteps.map((s, i) => (
              <View key={s} style={[styles.dot, i <= step ? styles.dotOn : styles.dotOff]} />
            ))}
          </View>
        </RitualHeader>

        <Animated.View style={[styles.flex, { opacity: fade }]}>
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {renderStep(key, {
              energy,
              setEnergy,
              mood,
              setMood,
              focus,
              setFocus,
              demand,
              setDemand,
              routineMinutes,
              setRoutineMinutes,
              wakeEnabled,
              setWakeEnabled,
              wakeTime,
              setWakeTime,
            })}
          </ScrollView>
        </Animated.View>

        <View style={styles.footer}>
          <Pressable
            style={[styles.continueButton, saving && styles.continueDisabled]}
            onPress={next}
            disabled={saving}
            accessibilityRole="button"
          >
            {saving ? (
              <View style={styles.busyRow}>
                <ActivityIndicator color={day.onAccent} />
                <Text style={styles.continueLabel}>Saving…</Text>
              </View>
            ) : (
              <Text style={styles.continueLabel}>{isLast ? 'Set for tomorrow' : 'Continue'}</Text>
            )}
          </Pressable>
          {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ── Step bodies ─────────────────────────────────────────────────────────────

type StepProps = {
  energy: number
  setEnergy: (n: number) => void
  mood: number
  setMood: (n: number) => void
  focus: number
  setFocus: (n: number) => void
  demand: number
  setDemand: (n: number) => void
  routineMinutes: number
  setRoutineMinutes: (n: number) => void
  wakeEnabled: boolean
  setWakeEnabled: (v: boolean) => void
  wakeTime: string
  setWakeTime: (t: string) => void
}

function renderStep(key: StepKey, p: StepProps) {
  switch (key) {
    case 'reads':
      return (
        <StepHeader eyebrow="Your reads" question="How were energy, mood, and focus today?">
          <Scale label="Energy" value={p.energy} onChange={p.setEnergy} />
          <Scale label="Mood" value={p.mood} onChange={p.setMood} />
          <Scale label="Focus" value={p.focus} onChange={p.setFocus} />
        </StepHeader>
      )

    case 'demand':
      return (
        <StepHeader eyebrow="Tomorrow" question="What will tomorrow ask of you?">
          <Scale
            label="Demand"
            value={p.demand}
            onChange={p.setDemand}
            lowLabel="open & restful"
            highLabel="demanding"
          />
        </StepHeader>
      )

    case 'wakeRoutine':
      return (
        <StepHeader
          eyebrow="Tomorrow's morning"
          question="How do you want to wake, and how long?"
          helper="Your voice alarm and morning length — set them just for tomorrow."
        >
          <WakeRoutineStep
            wakeEnabled={p.wakeEnabled}
            onWakeEnabledChange={p.setWakeEnabled}
            wakeTime={p.wakeTime}
            onWakeTimeChange={p.setWakeTime}
            routineMinutes={p.routineMinutes}
            onRoutineMinutesChange={p.setRoutineMinutes}
          />
        </StepHeader>
      )
  }
}

// The ritual's top bar, shared by every phase. The X (always present) closes the
// ritual; the back arrow only appears once the user is past the intro. `children`
// is the centered content — the progress dots during the flow, empty otherwise.
function RitualHeader({
  onClose,
  onBack,
  children,
}: {
  onClose: () => void
  onBack?: () => void
  children?: ReactNode
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <Feather name="chevron-left" size={24} color={day.muted} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.headerCenter}>{children}</View>
      <View style={[styles.headerSide, styles.headerSideRight]}>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
          <Feather name="x" size={24} color={day.muted} />
        </Pressable>
      </View>
    </View>
  )
}

function StepHeader({
  eyebrow,
  question,
  helper,
  optional,
  children,
}: {
  eyebrow: string
  question: string
  helper?: string
  optional?: boolean
  children: ReactNode
}) {
  return (
    <View>
      <Text style={styles.eyebrow}>
        {eyebrow}
        {optional ? '  ·  optional' : ''}
      </Text>
      <Text style={styles.question}>{question}</Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
      <View style={styles.stepBody}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: day.background,
  },
  flex: {
    flex: 1,
  },
  // Cream wash over the flow's background image — the photo reads ~22%, a soft
  // texture behind the questions. Raise the alpha to fade it further.
  flowWash: {
    backgroundColor: 'rgba(250, 248, 244, 0.78)',
  },

  // Gate (before evening)
  gateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  gateTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 26,
    color: day.text,
    marginTop: 18,
    textAlign: 'center',
  },
  gateBody: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    lineHeight: 23,
    color: day.muted,
    textAlign: 'center',
    marginTop: 12,
  },

  // Shared
  eyebrow: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: day.muted,
  },

  // Intro
  introWrap: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 40,
    justifyContent: 'space-between',
  },
  introTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 34,
    color: day.text,
    marginTop: 10,
  },
  // The personalized hook — today's actual morning call. Muted + regular so it
  // sits below the title.
  introRecap: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: day.muted,
    marginTop: 26,
  },
  introBody: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 15,
    lineHeight: 22,
    color: day.text,
    marginTop: 26,
  },
  beginButton: {
    backgroundColor: day.gold,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  beginLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: day.onAccent,
  },



  // Header (shared across phases: back · dots · close)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerSide: {
    width: 24, // icon width; equal on both sides so the center content stays centered
  },
  headerSideRight: {
    alignItems: 'flex-end', // pins the X to the right edge
  },
  headerCenter: {
    flex: 1,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotOn: {
    backgroundColor: day.gold,
  },
  dotOff: {
    backgroundColor: day.border,
  },

  // Step
  body: {
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 28,
  },
  question: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
    lineHeight: 34,
    color: day.text,
    marginTop: 10,
  },
  helper: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: day.muted,
    marginTop: 10,
  },
  stepBody: {
    marginTop: 30,
  },

  // Footer
  footer: {
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 8,
  },
  continueButton: {
    backgroundColor: day.gold,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  continueDisabled: {
    opacity: 0.35,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saveError: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    color: day.negative,
    textAlign: 'center',
    marginTop: 10,
  },
  continueLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: day.onAccent,
  },

  // Done
  doneWrap: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 16, // less bottom padding pushes the Done button + edit link lower
    justifyContent: 'space-between',
  },
  doneTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 40,
    color: day.text,
    marginTop: 10,
  },
  editLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  editLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    // Sits over the dark lower third of the photo (river + mountains), so it's
    // light with a soft shadow to stay legible over both the dark water and the
    // bright moonlight reflection.
    color: day.background,
    textDecorationLine: 'underline',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
})
