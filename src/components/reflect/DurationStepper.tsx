import { Feather } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { day } from '@/theme/colors'

// A minus/plus stepper for a duration in minutes — how long the user wants their
// morning routine to run. A native picker would mean a native module (no Expo
// Go); a stepper keeps the ritual self-contained on the warm cream surface.
type Props = {
  value: number // minutes
  onChange: (minutes: number) => void
  stepMinutes?: number
  min?: number
  max?: number
}

export function DurationStepper({
  value,
  onChange,
  stepMinutes = 5,
  min = 5,
  max = 180,
}: Props) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n))
  return (
    <View style={styles.row}>
      <Pressable
        style={styles.button}
        hitSlop={10}
        onPress={() => onChange(clamp(value - stepMinutes))}
        accessibilityRole="button"
        accessibilityLabel="Shorter"
      >
        <Feather name="minus" size={22} color={day.text} />
      </Pressable>

      <Text style={styles.value}>{value} min</Text>

      <Pressable
        style={styles.button}
        hitSlop={10}
        onPress={() => onChange(clamp(value + stepMinutes))}
        accessibilityRole="button"
        accessibilityLabel="Longer"
      >
        <Feather name="plus" size={22} color={day.text} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    backgroundColor: day.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 30,
    color: day.text,
  },
})
