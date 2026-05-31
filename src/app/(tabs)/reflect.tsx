import { Feather } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { DurationStepper } from '@/components/reflect/DurationStepper'
import { Scale } from '@/components/reflect/Scale'
import type { Action, Lookback, ReadinessState } from '@/engine/types'
import { windDownSequence } from '@/engine/windDown'
import { getDay, localDate, saveEvening } from '@/lib/days'
import { pregenerateTomorrow } from '@/lib/routine'
import { errorMessage } from '@/lib/errors'
import {
  DEFAULT_ROUTINE_MINUTES,
  getPreferredRoutineMinutes,
  setPreferredRoutineMinutes,
} from '@/lib/prefs'
import { EVENING_HOUR } from '@/lib/time'
import { day } from '@/theme/colors'

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
      return `Today you were running a deficit against a ${dayDifficulty}/10 day.`
    case 'aligned':
      return `Today you were matched to a ${dayDifficulty}/10 day.`
    case 'surplus':
      return `Today you had a surplus over a ${dayDifficulty}/10 day.`
  }
}

const NO_MORNING_RECAP = 'No check-in this morning — just go on how today felt.'

const LOOKBACK_OPTIONS: { value: Lookback; label: string; sub: string }[] = [
  { value: 'behind', label: 'Behind it', sub: 'The day outran me.' },
  { value: 'matched', label: 'Matched it', sub: 'I was where I needed to be.' },
  { value: 'ahead', label: 'Ahead of it', sub: 'I had more than it asked.' },
]

// The ritual's beats, in order. One per screen. `completion` only appears when
// there was a morning check-in to look back on (no plan → nothing to tick off),
// so the live list is filtered per-session. Optional beats sit at the end so the
// required core stays short; they can be skipped.
const ALL_STEPS = ['lookback', 'completion', 'reads', 'demand', 'routine', 'windDown', 'note'] as const
type StepKey = (typeof ALL_STEPS)[number]
const OPTIONAL_STEPS: StepKey[] = ['note']

type Phase = 'intro' | 'flow' | 'done'

