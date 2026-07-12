import { Feather } from '@expo/vector-icons'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { ZoomIn } from 'react-native-reanimated'

import { day } from '@/theme/colors'

// A one-time celebration when the morning streak crosses a milestone (3, 7, 14,
// 30…). Fired from the Today tab; the "which milestone / already celebrated"
// bookkeeping lives in the caller (index.tsx + prefs.celebratedMilestone). Kept
// on-brand — serif numeral, sunrise motif, warm gold — not confetti.

const LINES: Record<number, string> = {
  3: 'Three mornings in a row. The habit is taking hold.',
  7: 'A full week of good mornings. This is who you are now.',
  14: 'Two weeks straight — most people never get here.',
  30: 'Thirty mornings. A month of rising well.',
  50: 'Fifty mornings. Waking well has become automatic.',
  75: 'Seventy-five mornings. Quietly remarkable.',
  100: 'One hundred mornings. A different person wakes up now.',
  150: 'A hundred and fifty mornings of showing up.',
  200: 'Two hundred mornings. This is mastery.',
  365: 'A full year of good mornings. Extraordinary.',
}

export function StreakCelebration({
  milestone,
  onDismiss,
}: {
  milestone: number
  onDismiss: () => void
}) {
  const line = LINES[milestone] ?? `${milestone} mornings in a row.`
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Animated.View entering={ZoomIn.springify().damping(15)} style={styles.card}>
          <View style={styles.rule}>
            <View style={styles.ruleLine} />
            <Feather name="sunrise" size={18} color={day.gold} />
            <View style={styles.ruleLine} />
          </View>
          <Text style={styles.count}>{milestone}</Text>
          <Text style={styles.countLabel}>morning streak</Text>
          <Text style={styles.line}>{line}</Text>
          <Pressable
            style={styles.button}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Keep going"
          >
            <Text style={styles.buttonText}>Keep going</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(40, 34, 24, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: day.background,
    borderRadius: 24,
    paddingVertical: 34,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'stretch',
    justifyContent: 'center',
    marginBottom: 18,
  },
  ruleLine: {
    height: 1,
    width: 44,
    backgroundColor: day.divider,
  },
  count: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 72,
    lineHeight: 78,
    color: day.gold,
  },
  countLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    letterSpacing: 0.5,
    color: day.muted,
    marginBottom: 16,
  },
  line: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
    color: day.text,
    marginBottom: 26,
  },
  button: {
    alignSelf: 'stretch',
    backgroundColor: day.goldButton,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: day.onAccent,
  },
})
