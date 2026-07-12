import { Feather } from '@expo/vector-icons'
import { useEffect } from 'react'
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'

import { VoicePicker } from '@/components/VoicePicker'
import { WakeTimePicker } from '@/components/WakeTimePicker'
import { isAlarmAvailable } from '@/lib/alarm'
import { hapticSelect } from '@/lib/haptics'
import {
  minutesForTier,
  tierFromMinutes,
  TIER_OPTIONS,
} from '@/lib/routineTier'
import { day } from '@/theme/colors'

// The combined "voice alarm + morning length" control, shared by onboarding and
// the evening reflection so the two surfaces stay identical.
//
//   • A voice-alarm toggle. On → a time picker (and, in onboarding, a voice
//     picker) appears.
//   • Below it, always, the routine-length chooser. When the alarm is OFF the two
//     alarm-dependent tiers (alarm-only, alarm + one action) disappear, since they
//     make no sense without an alarm — and a currently-selected one snaps to the
//     shortest real routine.

type Props = {
  wakeEnabled: boolean
  onWakeEnabledChange: (enabled: boolean) => void
  wakeTime: string
  onWakeTimeChange: (time: string) => void
  /** Encoded routine-tier value (see src/lib/routineTier.ts). */
  routineMinutes: number
  onRoutineMinutesChange: (minutes: number) => void
  /** Onboarding shows the voice picker; the evening reflection doesn't. */
  wakeVoice?: string
  onWakeVoiceChange?: (voice: string) => void
  showVoicePicker?: boolean
}

// The tier a selection should fall back to when the alarm turns off and the
// current pick was alarm-dependent — the shortest real routine.
const FALLBACK_MINUTES = minutesForTier(5)

export function WakeRoutineStep({
  wakeEnabled,
  onWakeEnabledChange,
  wakeTime,
  onWakeTimeChange,
  routineMinutes,
  onRoutineMinutesChange,
  wakeVoice,
  onWakeVoiceChange,
  showVoicePicker = false,
}: Props) {
  const selectedTier = tierFromMinutes(routineMinutes)

  const handleToggle = (next: boolean) => {
    onWakeEnabledChange(next)
    // Turning the alarm off removes the alarm-dependent tiers; if one was picked,
    // snap to the shortest real routine so the selection stays valid.
    if (!next && (selectedTier === 'alarm' || selectedTier === 'focal')) {
      onRoutineMinutesChange(FALLBACK_MINUTES)
    }
  }

  return (
    <View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Wake me with a voice alarm</Text>
        <Switch
          value={wakeEnabled}
          onValueChange={handleToggle}
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

      <Text style={styles.chooserHeading}>How long should your morning run?</Text>
      <RoutineTierChooser
        routineMinutes={routineMinutes}
        onRoutineMinutesChange={onRoutineMinutesChange}
        alarmEnabled={wakeEnabled}
      />
    </View>
  )
}

// The routine-length option list on its own — the tier picker shared by the
// combined step above and the Morning-signals settings screen. The two
// alarm-dependent tiers (alarm-only, alarm + one action) only appear when an
// alarm is on, since they're meaningless without one.
export function RoutineTierChooser({
  routineMinutes,
  onRoutineMinutesChange,
  alarmEnabled,
}: {
  routineMinutes: number
  onRoutineMinutesChange: (minutes: number) => void
  alarmEnabled: boolean
}) {
  const selectedTier = tierFromMinutes(routineMinutes)
  const options = TIER_OPTIONS.filter((o) => alarmEnabled || !o.requiresAlarm)
  // Guard the seeded/stored state, not just interactive toggles: if the alarm is
  // off but the current tier is alarm-dependent (a stored alarm-only/focal pref, or
  // a value seeded from last night), no option renders as selected and it could be
  // saved as routine_minutes 0/1 — a dead-end morning with neither wake nor
  // routine. Snap to the shortest real routine so the selection is always valid.
  useEffect(() => {
    if (!alarmEnabled && (selectedTier === 'alarm' || selectedTier === 'focal')) {
      onRoutineMinutesChange(FALLBACK_MINUTES)
    }
  }, [alarmEnabled, selectedTier, onRoutineMinutesChange])
  return (
    <View style={styles.options}>
      {options.map((o) => {
        const selected = selectedTier === o.tier
        return (
          <Pressable
            key={String(o.tier)}
            style={[styles.option, selected && styles.optionOn]}
            onPress={() => {
              hapticSelect()
              onRoutineMinutesChange(minutesForTier(o.tier))
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <View style={styles.optionText}>
              <Text style={[styles.optionLabel, selected && styles.optionLabelOn]}>
                {o.label}
              </Text>
              <Text style={styles.optionSub}>{o.sub}</Text>
            </View>
            {selected ? <Feather name="check" size={20} color={day.gold} /> : null}
          </Pressable>
        )
      })}
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
  chooserHeading: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: day.muted,
    marginTop: 28,
    marginBottom: 14,
  },
  options: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    backgroundColor: day.surface,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  optionOn: {
    borderColor: day.gold,
    borderWidth: 1.5,
  },
  optionText: {
    flex: 1,
    marginRight: 12,
  },
  optionLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
    color: day.text,
  },
  optionLabelOn: {
    color: day.gold,
  },
  optionSub: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 13,
    color: day.muted,
    marginTop: 3,
  },
})
