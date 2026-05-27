import { Feather } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState, type ReactNode } from 'react'
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

import { Scale } from '@/components/reflect/Scale'
import { TimeStepper } from '@/components/reflect/TimeStepper'
import { recommendSleep } from '@/engine/sleep'
import type { Lookback, ReadinessState } from '@/engine/types'
import { windDownSequence } from '@/engine/windDown'
import { getDay, localDate, saveEvening } from '@/lib/days'
import { errorMessage } from '@/lib/errors'
import { EVENING_HOUR, formatHours, shiftClock, to12h } from '@/lib/time'
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
      return `This morning you were running a deficit against a ${dayDifficulty}/10 day.`
    case 'aligned':
      return `This morning you were matched to a ${dayDifficulty}/10 day.`
    case 'surplus':
      return `This morning you had a surplus over a ${dayDifficulty}/10 day.`
  }
}

const NO_MORNING_RECAP = 'No check-in this morning — just go on how today felt.'

const LOOKBACK_OPTIONS: { value: Lookback; label: string; sub: string }[] = [
  { value: 'behind', label: 'Behind it', sub: 'The day outran me.' },
  { value: 'matched', label: 'Matched it', sub: 'I was where I needed to be.' },
  { value: 'ahead', label: 'Ahead of it', sub: 'I had more than it asked.' },
]

// The ritual's beats, in order. One per screen. Optional beats sit at the end so
// the required core stays short; they can be skipped.
const STEPS = ['lookback', 'reads', 'demand', 'sleep', 'windDown', 'note'] as const
type StepKey = (typeof STEPS)[number]
const OPTIONAL_STEPS: StepKey[] = ['note']

// We capture leave-by (the morning deadline that sizes tomorrow's sequence), not
// wake time — so to drive the sleep math we assume a fixed get-ready buffer
// between waking and heading out. TODO: make this buffer user-configurable.
const GET_READY_MINUTES = 75

type Phase = 'intro' | 'flow' | 'done'

export default function ReflectScreen() {
  const weekday = WEEKDAYS[new Date().getDay()]
  const isEvening = new Date().getHours() >= EVENING_HOUR

  // This morning's call, loaded from today's stored row for the look-back recap.
  const [morningCall, setMorningCall] = useState(NO_MORNING_RECAP)
  useEffect(() => {
    let active = true
    getDay(localDate())
      .then((row) => {
        if (active && row?.state && row.day_difficulty != null) {
          setMorningCall(recapLine(row.state, row.day_difficulty))
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const [phase, setPhase] = useState<Phase>('intro')
  const [step, setStep] = useState(0)

  // Answers.
  const [lookback, setLookback] = useState<Lookback | null>(null)
  const [energy, setEnergy] = useState(6)
  const [mood, setMood] = useState(6)
  const [focus, setFocus] = useState(6)
  const [note, setNote] = useState('')
  const [demand, setDemand] = useState(5)
  const [leaveBy, setLeaveBy] = useState('07:45')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Leave-by drives both: tonight's sleep target (via an assumed wake time) and
  // tomorrow's morning budget.
  const assumedWake = shiftClock(leaveBy, -GET_READY_MINUTES)
  const sleep = recommendSleep(demand, assumedWake)
  const windDown = windDownSequence(demand)

  // A soft fade as each beat (and phase) changes — the evening wind-down feel.
  const fade = useRef(new Animated.Value(1)).current
  useEffect(() => {
    fade.setValue(0)
    Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }).start()
  }, [phase, step, fade])

  const key = STEPS[step]
  const isLast = step === STEPS.length - 1
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
        tomorrowDemand: demand,
        leaveBy,
        sleep,
      })
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
          <View style={styles.introWrap}>
            <View>
              <Text style={styles.eyebrow}>{weekday} evening</Text>
              <Text style={styles.introTitle}>Let&rsquo;s close out {weekday}.</Text>
              <Text style={styles.introRecap}>{morningCall}</Text>
              <Text style={styles.introBody}>
                It only takes a minute — a few quiet questions on how today went, and how to
                set up tomorrow.
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
        <Animated.View style={[styles.doneWrap, { opacity: fade }]}>
          <View>
            <Text style={styles.eyebrow}>You&rsquo;re set for tomorrow</Text>
            <Text style={styles.doneTitle}>Rest well.</Text>
          </View>

          <View style={styles.previewCard}>
            <PreviewRow label="Tomorrow" value={`${demand}/10`} />
            <PreviewRow label="Out the door" value={to12h(leaveBy)} />
            <PreviewRow
              label="Lights out by"
              value={`${to12h(sleep.bedtime)} · ${formatHours(sleep.targetHours)}`}
            />
            <PreviewRow
              label="Wind-down"
              value={`${windDown.length} ${windDown.length === 1 ? 'move' : 'moves'}`}
              last
            />
          </View>

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
        </Animated.View>
      </SafeAreaView>
    )
  }

  // ── Flow ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.progressRow}>
          <Pressable onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <Feather name="chevron-left" size={24} color={day.muted} />
          </Pressable>
          <View style={styles.dots}>
            {STEPS.map((s, i) => (
              <View key={s} style={[styles.dot, i <= step ? styles.dotOn : styles.dotOff]} />
            ))}
          </View>
          <View style={styles.progressSpacer} />
        </View>

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
              leaveBy,
              setLeaveBy,
              sleep,
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
  leaveBy: string
  setLeaveBy: (s: string) => void
  sleep: ReturnType<typeof recommendSleep>
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

    case 'sleep':
      return (
        <StepHeader eyebrow="Sleep & schedule" question="When do you head out tomorrow?">
          <Text style={styles.scheduleLabel}>Out the door by</Text>
          <TimeStepper value={p.leaveBy} onChange={p.setLeaveBy} />
          <View style={styles.sleepDivider} />
          <Text style={styles.sleepRx}>
            For a {p.demand}/10 day, aim for {formatHours(p.sleep.targetHours)} of sleep.
          </Text>
          <View style={styles.sleepBedRow}>
            <Feather name="moon" size={18} color={day.gold} />
            <Text style={styles.sleepBed}>Lights out by {to12h(p.sleep.bedtime)}</Text>
          </View>
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

function PreviewRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.previewRow, !last && styles.previewRowBorder]}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={styles.previewValue}>{value}</Text>
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
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 34,
    color: day.text,
    marginTop: 10,
  },
  introRecap: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: day.muted,
    marginTop: 14,
  },
  introBody: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: day.text,
    marginTop: 16,
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

  // Progress
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  dots: {
    flex: 1,
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
  progressSpacer: {
    width: 24, // balances the back chevron so the dots stay centered
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

  // Sleep
  sleepRx: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 18,
    lineHeight: 26,
    color: day.text,
  },
  sleepBedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  sleepBed: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    color: day.gold,
  },
  scheduleLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: day.muted,
    marginBottom: 14,
  },
  sleepDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: day.border,
    marginVertical: 28,
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
    paddingVertical: 40,
    justifyContent: 'space-between',
  },
  doneTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 40,
    color: day.text,
    marginTop: 10,
  },
  previewCard: {
    backgroundColor: day.surface,
    borderRadius: 16,
    paddingHorizontal: 20,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
  },
  previewRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: day.border,
  },
  previewLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    color: day.muted,
  },
  previewValue: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 15,
    color: day.text,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  editLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  editLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    color: day.muted,
    textDecorationLine: 'underline',
  },
})
