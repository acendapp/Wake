import { StyleSheet, Switch, Text, View } from 'react-native'

import { VoicePicker } from '@/components/VoicePicker'
import { WakeTimePicker } from '@/components/WakeTimePicker'
import { isAlarmAvailable } from '@/lib/alarm'
import { day } from '@/theme/colors'

// The voice-alarm control, shared by onboarding and the evening reflection so the
// two surfaces stay identical. A single toggle; when it's on, a time picker (and,
// in onboarding, a voice picker) appear.
//
// There is no routine-length choice any more — every morning is the focal point
// plus an optional sequence, and the user self-paces by doing or skipping. The
// only standing morning setup is this alarm on/off.

type Props = {
  wakeEnabled: boolean
  onWakeEnabledChange: (enabled: boolean) => void
  wakeTime: string
  onWakeTimeChange: (time: string) => void
  /** Onboarding shows the voice picker; the evening reflection doesn't. */
  wakeVoice?: string
  onWakeVoiceChange?: (voice: string) => void
  showVoicePicker?: boolean
}

export function WakeRoutineStep({
  wakeEnabled,
  onWakeEnabledChange,
  wakeTime,
  onWakeTimeChange,
  wakeVoice,
  onWakeVoiceChange,
  showVoicePicker = false,
}: Props) {
  return (
    <View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Wake me with a voice alarm</Text>
        <Switch
          value={wakeEnabled}
          onValueChange={onWakeEnabledChange}
          accessibilityLabel="Wake me with a voice alarm"
          trackColor={{ true: day.gold, false: day.border }}
          thumbColor={day.surface}
          ios_backgroundColor={day.border}
        />
      </View>

      {wakeEnabled ? (
        <View style={styles.wakePickerWrap}>
          <WakeTimePicker value={wakeTime} onChange={onWakeTimeChange} />
          {!isAlarmAvailable() ? (
            <Text style={styles.wakeNote}>
              We&rsquo;ll save your wake time now — the voice alarm activates in the full
              Wake app.
            </Text>
          ) : null}
        </View>
      ) : null}

      {wakeEnabled && showVoicePicker && onWakeVoiceChange ? (
        <>
          <Text style={styles.voiceHeading}>Pick your voice</Text>
          <VoicePicker value={wakeVoice ?? ''} onChange={onWakeVoiceChange} />
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
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
  wakePickerWrap: {
    marginTop: 16,
    backgroundColor: day.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
  },
  wakeNote: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 13,
    color: day.muted,
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 19,
  },
  voiceHeading: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    color: day.text,
    marginTop: 26,
    marginBottom: 14,
  },
})
