import { Feather } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { shiftClock, to12h } from '@/lib/time'
import { day } from '@/theme/colors'

// A minus/plus stepper for the wake time, in 15-minute increments. A native
// time picker would mean a native module (no Expo Go); a stepper keeps the
// ritual self-contained and on the warm cream surface.
type Props = {
  value: string // "HH:MM" 24h
  onChange: (hhmm: string) => void
  stepMinutes?: number
}

export function TimeStepper({ value, onChange, stepMinutes = 15 }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        style={styles.button}
        hitSlop={10}
        onPress={() => onChange(shiftClock(value, -stepMinutes))}
        accessibilityRole="button"
        accessibilityLabel="Earlier"
      >
        <Feather name="minus" size={22} color={day.text} />
      </Pressable>

      <Text style={styles.time}>{to12h(value)}</Text>

      <Pressable
        style={styles.button}
        hitSlop={10}
        onPress={() => onChange(shiftClock(value, stepMinutes))}
        accessibilityRole="button"
        accessibilityLabel="Later"
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
  time: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 30,
    color: day.text,
  },
})
