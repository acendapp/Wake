import { Feather } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { day } from '@/theme/colors'

// A wake-time picker built from chevron steppers — hour, minute (5-min steps),
// and an AM/PM toggle. A native time picker would mean a native module (no Expo
// Go); this keeps it self-contained and on the warm cream surface, matching
// DurationStepper. Emits "HH:MM" 24-hour (the shape stored on profiles.wake_time).

type Props = {
  value: string // "HH:MM" 24h
  onChange: (hhmm: string) => void
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Parse "HH:MM" → 24h parts, falling back to 07:00 for anything malformed. */
function parse(value: string): { h: number; m: number } {
  const match = /^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(value)
  if (!match) return { h: 7, m: 0 }
  return { h: Number(match[1]), m: Number(match[2]) }
}

export function WakeTimePicker({ value, onChange }: Props) {
  const { h, m } = parse(value)
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12

  const emit = (h24: number, min: number) => onChange(`${pad(h24)}:${pad(min)}`)

  const setHour12 = (next12: number) => {
    const wrapped = ((next12 - 1 + 12) % 12) + 1 // 1..12 wrap
    const h24 = period === 'PM' ? (wrapped % 12) + 12 : wrapped % 12
    emit(h24, m)
  }
  const setMinute = (next: number) => emit(h, ((next % 60) + 60) % 60)
  const setPeriod = (next: 'AM' | 'PM') => {
    const base = hour12 % 12 // 0..11
    emit(next === 'PM' ? base + 12 : base, m)
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.clock}>
        <Stepper
          label="Hour"
          display={String(hour12)}
          valueText={`${hour12} ${period}`}
          onUp={() => setHour12(hour12 + 1)}
          onDown={() => setHour12(hour12 - 1)}
        />
        <Text style={styles.colon}>:</Text>
        <Stepper
          label="Minute"
          display={pad(m)}
          valueText={`${m} minutes`}
          onUp={() => setMinute(m + 5)}
          onDown={() => setMinute(m - 5)}
        />
      </View>

      <View style={styles.period}>
        {(['AM', 'PM'] as const).map((p) => (
          <Pressable
            key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnOn]}
            onPress={() => setPeriod(p)}
            accessibilityRole="button"
            accessibilityState={{ selected: period === p }}
            accessibilityLabel={p}
          >
            <Text style={[styles.periodLabel, period === p && styles.periodLabelOn]}>{p}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

function Stepper({
  label,
  display,
  valueText,
  onUp,
  onDown,
}: {
  label: string
  display: string
  valueText: string
  onUp: () => void
  onDown: () => void
}) {
  return (
    <View
      style={styles.stepper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') onUp()
        else if (e.nativeEvent.actionName === 'decrement') onDown()
      }}
    >
      <Pressable
        style={styles.chev}
        hitSlop={10}
        onPress={onUp}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Feather name="chevron-up" size={24} color={day.muted} />
      </Pressable>
      <Text style={styles.num}>{display}</Text>
      <Pressable
        style={styles.chev}
        hitSlop={10}
        onPress={onDown}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Feather name="chevron-down" size={24} color={day.muted} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 18 },
  clock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stepper: { alignItems: 'center', gap: 4, width: 84 },
  chev: { padding: 4 },
  num: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 52,
    color: day.text,
    lineHeight: 58,
  },
  colon: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 44,
    color: day.muted,
    marginHorizontal: 4,
  },
  period: { flexDirection: 'row', gap: 8 },
  periodBtn: {
    paddingVertical: 8,
    paddingHorizontal: 22,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    backgroundColor: day.surface,
  },
  periodBtnOn: { backgroundColor: day.gold, borderColor: day.gold },
  periodLabel: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 15,
    letterSpacing: 1,
    color: day.muted,
  },
  periodLabelOn: { color: day.onAccent },
})
