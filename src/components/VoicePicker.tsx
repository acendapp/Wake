import { Feather } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { VOICES, type Voice } from '@/lib/alarmCore'
import { day } from '@/theme/colors'

// The wake-alarm voice picker — a simple list of voices by name. Used by the
// Settings screen and onboarding.
//
// NOTE: tap-to-preview is intentionally out for now. When we wire expo-audio to
// the bundled clips, re-add a play/pause preview button per card.

type Props = {
  value: string
  onChange: (voiceId: string) => void
}

export function VoicePicker({ value, onChange }: Props) {
  return (
    <View style={styles.list}>
      {VOICES.map((v) => (
        <VoiceCard
          key={v.id}
          voice={v}
          selected={value === v.id}
          onPress={() => onChange(v.id)}
        />
      ))}
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
      accessibilityLabel={voice.name}
    >
      <Text style={[styles.name, selected && styles.nameOn]}>{voice.name}</Text>
      {selected && <Feather name="check" size={20} color={day.gold} />}
    </Pressable>
  )
}

const styles = StyleSheet.create({
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
  name: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
    color: day.text,
  },
  nameOn: {
    color: day.gold,
  },
})
