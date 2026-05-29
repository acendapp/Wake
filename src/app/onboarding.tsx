import { Feather, Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { Fragment, useState } from 'react'
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
import { DurationStepper } from '@/components/reflect/DurationStepper'
import { useAuth } from '@/lib/auth'
import {
  saveOnboarding,
  useProfile,
  type AgeRange,
  type Chronotype,
  type FrictionPoint,
  type Intent,
  type Sex,
} from '@/lib/profile'
import { DEFAULT_ROUTINE_MINUTES, setPreferredRoutineMinutes } from '@/lib/prefs'
import { day } from '@/theme/colors'

// First-run onboarding. A short, unhurried ritual that captures the standing
// signals the personalized routine is built from. The demographics step is
// optional by design — they're weak priors, so we say so and let users skip.
//
// This screen never navigates itself: on completion it writes the profile and
// refreshes it, and the root layout's gate redirects into the tabs (mirrors how
// the sign-in screen leaves routing to the gate).

type Choice<T extends string> = { value: T; title: string; blurb: string }

const INTENTS: Choice<Intent>[] = [
  { value: 'calm', title: 'Calm', blurb: 'Ease me into the day, gently.' },
  { value: 'energize', title: 'Energy', blurb: 'Get me up and moving.' },
  { value: 'focus', title: 'Focus', blurb: 'Sharpen me for what matters.' },
]

const CHRONOTYPES: Choice<Chronotype>[] = [
  { value: 'early', title: 'Early riser', blurb: 'Mornings come easily.' },
  { value: 'late', title: 'Slow starter', blurb: 'Mornings are the hard part.' },
  { value: 'neither', title: 'In between', blurb: 'It depends on the day.' },
]

// Where the morning tends to break down — answers stand on their own, no blurb.
const FRICTION: { value: FrictionPoint; title: string }[] = [
  { value: 'before_up', title: 'Before I’m even out of bed' },
  { value: 'getting_ready', title: 'Once I’m up but before I’m out the door' },
  { value: 'out_world', title: 'Out in the world' },
  { value: 'all_morning', title: 'Honestly, all the way through' },
]

// Phrasings for the curation loader — the editorial beat reflects the three
// leading signals back at the user (intent → chronotype → friction) plus the
// time budget. Demographics stay silent, so a skip never leaves a blank line.
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
const FRICTION_PHRASE: Record<FrictionPoint, string> = {
  before_up: 'the struggle to get out of bed',
  getting_ready: 'the rush before you’re out the door',
  out_world: 'the chaos once you’re out',
  all_morning: 'a morning that fights you throughout',
}

function curationLines(
  intent: Intent,
  chronotype: Chronotype,
  friction: FrictionPoint,
  routineMinutes: number,
): string[] {
  return [
    `Building a morning sequence to ${INTENT_PHRASE[intent]}…`,
    `Mapping your energy curve to ${CHRONO_PHRASE[chronotype]}…`,
    `Designing a buffer against ${FRICTION_PHRASE[friction]}…`,
    `Fitting it into your ${routineMinutes}-minute window…`,
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
const FIRST_QUESTION = 1
const LAST_QUESTION = 5
const QUESTION_COUNT = LAST_QUESTION - FIRST_QUESTION + 1

export default function OnboardingScreen() {
  const { refresh } = useProfile()
  const { signUp, session } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [step, setStep] = useState(0)
  const [intent, setIntent] = useState<Intent | null>(null)
  const [chronotype, setChronotype] = useState<Chronotype | null>(null)
  const [friction, setFriction] = useState<FrictionPoint | null>(null)
  const [routineMinutes, setRoutineMinutes] = useState(DEFAULT_ROUTINE_MINUTES)
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null)
  const [sex, setSex] = useState<Sex | null>(null)

  // Account is created at the end of the flow (step 7), once the user is invested.
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scienceOpen, setScienceOpen] = useState(false)

  // Required questions gate Continue; the rest always advance.
  const canAdvance =
    step === 1 ? intent !== null : step === 2 ? chronotype !== null : step === 3 ? friction !== null : true

  const canCreateAccount = email.trim().length > 3 && password.length >= 6 && !saving

  // Step 7 normally creates an account; if the user is already signed in (e.g.
  // they came in via the sign-in screen's create-account path), it just saves.
  const buttonEnabled =
    step === 7 ? (session ? !saving : canCreateAccount) : canAdvance && !saving

  const next = () => setStep((s) => s + 1)
  const back = () => setStep((s) => Math.max(0, s - 1))

  // Final step: create the account, then persist the answers gathered so far.
  // saveOnboarding stamps onboarding_completed_at; refresh() then flips the root
  // gate, which — since the new user isn't entitled yet — routes to /paywall.
  const createAccount = async () => {
    if (!intent || !chronotype || !friction) return
    setSaving(true)
    setError(null)
    // Already signed in (came in via the sign-in screen) → skip straight to save.
    if (!session) {
      const res = await signUp(email.trim(), password)
      if (res.error) {
        setError(res.error)
        setSaving(false)
        return
      }
      if (res.needsConfirmation) {
        // Email confirmation must be OFF in Supabase for this single-flow signup.
        setError('Please disable email confirmation in Supabase to continue.')
        setSaving(false)
        return
      }
    }
    try {
      await saveOnboarding({
        intent,
        chronotype,
        frictionPoint: friction,
        routineMinutes,
        ageRange,
        sex,
      })
      // Seed the device-local default so the evening routine stepper starts here.
      await setPreferredRoutineMinutes(routineMinutes)
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
          source={require('../../assets/images/welcome-bg.png')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />

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
                  <Feather name="info" size={13} color={day.gold} />
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.welcomeFooter, { paddingBottom: insets.bottom + 18 }]}>
            <Pressable style={styles.button} onPress={next} accessibilityRole="button">
              <Text style={styles.buttonLabel}>Build my routine</Text>
            </Pressable>
            <Pressable
              style={styles.buttonSecondary}
              onPress={() => router.push('/sign-in')}
              accessibilityRole="button"
            >
              <Text style={styles.buttonSecondaryLabel}>Sign in</Text>
            </Pressable>
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
  if (step === 6 && intent && chronotype && friction) {
    return (
      <CurationLoader
        lines={curationLines(intent, chronotype, friction, routineMinutes)}
        onDone={() => setStep(7)}
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
          <Question title="Where do your mornings usually go wrong?">
            {FRICTION.map((o) => (
              <ChoiceCard
                key={o.value}
                title={o.title}
                selected={friction === o.value}
                onPress={() => setFriction(o.value)}
              />
            ))}
          </Question>
        )}

        {step === 4 && (
          <Question
            title="How long can your morning routine run?"
            caption="A starting point — you’ll confirm it each evening."
          >
            <View style={styles.stepperWrap}>
              <DurationStepper
                value={routineMinutes}
                onChange={setRoutineMinutes}
                min={5}
                max={60}
              />
            </View>
          </Question>
        )}

        {step === 5 && (
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

        {step === 7 && (
          <View>
            <Text style={styles.questionTitle}>Your routine is ready.</Text>
            <Text style={styles.caption}>
              {session
                ? 'Save it and pick up tomorrow morning.'
                : 'Create an account to save it and pick up tomorrow morning.'}
            </Text>
            {!session && (
              <View style={styles.accountForm}>
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
              </View>
            )}
          </View>
        )}
        </ScrollView>

        <View style={styles.footer}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {step === 5 && (
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
                {step === 7 ? (session ? 'Save my routine' : 'Create account') : 'Continue'}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
}: {
  title: string
  blurb?: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      style={[styles.card, selected && styles.cardOn]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, selected && styles.cardTitleOn]}>{title}</Text>
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
    fontFamily: 'PlayfairDisplay_500Medium',
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
  cardTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    color: day.text,
  },
  cardTitleOn: {
    color: day.gold,
  },
  cardBlurb: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    color: day.muted,
  },
  stepperWrap: {
    backgroundColor: day.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 22,
  },
  accountForm: {
    marginTop: 28,
    gap: 14,
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
