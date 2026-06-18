import { Feather } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { VOICES, type Voice } from '@/lib/alarmCore'
import { day } from '@/theme/colors'

// The wake-alarm voice picker — grouped Women/Men cards. Used by the Settings
// screen and onboarding.
//
// NOTE: tap-to-preview is intentionally out for now — the real voice clips aren't
// recorded yet (placeholders removed). When they land in assets/audio/, re-add a
// play/pause preview button per card (expo-audio + a per-voice clip map).

type Props = {
  value: string
  onChange: (voiceId: string) => void
}

export function VoicePicker({ value, onChange }: Props) {
  const group = (gender: Voice['gender']) =>
    VOICES.filter((v) => v.gender === gender).map((v) => (
      <VoiceCard
        key={v.id}
        voice={v}
        selected={value === v.id}
        onPress={() => onChange(v.id)}
      />
    ))

  return (
    <View>
      <Text style={styles.groupLabel}>Women</Text>
      <View style={styles.list}>{group('female')}</View>
      <Text style={[styles.groupLabel, styles.groupLabelGap]}>Men</Text>
      <View style={styles.list}>{group('male')}</View>
    </View>
  )
}

function VoiceCard({
  voice,
  selected,
  onPress,
}: {
  voice: Voice
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      style={[styles.card, selected && styles.cardOn]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${voice.name}. ${voice.tagline}`}
    >
      <View style={styles.text}>
        <Text style={[styles.name, selected && styles.nameOn]}>{voice.name}</Text>
        <Text style={styles.tagline}>{voice.tagline}</Text>
      </View>
      {selected && <Feather name="check" size={20} color={day.gold} />}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  groupLabel: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: day.muted,
    marginBottom: 12,
  },
  groupLabelGap: {
    marginTop: 24,
  },
  list: {
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
  text: {
    flex: 1,
    gap: 3,
    marginRight: 12,
  },
  name: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
    color: day.text,
  },
  nameOn: {
    color: day.gold,
  },
  tagline: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    lineHeight: 19,
    color: day.muted,
  },
})