export default function ReflectScreen() {
  const weekday = WEEKDAYS[new Date().getDay()]
  const isEvening = new Date().getHours() >= EVENING_HOUR

  // This morning's call + the sequence it prescribed, loaded from today's stored
  // row. The call anchors the look-back recap; the sequence drives the completion
  // step. Any slugs already ticked off (a re-entry/edit) pre-seed the selection.
  const [morningCall, setMorningCall] = useState(NO_MORNING_RECAP)
  const [morningSequence, setMorningSequence] = useState<Action[]>([])
  const [completedSlugs, setCompletedSlugs] = useState<string[]>([])
  useEffect(() => {
    let active = true
    getDay(localDate())
      .then((row) => {
        if (!active || !row) return
        if (row.state && row.day_difficulty != null) {
          setMorningCall(recapLine(row.state, row.day_difficulty))
        }
        if (row.plan?.sequence.length) setMorningSequence(row.plan.sequence)
        if (row.completed_slugs?.length) setCompletedSlugs(row.completed_slugs)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const [phase, setPhase] = useState<Phase>('intro')
  const [step, setStep] = useState(0)

  // The completion beat is only meaningful when there was a morning plan to do.
  const steps = useMemo(
    () => ALL_STEPS.filter((s) => s !== 'completion' || morningSequence.length > 0),
    [morningSequence.length],
  )

  // Answers.
  const [lookback, setLookback] = useState<Lookback | null>(null)
  const [energy, setEnergy] = useState(6)
  const [mood, setMood] = useState(6)
  const [focus, setFocus] = useState(6)
  const [note, setNote] = useState('')
  const [demand, setDemand] = useState(5)
  const [routineMinutes, setRoutineMinutes] = useState(DEFAULT_ROUTINE_MINUTES)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Seed the routine stepper with the user's standing preference, so each evening
  // defaults to their usual length (adjustable per night). First run falls back to
  // DEFAULT_ROUTINE_MINUTES inside the helper.
  useEffect(() => {
    let active = true
    getPreferredRoutineMinutes().then((m) => {
      if (active) setRoutineMinutes(m)
    })
    return () => {
      active = false
    }
  }, [])

  const toggleSlug = (slug: string) =>
    setCompletedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    )

  // Close the ritual back to Today. The bottom tab bar is hidden for the whole
  // Reflect tab statically in (tabs)/_layout.tsx (not via in-screen setOptions),
  // which is what keeps entering/leaving the tab flicker-free; the X / Done buttons
  // are the way out. Phase is left as-is, so re-opening resumes where they were.
  const router = useRouter()
  const close = () => router.navigate('/')

  // Tomorrow's demand sizes tonight's wind-down sequence.
  const windDown = windDownSequence(demand)

  // A soft fade as each beat (and phase) changes — the evening wind-down feel.
  const fade = useRef(new Animated.Value(1)).current
  useEffect(() => {
    fade.setValue(0)
    Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }).start()
  }, [phase, step, fade])

  const key = steps[step]
  const isLast = step === steps.length - 1
  const isOptional = OPTIONAL_STEPS.includes(key)
  const canContinue = key !== 'lookback' || lookback !== null

  // Persist the whole reflection on finish: today's review + tomorrow's setup.
  // `finalNote` is passed in so Skip can save an empty note without waiting on
  // the async setNote('') to settle.
  const finish = async (finalNote: string) => {
    if (!lookback || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      await saveEvening(localDate(), {
        lookback,
        reads: { energy, mood, focus },
        note: finalNote.trim() || undefined,
        completedSlugs,
        tomorrowDemand: demand,
        routineMinutes,
      })
      // Remember this length as the new standing default for next time.
      void setPreferredRoutineMinutes(routineMinutes)
      // Pre-generate tomorrow's personalized routine in the background (best-effort,
      // off the hot path) so the morning open is instant. Never blocks the ritual.
      void pregenerateTomorrow(localDate())
      setPhase('done')
    } catch (e) {
      setSaveError(errorMessage(e, 'Could not save. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  const back = () => (step === 0 ? setPhase('intro') : setStep((s) => s - 1))
  const next = () => (isLast ? finish(note) : setStep((s) => s + 1))
  const skip = () => finish('')

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
          source={require('../../../assets/images/reflect-bg.png')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
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
          source={require('../../../assets/images/reflect-bg.png')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
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
        source={require('../../../assets/images/reflect-bg.png')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <View style={[StyleSheet.absoluteFill, styles.flowWash]} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <RitualHeader onClose={close} onBack={back}>
          <View style={styles.dots}>
            {steps.map((s, i) => (
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
              lookback,
              setLookback,
              morningCall,
              morningSequence,
              completedSlugs,
              toggleSlug,
              energy,
              setEnergy,
              mood,
              setMood,
              focus,
              setFocus,
              note,
              setNote,
              demand,
              setDemand,
              routineMinutes,
              setRoutineMinutes,
              windDown,
            })}
          </ScrollView>
        </Animated.View>

        <View style={styles.footer}>
          <Pressable
            style={[styles.continueButton, (!canContinue || saving) && styles.continueDisabled]}
            onPress={next}
            disabled={!canContinue || saving}
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
          {isOptional && !saving && (
            <Pressable style={styles.skipButton} onPress={skip} accessibilityRole="button">
              <Text style={styles.skipLabel}>Skip</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ── Step bodies ─────────────────────────────────────────────────────────────

type StepProps = {
  lookback: Lookback | null
  setLookback: (v: Lookback) => void
  morningCall: string
  morningSequence: Action[]
  completedSlugs: string[]
  toggleSlug: (slug: string) => void
  energy: number
  setEnergy: (n: number) => void
  mood: number
  setMood: (n: number) => void
  focus: number
  setFocus: (n: number) => void
  note: string
  setNote: (s: string) => void
  demand: number
  setDemand: (n: number) => void
  routineMinutes: number
  setRoutineMinutes: (n: number) => void
  windDown: ReturnType<typeof windDownSequence>
}

function renderStep(key: StepKey, p: StepProps) {
  switch (key) {
    case 'lookback':
      return (
        <StepHeader eyebrow="Look back" question="How did today land?" helper={p.morningCall}>
          <View style={styles.lookbackList}>
            {LOOKBACK_OPTIONS.map((opt) => {
              const selected = p.lookback === opt.value
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.lookbackOption, selected && styles.lookbackSelected]}
                  onPress={() => p.setLookback(opt.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.lookbackLabel, selected && styles.lookbackLabelOn]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.lookbackSub}>{opt.sub}</Text>
                </Pressable>
              )
            })}
          </View>
        </StepHeader>
      )

    case 'completion':
      return (
        <StepHeader
          eyebrow="This morning's plan"
          question="Which of these did you do?"
          helper="Tap the ones you got to. This is how Wake learns what actually helps you."
        >
          <View style={styles.completionList}>
            {p.morningSequence.map((move) => {
              const done = p.completedSlugs.includes(move.slug)
              return (
                <Pressable
                  key={move.slug}
                  style={[styles.completionRow, done && styles.completionRowOn]}
                  onPress={() => p.toggleSlug(move.slug)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                >
                  <View style={[styles.checkbox, done && styles.checkboxOn]}>
                    {done ? <Feather name="check" size={14} color={day.onAccent} /> : null}
                  </View>
                  <Text style={[styles.completionTitle, done && styles.completionTitleOn]}>
                    {move.title}
                  </Text>
                  <Text style={styles.completionMinutes}>{move.estMinutes} min</Text>
                </Pressable>
              )
            })}
          </View>
        </StepHeader>
      )

    case 'reads':
      return (
        <StepHeader eyebrow="Your reads" question="How were energy, mood, and focus today?">
          <Scale label="Energy" value={p.energy} onChange={p.setEnergy} />
          <Scale label="Mood" value={p.mood} onChange={p.setMood} />
          <Scale label="Focus" value={p.focus} onChange={p.setFocus} />
        </StepHeader>
      )

    case 'note':
      return (
        <StepHeader eyebrow="Tonight" question="Anything worth remembering?" optional>
          <TextInput
            style={styles.input}
            value={p.note}
            onChangeText={p.setNote}
            placeholder="One line about today…"
            placeholderTextColor={day.muted}
            multiline
            maxLength={140}
          />
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

    case 'routine':
      return (
        <StepHeader
          eyebrow="Tomorrow's routine"
          question="How long do you want your morning to take?"
          helper="Your usual length — nudge it longer or shorter just for tomorrow."
        >
          <Text style={styles.routineLabel}>Routine time</Text>
          <DurationStepper value={p.routineMinutes} onChange={p.setRoutineMinutes} />
        </StepHeader>
      )

    case 'windDown':
      return (
        <StepHeader eyebrow="Wind-down" question="Protect tomorrow, starting now.">
          <View style={styles.windList}>
            {p.windDown.map((move, i) => (
              <View key={move.slug} style={styles.windRow}>
                <Text style={styles.windIndex}>{i + 1}</Text>
                <View style={styles.windText}>
                  <Text style={styles.windTitle}>{move.title}</Text>
                  <Text style={styles.windDesc}>{move.description}</Text>
                </View>
              </View>
            ))}
          </View>
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

  // Look-back
  lookbackList: {
    gap: 12,
  },
  lookbackOption: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    backgroundColor: day.surface,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  lookbackSelected: {
    borderColor: day.gold,
  },
  lookbackLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    color: day.text,
  },
  lookbackLabelOn: {
    color: day.gold,
  },
  lookbackSub: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    color: day.muted,
    marginTop: 3,
  },

  // Completion (tick off this morning's moves)
  completionList: {
    gap: 12,
  },
  completionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    backgroundColor: day.surface,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  completionRowOn: {
    borderColor: day.gold,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: day.gold,
    borderColor: day.gold,
  },
  completionTitle: {
    flex: 1, // takes the middle so the minutes stay pinned right
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    lineHeight: 21,
    color: day.text,
  },
  completionTitleOn: {
    color: day.gold,
  },
  completionMinutes: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: day.muted,
  },

  // Text inputs
  input: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 18,
    lineHeight: 26,
    color: day.text,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: day.border,
    paddingBottom: 10,
    minHeight: 60,
  },

  // Routine duration
  routineLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: day.muted,
    marginBottom: 14,
  },

  // Wind-down
  windList: {
    gap: 18,
  },
  windRow: {
    flexDirection: 'row',
    gap: 14,
  },
  windIndex: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: day.gold,
    width: 16,
    marginTop: 1,
  },
  windText: {
    flex: 1,
  },
  windTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
    lineHeight: 23,
    color: day.text,
  },
  windDesc: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: day.muted,
    marginTop: 3,
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
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    color: day.muted,
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
