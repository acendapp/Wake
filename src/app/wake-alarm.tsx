import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { VoicePicker } from '@/components/VoicePicker'
import { WakeTimePicker } from '@/components/WakeTimePicker'
import { applyWakeAlarm, DEFAULT_VOICE, isAlarmAvailable } from '@/lib/alarm'
import { errorMessage } from '@/lib/errors'
import { updateProfile, useProfile } from '@/lib/profile'
import { day } from '@/theme/colors'

// The "Wake alarm" settings screen, opened from the You page. Lets a user turn
// the voice alarm on/off and set the time it wakes them. Mirrors the onboarding
// step's copy so the two read as one voice. Saving writes the profile, (re)arms
// or cancels the alarm, refreshes the profile, and pops back.

const DEFAULT_WAKE_TIME = '07:00'

export default function WakeAlarmScreen() {
  const router = useRouter()
  const { profile, refresh } = useProfile()

  const [enabled, setEnabled] = useState(profile?.wake_enabled ?? false)
  const [time, setTime] = useState(profile?.wake_time ?? DEFAULT_WAKE_TIME)
  const [voice, setVoice] = useState(profile?.wake_voice ?? DEFAULT_VOICE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill once the profile arrives — the useState seeds capture only the first
  // render, so if the provider is still mid-fetch the toggle/time would otherwise
  // be stale. Only fills while the user hasn't touched them.
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (!profile || touched) return
    setEnabled(profile.wake_enabled ?? false)
    setTime(profile.wake_time ?? DEFAULT_WAKE_TIME)
    setVoice(profile.wake_voice ?? DEFAULT_VOICE)
  }, [profile, touched])

  const close = () => router.back()

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const wakeTime = enabled ? time : null
      await updateProfile({ wakeEnabled: enabled, wakeTime, wakeVoice: voice })
      await applyWakeAlarm({ enabled, time: wakeTime, voice })
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
        <Text style={styles.headerTitle}>Wake alarm</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          A gentle voice alarm eases you out of bed and into your morning. Set the time
          that works for you.
        </Text>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Wake me with a voice alarm</Text>
          <Switch
            value={enabled}
            onValueChange={(v) => {
              setTouched(true)
              setEnabled(v)
            }}
            trackColor={{ true: day.gold, false: day.border }}
            thumbColor={day.surface}
            ios_backgroundColor={day.border}
          />
        </View>

        {enabled && (
          <>
            <View style={styles.pickerWrap}>
              <WakeTimePicker
                value={time}
                onChange={(t) => {
                  setTouched(true)
                  setTime(t)
                }}
              />
              {!isAlarmAvailable() && (
                <Text style={styles.note}>
                  We&rsquo;ll save your wake time — the voice alarm activates in the full
                  Wake app.
                </Text>
              )}
            </View>

            <Text style={styles.sectionLabel}>Choose a voice</Text>
            <Text style={styles.sectionCaption}>
              The voice that greets you each morning. It rotates through a few recordings
              so it never feels canned.
            </Text>

            <VoicePicker
              value={voice}
              onChange={(id) => {
                setTouched(true)
                setVoice(id)
              }}
            />

            <Pressable
              style={styles.previewWake}
              onPress={() => router.push('/wake')}
              accessibilityRole="button"
            >
              <Feather name="sunrise" size={15} color={day.gold} />
              <Text style={styles.previewWakeLabel}>Preview the wake-up</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={save}
          disabled={saving}
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
    width: 24,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: day.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  toggleLabel: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 16,
    color: day.text,
    flex: 1,
    marginRight: 12,
  },
  pickerWrap: {
    marginTop: 18,
    backgroundColor: day.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 26,
    alignItems: 'center',
  },
  note: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 13,
    color: day.muted,
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 19,
  },
  sectionLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    color: day.text,
    marginTop: 32,
  },
  sectionCaption: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: day.muted,
    marginTop: 6,
    marginBottom: 18,
  },
  previewWake: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 26,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    backgroundColor: day.surface,
  },
  previewWakeLabel: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 15,
    color: day.gold,
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
