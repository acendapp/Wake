import { Feather, Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { CurationLoader } from '@/components/onboarding/CurationLoader'
import { WakeRoutineStep } from '@/components/reflect/WakeRoutineStep'
import { generatePlan } from '@/engine/generatePlan'
import { applyWakeAlarm, DEFAULT_VOICE } from '@/lib/alarm'
import { useAuth } from '@/lib/auth'
import { isValidEmail } from '@/lib/errors'
import {
  saveOnboarding,
  useProfile,
  type AgeRange,
  type Chronotype,
  type Intent,
  type Sex,
} from '@/lib/profile'
import { DEFAULT_ROUTINE_MINUTES, setPreferredRoutineMinutes } from '@/lib/prefs'
import { tierFromMinutes } from '@/lib/routineTier'
import { day } from '@/theme/colors'

// First-run onboarding. A short, unhurried ritual that captures the standing
// signals the personalized routine is built from. The demographics step is
// optional by design — they're weak priors, so we say so and let users skip.
//
// This screen never navigates itself: on completion it writes the profile and
// refreshes it, and the root layout's gate redirects into the tabs (mirrors how
// the sign-in screen leaves routing to the gate).

type Choice<T extends string> = { value: T; title: string; blurb: string; info?: string }

// Short blurbs on the cards; `info` opens behind the small ⓘ next to each title,
// so a first-time user can tell which intent they actually need without the
// cards getting wordy.
const INTENTS: Choice<Intent>[] = [
  {
    value: 'calm',
    title: 'Calm',
    blurb: 'Ease me into the day, gently.',
    info: 'Best if your mornings feel rushed or anxious. Your routine starts slow and settled — easing you into the day instead of scrambling through it.',
  },
  {
    value: 'energize',
    title: 'Energy',
    blurb: 'Get me up and moving.',
    info: 'Best if you wake up groggy or heavy. Your routine gets your body going early, so you shake off sleep and feel awake sooner.',
  },
  {
    value: 'focus',
    title: 'Focus',
    blurb: 'Sharpen me for what matters.',
    info: 'Best if your mornings feel scattered. Your routine clears the fog and points your attention at what matters most today.',
  },
]

const CHRONOTYPES: Choice<Chronotype>[] = [
  { value: 'early', title: 'Early riser', blurb: 'Mornings come easily.' },
  { value: 'late', title: 'Slow starter', blurb: 'Mornings are the hard part.' },
  { value: 'neither', title: 'In between', blurb: 'It depends on the day.' },
]

// Phrasings for the curation loader — the editorial beat reflects the leading
// signals back at the user (intent → chronotype) plus the time budget.
// Demographics stay silent, so a skip never leaves a blank line.
const INTENT_PHRASE: Record<Intent, string> = {
  calm: 'ease you into the day',
  energize: 'get you up and moving',
  focus: 'sharpen you for what matters',
}
const CHRONO_PHRASE: Record<Chronotype, string> = {
  early: 'an early start',
  late: 'a slower climb',
  neither: 'however you wake',
}

function curationLines(
  intent: Intent,
  chronotype: Chronotype,
  routineMinutes: number,
): string[] {
  const tier = tierFromMinutes(routineMinutes)
  const fit =
    tier === 'alarm'
      ? 'Keeping your morning to a gentle wake…'
      : tier === 'focal'
        ? 'Distilling it down to your single focal move…'
        : `Fitting it into your ${tier}-minute window…`
  return [
    `Building a morning sequence to ${INTENT_PHRASE[intent]}…`,
    `Mapping your energy curve to ${CHRONO_PHRASE[chronotype]}…`,
    fit,
  ]
}

const AGE_RANGES: { value: AgeRange; label: string }[] = [
  { value: 'under_25', label: 'Under 25' },
  { value: '25_34', label: '25–34' },
  { value: '35_44', label: '35–44' },
  { value: '45_54', label: '45–54' },
  { value: '55_plus', label: '55+' },
]

// Shown as "Gender" in the UI; stored as profiles.sex.
const SEXES: { value: Sex; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
]

// What a morning routine moves — the pillars shown in the welcome tab.
const PILLARS: {
  icon: React.ComponentProps<typeof Feather>['name']
  title: string
}[] = [
  { icon: 'zap', title: 'Energy' },
  { icon: 'target', title: 'Focus' },
  { icon: 'sun', title: 'Mood' },
]

// Steps that count toward the progress bar (intro + finish sit outside it).
// 1 intent · 2 chronotype · 3 demographics · 4 wake alarm + routine length.
const FIRST_QUESTION = 1
const LAST_QUESTION = 4
const QUESTION_COUNT = LAST_QUESTION - FIRST_QUESTION + 1

// Where the wake-time picker starts before the user adjusts it.
const DEFAULT_WAKE_TIME = '07:00'

// Seed the routine preview's "readiness" from chronotype — early risers wake more
// ready, slow starters less. A neutral day-difficulty gives a realistic first plan.
const CHRONO_READINESS: Record<Chronotype, number> = { early: 6, neither: 5, late: 4 }

export default function OnboardingScreen() {
  const { refresh } = useProfile()
  const { signUp, signOut, session } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  // "Create an account" on the sign-in screen routes here with ?start=questions
  // to skip the welcome beat and open on the first question (step 1).
  const { start } = useLocalSearchParams<{ start?: string }>()
  const [step, setStep] = useState(start === 'questions' ? FIRST_QUESTION : 0)

  // The root gate can also land here with ?start=questions while this screen is
  // ALREADY mounted on the welcome beat (signing in with an account that never
  // finished onboarding). Params don't re-run the useState initializer above, so
  // nudge off the welcome beat when the param arrives.
  useEffect(() => {
    if (start === 'questions') setStep((s) => (s === 0 ? FIRST_QUESTION : s))
  }, [start])
  const [intent, setIntent] = useState<Intent | null>(null)
  const [chronotype, setChronotype] = useState<Chronotype | null>(null)
  const [routineMinutes, setRoutineMinutes] = useState(DEFAULT_ROUTINE_MINUTES)
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null)
  const [sex, setSex] = useState<Sex | null>(null)
  // The wake-alarm opt-in, on the combined wake + routine step. On by default —
  // the voice alarm is the point of Wake; turning it off reveals only the timed
  // routine tiers.
  const [wakeEnabled, setWakeEnabled] = useState(true)
  const [wakeTime, setWakeTime] = useState(DEFAULT_WAKE_TIME)
  const [wakeVoice, setWakeVoice] = useState(DEFAULT_VOICE)

  // Name is captured at the end (step 6) and used to greet the user across the
  // app. First name is required; last name is optional.
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  // Account is created at the end of the flow (step 6), once the user is invested.
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scienceOpen, setScienceOpen] = useState(false)
  // Which intent's ⓘ explainer is open on the first question (null = none).
  const [intentInfo, setIntentInfo] = useState<Intent | null>(null)

  // Required questions gate Continue; the rest always advance.
  const canAdvance =
    step === 1 ? intent !== null : step === 2 ? chronotype !== null : true

  // Whether the final step needs to create an account (vs. just save, for a user
  // who was already signed in when they reached it). Tracked live until the account
  // step (7), then FROZEN: signUp() flips `session` mid-save, and re-deriving this
  // from the live session would flash the signed-in variant of the screen in the
  // moment between account creation and the gate navigating to the paywall.
  const needsAccountRef = useRef(!session)
  if (step < 7) needsAccountRef.current = !session
  const needsAccount = needsAccountRef.current

  // First name is required on the final step; the greeting depends on it.
  const nameReady = firstName.trim().length > 0
  const canCreateAccount =
    nameReady && isValidEmail(email) && password.length >= 6 && !saving

  // The account step (7) normally creates an account; if the user is already signed
  // in (e.g. they came in via the sign-in screen's create-account path), it just
  // saves — but a first name is still required either way.
  const buttonEnabled =
    step === 7 ? (needsAccount ? canCreateAccount : nameReady && !saving) : canAdvance && !saving

  // A real, deterministic preview of the user's first morning, seeded from their
  // answers — shown on the preview step BEFORE the account/paywall so the promised
  // routine is delivered, not withheld. generatePlan is pure/synchronous.
  const previewPlan = useMemo(() => {
    const readiness = chronotype ? CHRONO_READINESS[chronotype] : 5
    // Enough budget to show a real sequence even for the alarm-only / focal tiers.
    const minutes = routineMinutes >= 5 ? routineMinutes : 10
    return generatePlan({ readiness, dayDifficulty: 6, routineMinutes: minutes })
  }, [chronotype, routineMinutes])

  const next = () => setStep((s) => s + 1)
  const back = () => setStep((s) => Math.max(0, s - 1))

  // Final step: create the account, then persist the answers gathered so far.
  // saveOnboarding stamps onboarding_completed_at; refresh() then flips the root
  // gate, which — since the new user isn't entitled yet — routes to /paywall.
  const createAccount = async () => {
    if (!intent || !chronotype) return
    setSaving(true)
    setError(null)
    // Already signed in (came in via the sign-in screen) → skip straight to save.
    if (needsAccount) {
      const res = await signUp(email.trim(), password)
      if (res.error) {
        setError(res.error)
        setSaving(false)
        return
      }
      if (res.needsConfirmation) {
        // The single-flow signup expects email confirmation to be off; if it's on,
        // signUp returns no session. Show the user something actionable rather than
        // a developer instruction (and leave a dev note for the real cause).
        if (__DEV__) console.warn('[onboarding] signUp returned needsConfirmation — disable email confirmation in Supabase for the single-flow signup.')
        setError('Check your email to confirm your account, then sign in to finish setting up.')
        setSaving(false)
        return
      }
    }
    try {
      await saveOnboarding({
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        intent,
        chronotype,
        routineMinutes,
        ageRange,
        sex,
        wakeEnabled,
        wakeTime: wakeEnabled ? wakeTime : null,
        wakeVoice,
      })
      // Seed the device-local default so the evening routine stepper starts here.
      await setPreferredRoutineMinutes(routineMinutes)
      // Arm the wake alarm if opted in (no-op until the native tier exists; the
      // preference is already persisted above for a later dev build to pick up).
      await applyWakeAlarm({
        enabled: wakeEnabled,
        time: wakeEnabled ? wakeTime : null,
        voice: wakeVoice,
      })
      await refresh() // onboarded → the gate routes to /paywall (not yet entitled)
      // No setSaving(false): the screen unmounts as the gate navigates away.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
      setSaving(false)
    }
  }

  // The welcome beat: a full-bleed sunrise, the wordmark resting near the top,
  // and a single Begin. The question steps below run on the plain cream surface.
  if (step === 0) {
    return (
      <View style={styles.welcomeRoot}>
        <Image
          source={require('../../assets/images/welcome-bg.jpg')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        {/* Soft cream wash so the sunrise sits further back and the copy leads. */}
        <View style={[StyleSheet.absoluteFill, styles.welcomeWash]} />

        <SafeAreaView style={styles.welcomeSafe} edges={['top']}>
          <View style={styles.welcomeTop}>
            <Text style={styles.welcomeBrand}>Wake</Text>
            <View style={styles.starRow}>
              <View style={styles.starLine} />
              <Ionicons name="star" size={13} color={day.gold} style={styles.starIcon} />
              <View style={styles.starLine} />
            </View>
            <Text style={styles.welcomeTagline}>
              Your morning sets{'\n'}the next{' '}
              <Text style={styles.welcomeTaglineAccent}>16</Text> hours.
            </Text>
          </View>

          <View style={styles.welcomeMiddle}>
            <View style={styles.welcomeTab}>
              <Text style={styles.tabLead}>
                Wake adapts to your body and your day,{'\n'}building a routine every
                morning to lift:
              </Text>
              <View style={styles.tabRow}>
                {PILLARS.map((p, i) => (
                  <Fragment key={p.title}>
                    {i > 0 && <View style={styles.tabDivider} />}
                    <View style={styles.tabCell}>
                      <Feather name={p.icon} size={22} color={day.text} />
                      <Text style={styles.tabCellTitle}>{p.title}</Text>
                    </View>
                  </Fragment>
                ))}
              </View>
              <Pressable
                style={styles.tabScience}
                onPress={() => setScienceOpen(true)}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.tabScienceLine}>
                  How you wake up shapes{'\n'}your long-term health.{' '}
                  <Ionicons name="information-circle" size={15} color={day.gold} />
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.welcomeFooter, { paddingBottom: insets.bottom + 18 }]}>
            <Pressable style={styles.button} onPress={next} accessibilityRole="button">
              {/* A signed-in user here means onboarding was never finished — the
                  CTA is about completing setup, not creating an account. */}
              <Text style={styles.buttonLabel}>{session ? 'Finish setting up' : 'Sign up'}</Text>
            </Pressable>
            {/* Already signed in (e.g. a half-finished signup left a session) →
                offer a way out instead of a pointless "Sign in". Signed out → the
                returning-user path into the sign-in screen. */}
            {session ? (
              <Pressable
                style={styles.buttonSecondary}
                onPress={() => signOut()}
                accessibilityRole="button"
              >
                <Text style={styles.buttonSecondaryLabel}>Sign out</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.buttonSecondary}
                onPress={() => router.push('/sign-in')}
                accessibilityRole="button"
              >
                <Text style={styles.buttonSecondaryLabel}>Sign in</Text>
              </Pressable>
            )}
          </View>
        </SafeAreaView>

        <Modal
          visible={scienceOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setScienceOpen(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setScienceOpen(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Your actions when you wake matter</Text>
              <Text style={styles.modalBody}>
                How you wake up sets your circadian rhythm, the internal clock that
                runs your energy, focus, and mood for the rest of the day.
              </Text>
              <Text style={styles.modalBody}>
                Over time, it adds up to more than one good day. The way you wake up,
                morning after morning, shapes your long-term health. Building the right
                routines can lift your well-being for the long run.
              </Text>
              <Text style={styles.modalBody}>
                Wake builds that routine for you each morning, tuned to how you woke up
                and what your day holds, so it pays off today and over the years.
              </Text>
              <Pressable style={styles.modalClose} onPress={() => setScienceOpen(false)}>
                <Text style={styles.modalCloseLabel}>Got it</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    )
  }

  // The editorial curation beat — full-bleed, immersive, no chrome. Auto-advances
  // to account creation when the lines finish.
  if (step === 5 && intent && chronotype) {
    return (
      <CurationLoader
        lines={curationLines(intent, chronotype, routineMinutes)}
        onDone={() => setStep(6)}
      />
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      {step >= 1 && step <= LAST_QUESTION && (
        <View style={styles.header}>
          <Pressable
            onPress={back}
            hitSlop={12}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Feather name="chevron-left" size={26} color={day.muted} />
          </Pressable>
          <Progress current={step} />
          <View style={styles.headerSpacer} />
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && (
          <Question
            title="What do you want your mornings to do for you?"
            caption="Your routine leans this way. You can change it anytime."
          >
            {INTENTS.map((o) => (
              <ChoiceCard
                key={o.value}
                title={o.title}
                blurb={o.blurb}
                selected={intent === o.value}
                onPress={() => setIntent(o.value)}
                onInfoPress={() => setIntentInfo(o.value)}
              />
            ))}
          </Question>
        )}

        {step === 2 && (
          <Question title="How do your mornings usually start?">
            {CHRONOTYPES.map((o) => (
              <ChoiceCard
                key={o.value}
                title={o.title}
                blurb={o.blurb}
                selected={chronotype === o.value}
                onPress={() => setChronotype(o.value)}
              />
            ))}
          </Question>
        )}

        {step === 3 && (
          <Question
            title="A little about you."
            caption="Age and gender meaningfully shape what a good morning looks like, so they help us get your routine right. Optional, and always private to you."
          >
            <Text style={styles.groupLabel}>Age</Text>
            <View style={styles.chips}>
              {AGE_RANGES.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  selected={ageRange === o.value}
                  onPress={() =>
                    setAgeRange((cur) => (cur === o.value ? null : o.value))
                  }
                />
              ))}
            </View>

            <Text style={[styles.groupLabel, styles.groupLabelGap]}>Gender</Text>
            <View style={styles.chips}>
              {SEXES.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  selected={sex === o.value}
                  onPress={() => setSex((cur) => (cur === o.value ? null : o.value))}
                />
              ))}
            </View>
          </Question>
        )}

        {step === 4 && (
          <Question
            title="Now, how you wake."
            caption="A real alarm that greets you by voice and eases you into the day — then choose how long your morning runs. Change either anytime."
          >
            <WakeRoutineStep
              wakeEnabled={wakeEnabled}
              onWakeEnabledChange={setWakeEnabled}
              wakeTime={wakeTime}
              onWakeTimeChange={setWakeTime}
              routineMinutes={routineMinutes}
              onRoutineMinutesChange={setRoutineMinutes}
              wakeVoice={wakeVoice}
              onWakeVoiceChange={setWakeVoice}
              showVoicePicker
            />
          </Question>
        )}

        {step === 6 && (
          <View>
            <Text style={styles.questionTitle}>Here&rsquo;s your first morning.</Text>
            <Text style={styles.caption}>
              Built from your answers — your focal point, and a short sequence to
              match. It sharpens a little more every day you use it.
            </Text>

            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>Focal Point</Text>
              <Text style={styles.previewFocal}>{previewPlan.oneThing.title}</Text>
              {previewPlan.oneThing.example ? (
                <Text style={styles.previewExample}>{previewPlan.oneThing.example}</Text>
              ) : null}

              {previewPlan.sequence.length > 0 && (
                <>
                  <View style={styles.previewDivider} />
                  {previewPlan.sequence.map((s) => (
                    <View key={s.slug} style={styles.previewStep}>
                      <View style={styles.previewDot} />
                      <Text style={styles.previewStepText}>{s.title}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          </View>
        )}

        {step === 7 && (
          <View>
            <Text style={styles.questionTitle}>Save your routine.</Text>
            <Text style={styles.caption}>
              {needsAccount
                ? 'Create an account to save it and pick up tomorrow morning.'
                : 'Save it and pick up tomorrow morning.'}
            </Text>
            <View style={styles.accountForm}>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={day.muted}
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="given-name"
                textContentType="givenName"
                editable={!saving}
              />
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name (optional)"
                placeholderTextColor={day.muted}
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="family-name"
                textContentType="familyName"
                editable={!saving}
              />
              {needsAccount && (
                <>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    placeholderTextColor={day.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    autoComplete="email"
                    textContentType="emailAddress"
                    editable={!saving}
                  />
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor={day.muted}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="new-password"
                    textContentType="newPassword"
                    editable={!saving}
                  />
                </>
              )}
            </View>
          </View>
        )}
        </ScrollView>

        <View style={styles.footer}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {step === 3 && (
            <Pressable
              onPress={next}
              disabled={saving}
              style={styles.skip}
              accessibilityRole="button"
            >
              <Text style={styles.skipLabel}>Skip for now</Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.button, !buttonEnabled && styles.buttonDisabled]}
            onPress={step === 7 ? createAccount : next}
            disabled={!buttonEnabled}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator color={day.onAccent} />
            ) : (
              <Text style={styles.buttonLabel}>
                {step === 7 ? (needsAccount ? 'Create account' : 'Save my routine') : 'Continue'}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* The ⓘ explainer for an intent on the first question. Same editorial
          modal treatment as the welcome screen's science popup. */}
      <Modal
        visible={intentInfo !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setIntentInfo(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIntentInfo(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {INTENTS.find((o) => o.value === intentInfo)?.title}
            </Text>
            <Text style={styles.modalBody}>
              {INTENTS.find((o) => o.value === intentInfo)?.info}
            </Text>
            <Pressable style={styles.modalClose} onPress={() => setIntentInfo(null)}>
              <Text style={styles.modalCloseLabel}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

function Progress({ current }: { current: number }) {
  return (
    <View style={styles.progress}>
      {Array.from({ length: QUESTION_COUNT }, (_, i) => {
        const stepNumber = FIRST_QUESTION + i
        return (
          <View
            key={stepNumber}
            style={[styles.pip, current >= stepNumber && styles.pipOn]}
          />
        )
      })}
    </View>
  )
}

function Question({
  title,
  caption,
  children,
}: {
  title: string
  caption?: string
  children: React.ReactNode
}) {
  return (
    <View>
      <Text style={styles.questionTitle}>{title}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      <View style={styles.options}>{children}</View>
    </View>
  )
}

function ChoiceCard({
  title,
  blurb,
  selected,
  onPress,
  onInfoPress,
}: {
  title: string
  blurb?: string
  selected: boolean
  onPress: () => void
  /** Renders a small ⓘ next to the title that opens an explainer. */
  onInfoPress?: () => void
}) {
  return (
    <Pressable
      style={[styles.card, selected && styles.cardOn]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={styles.cardText}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, selected && styles.cardTitleOn]}>{title}</Text>
          {onInfoPress && (
            <Pressable
              onPress={onInfoPress}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`About ${title}`}
            >
              <View style={styles.cardInfoBadge}>
                <Text style={styles.cardInfoBadgeText}>i</Text>
              </View>
            </Pressable>
          )}
        </View>
        {blurb ? <Text style={styles.cardBlurb}>{blurb}</Text> : null}
      </View>
      {selected && <Feather name="check" size={20} color={day.gold} />}
    </Pressable>
  )
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipOn]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelOn]}>{label}</Text>
    </Pressable>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerSpacer: {
    width: 26,
  },
  progress: {
    flexDirection: 'row',
    gap: 6,
  },
  pip: {
    width: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: day.border,
  },
  pipOn: {
    backgroundColor: day.gold,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 16,
    justifyContent: 'flex-start',
  },
  welcomeRoot: {
    flex: 1,
    backgroundColor: day.background,
  },
  // Fades the welcome photo back without flattening it — same cream as the app
  // background. Heavier wash so the copy clearly leads and the sunrise reads as
  // a backdrop, not a photo.
  welcomeWash: {
    backgroundColor: 'rgba(250, 248, 244, 0.45)',
  },
  welcomeSafe: {
    flex: 1,
  },
  welcomeTop: {
    alignItems: 'center',
    paddingTop: 52,
  },
  welcomeBrand: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 80,
    letterSpacing: 1,
    color: day.text,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  starLine: {
    width: 44,
    height: 1.5,
    backgroundColor: day.gold,
  },
  starIcon: {
    marginHorizontal: 12,
  },
  welcomeTagline: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 20,
    lineHeight: 28,
    color: day.text,
    textAlign: 'center',
    marginTop: 11,
  },
  welcomeTaglineAccent: {
    color: day.gold,
  },
  welcomeMiddle: {
    flex: 1,
    justifyContent: 'center',
  },
  welcomeTab: {
    alignSelf: 'stretch',
    marginHorizontal: 24,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(233, 223, 204, 0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  tabLead: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: day.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabCell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabCellTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 14,
    color: day.text,
    marginTop: 6,
  },
  tabDivider: {
    width: 1,
    height: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(74, 58, 32, 0.15)',
  },
  tabScience: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    marginTop: 16,
  },
  tabScienceLine: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 13,
    lineHeight: 18,
    color: day.gold,
    textAlign: 'center',
    maxWidth: 250,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    backgroundColor: day.background,
    borderRadius: 24,
    padding: 26,
  },
  modalTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 22,
    color: day.text,
    marginBottom: 14,
  },
  modalBody: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: day.text,
    marginBottom: 14,
  },
  modalClose: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  modalCloseLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: day.gold,
  },
  welcomeFooter: {
    paddingHorizontal: 24,
  },
  questionTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 26,
    color: day.text,
    lineHeight: 34,
  },
  caption: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    color: day.muted,
    lineHeight: 22,
    marginTop: 10,
  },
  options: {
    marginTop: 24,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: day.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  cardOn: {
    borderColor: day.gold,
    borderWidth: 1.5,
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    color: day.text,
  },
  // The small ⓘ next to a choice title — a circled serif italic "i", matching
  // the editorial info marks elsewhere in the app.
  cardInfoBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfoBadgeText: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontStyle: 'italic',
    fontSize: 11,
    lineHeight: 12,
    color: day.gold,
    includeFontPadding: false,
  },
  cardTitleOn: {
    color: day.gold,
  },
  cardBlurb: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    color: day.muted,
  },
  accountForm: {
    marginTop: 28,
    gap: 14,
  },
  previewCard: {
    marginTop: 26,
    backgroundColor: day.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    borderRadius: 20,
    padding: 22,
  },
  previewLabel: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: day.gold,
    marginBottom: 8,
  },
  previewFocal: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 22,
    lineHeight: 28,
    color: day.text,
  },
  previewExample: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: day.muted,
    marginTop: 6,
  },
  previewDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: day.border,
    marginVertical: 16,
  },
  previewStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: day.gold,
  },
  previewStepText: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 16,
    color: day.text,
  },
  input: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 17,
    color: day.text,
    backgroundColor: day.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  groupLabel: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 15,
    color: day.muted,
    marginBottom: 12,
  },
  groupLabelGap: {
    marginTop: 26,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    backgroundColor: day.surface,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  chipOn: {
    borderColor: day.gold,
    borderWidth: 1.5,
  },
  chipLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    color: day.text,
  },
  chipLabelOn: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    color: day.gold,
  },
  footer: {
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 8,
  },
  error: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    color: day.negative,
    textAlign: 'center',
  },
  skip: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    color: day.muted,
    textDecorationLine: 'underline',
  },
  button: {
    backgroundColor: day.gold,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: day.onAccent,
  },
  buttonSecondary: {
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    marginTop: 12,
  },
  buttonSecondaryLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: day.onAccent,
  },
})
