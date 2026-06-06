import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { DurationStepper } from '@/components/reflect/DurationStepper'
import { errorMessage } from '@/lib/errors'
import {
  DEFAULT_ROUTINE_MINUTES,
  getPreferredRoutineMinutes,
  setPreferredRoutineMinutes,
} from '@/lib/prefs'
import {
  updateProfile,
  useProfile,
  type Chronotype,
  type Intent,
} from '@/lib/profile'
import { day } from '@/theme/colors'

// The "Morning signals" settings screen, opened from the You page. Lets a user
// revise the standing inputs the personalization layer reads — intent, how their
// mornings tend to start (chronotype), and their default routine length. Mirrors
// the onboarding copy so the two read as one voice. Saving writes the profile
// and the device-local routine default, refreshes the profile, and pops back.

const INTENTS: { value: Intent; title: string; blurb: string }[] = [
  { value: 'calm', title: 'Calm', blurb: 'Ease me into the day, gently.' },
  { value: 'energize', title: 'Energy', blurb: 'Get me up and moving.' },
  { value: 'focus', title: 'Focus', blurb: 'Sharpen me for what matters.' },
]

const CHRONOTYPES: { value: Chronotype; title: string; blurb: string }[] = [
  { value: 'early', title: 'Early riser', blurb: 'Mornings come easily.' },
  { value: 'late', title: 'Slow starter', blurb: 'Mornings are the hard part.' },
  { value: 'neither', title: 'In between', blurb: 'It depends on the day.' },
]

export default function MorningSignalsScreen() {
  const router = useRouter()
  const { profile, refresh } = useProfile()

  const [intent, setIntent] = useState<Intent | null>(profile?.intent ?? null)
  const [chronotype, setChronotype] = useState<Chronotype | null>(profile?.chronotype ?? null)
  const [routineMinutes, setRoutineMinutes] = useState(
    profile?.routine_minutes ?? DEFAULT_ROUTINE_MINUTES,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Seed the routine length from the device-local preference (the source the
  // evening stepper uses), so this screen agrees with the rest of the app.
  useEffect(() => {
    let active = true
    getPreferredRoutineMinutes().then((m) => {
      if (active) setRoutineMinutes(m)
    })
    return () => {
      active = false
    }
  }, [])

  const close = () => router.back()

  const canSave = intent !== null && chronotype !== null && !saving

  const save = async () => {
    if (!intent || !chronotype) return
    setSaving(true)
    setError(null)
    try {
      await updateProfile({ intent, chronotype, routineMinutes })
      await setPreferredRoutineMinutes(routineMinutes)
      await refresh()
      close()
    } catch (e) {
      setError(errorMessage(e, 'Could not save. Please try again.'))
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Feather name="x" size={24} color={day.muted} />
        </Pressable>
        <Text style={styles.headerTitle}>Morning signals</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          These shape the routine Wake builds for you. Change them whenever your mornings change.
        </Text>

        <Text style={styles.groupLabel}>What you want mornings to do</Text>
        <View style={styles.options}>
          {INTENTS.map((o) => (
            <ChoiceCard
              key={o.value}
              title={o.title}
              blurb={o.blurb}
              selected={intent === o.value}
              onPress={() => setIntent(o.value)}
            />
          ))}
        </View>

        <Text style={[styles.groupLabel, styles.groupLabelGap]}>How your mornings start</Text>
        <View style={styles.options}>
          {CHRONOTYPES.map((o) => (
            <ChoiceCard
              key={o.value}
              title={o.title}
              blurb={o.blurb}
              selected={chronotype === o.value}
              onPress={() => setChronotype(o.value)}
            />
          ))}
        </View>

        <Text style={[styles.groupLabel, styles.groupLabelGap]}>Default routine length</Text>
        <Text style={styles.groupCaption}>
          Your usual length — you can still nudge it any evening for the next morning.
        </Text>
        <View style={styles.stepperWrap}>
          <DurationStepper value={routineMinutes} onChange={setRoutineMinutes} min={5} max={60} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.button, !canSave && styles.buttonDisabled]}
          onPress={save}
          disabled={!canSave}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color={day.onAccent} />
          ) : (
            <Text style={styles.buttonLabel}>Save changes</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

function ChoiceCard({
  title,
  blurb,
  selected,
  onPress,
}: {
  title: string
  blurb: string
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
        <Text style={styles.cardBlurb}>{blurb}</Text>
      </View>
      {selected && <Feather name="check" size={20} color={day.gold} />}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: day.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    color: day.text,
  },
  headerSpacer: {
    width: 24, // balances the X so the title stays centered
  },
  scroll: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 24,
  },
  intro: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: day.muted,
    marginBottom: 28,
  },
  groupLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    color: day.text,
    marginBottom: 14,
  },
  groupLabelGap: {
    marginTop: 32,
  },
  groupCaption: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: day.muted,
    marginTop: -6,
    marginBottom: 16,
  },
  options: {
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
    paddingVertical: 16,
  },
  cardOn: {
    borderColor: day.gold,
    borderWidth: 1.5,
  },
  cardText: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
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
  footer: {
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  error: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    color: day.negative,
    textAlign: 'center',
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
})
