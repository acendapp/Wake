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

      <View style={styles.track}>
        {Array.from({ length: max }, (_, i) => {
          const n = i + 1
          return (
            <Pressable
              key={n}
              style={styles.cell}
              hitSlop={6}
              onPress={() => onChange(n)}
              accessibilityRole="adjustable"
              accessibilityLabel={`${label}: ${n} of ${max}`}
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
