import { Pressable, StyleSheet, Text, View } from 'react-native'
import { day } from '@/theme/colors'

// A 1–10 tap scale rendered as a row of bars that fill with gold up to the
// chosen value. Used for the evening reads (energy / mood / focus) and tomorrow's
// demand. Tuned for the warm cream surface. Endpoint labels are optional anchors.
type Props = {
  label: string
  value: number
  onChange: (n: number) => void
  lowLabel?: string
  highLabel?: string
  max?: number
}

export function Scale({ label, value, onChange, lowLabel, highLabel, max = 10 }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>

      {/* One adjustable control for the whole scale — a screen reader swipes up/
          down to change the value and hears it once, instead of meeting 10
          separate "adjustable" bars. The individual bars stay tappable for
          sighted users but are hidden from the accessibility tree. */}
      <View
        style={styles.track}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 1, max, now: value, text: `${value} of ${max}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') onChange(Math.min(max, value + 1))
          else if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(1, value - 1))
        }}
      >
        {Array.from({ length: max }, (_, i) => {
          const n = i + 1
          return (
            <Pressable
              key={n}
              style={styles.cell}
              hitSlop={6}
              onPress={() => onChange(n)}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <View style={[styles.bar, n <= value ? styles.barOn : styles.barOff]} />
            </Pressable>
          )
        })}
      </View>

      {(lowLabel || highLabel) && (
        <View style={styles.anchorRow}>
          <Text style={styles.anchor}>{lowLabel}</Text>
          <Text style={styles.anchor}>{highLabel}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 26,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  label: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 16,
    color: day.text,
  },
  value: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: day.gold,
  },
  track: {
    flexDirection: 'row',
    gap: 5,
  },
  cell: {
    flex: 1,
  },
  bar: {
    height: 30,
    borderRadius: 4,
  },
  barOn: {
    backgroundColor: day.gold,
  },
  barOff: {
    backgroundColor: day.border,
  },
  anchorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  anchor: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    color: day.muted,
  },
})
