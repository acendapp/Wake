import { Feather } from '@expo/vector-icons'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
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
import { requestNotificationPermission, syncReminders } from '@/lib/notifications'
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
  // iOS refused AlarmKit permission on save. The preference IS saved, but nothing
  // will ring, so instead of popping back we hold here and point at Settings.
  const [alarmDenied, setAlarmDenied] = useState(false)

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
    setAlarmDenied(false)
    try {
      const wakeTime = enabled ? time : null
      await updateProfile({ wakeEnabled: enabled, wakeTime, wakeVoice: voice })
      const armed = await applyWakeAlarm({ enabled, time: wakeTime, voice })
      // Prompt for notification permission (when enabling) + re-arm the reminders.
      if (enabled) await requestNotificationPermission()
      await syncReminders({ wakeEnabled: enabled, wakeTime, firstName: profile?.first_name })
      await refresh()
      if (armed === 'denied') {
        // Saved, but silently useless — surface it rather than closing as if it worked.
        setAlarmDenied(true)
        setSaving(false)
        return
      }
      close()
    } catch (e) {
      setError(errorMessage(e, 'Could not save. Please try again.'))
      setSaving(false)
    }
  }

  // After the user goes to Settings to allow alarms, the app returns to this
  // screen. Re-arm on foreground; once it takes, clear the warning and pop back
  // so the fix feels like it just worked — no second tap on Save required.
  useEffect(() => {
    if (!alarmDenied) return
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      void applyWakeAlarm({ enabled, time: enabled ? time : null, voice })
        .then((result) => {
          if (result === 'armed') {
            setAlarmDenied(false)
            close()
          }
        })
        .catch(() => {})
    })
    return () => sub.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alarmDenied, enabled, time, voice])

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
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {alarmDenied ? (
          <View style={styles.deniedCard}>
            <Text style={styles.deniedTitle}>iOS is blocking the alarm</Text>
            <Text style={styles.deniedBody}>
              Your wake time is saved, but nothing will ring until you allow alarms for Wake
              in Settings. It takes one tap — we&rsquo;ll bring you right back.
            </Text>
            <Pressable
              style={styles.deniedButton}
              onPress={() => {
                void Linking.openSettings().catch(() => {})
              }}
              accessibilityRole="button"
            >
              <Text style={styles.deniedButtonLabel}>Open Settings</Text>
            </Pressable>
          </View>
        ) : null}
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
  deniedCard: {
    backgroundColor: day.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.negative,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 4,
  },
  deniedTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 15,
    color: day.negative,
  },
  deniedBody: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 13.5,
    lineHeight: 19,
    color: day.muted,
    marginTop: 6,
  },
  deniedButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.gold,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  deniedButtonLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 14,
    color: day.gold,
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
