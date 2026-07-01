import { Feather } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { logicalDate, markWoke } from '@/lib/days'
import { useProfile } from '@/lib/profile'
import { day } from '@/theme/colors'

// The wake screen — the calm "good morning" moment that eases the user into the
// day. It's the branded bridge between waking and the morning check-in.
//
// On a real device (iOS 26.1+), the system AlarmKit alarm fires and iOS shows its
// own stop UI when the app is closed; this screen is the in-app landing afterward,
// and the fallback experience where AlarmKit isn't available.
//
// NOTE: the spoken-voice playback is intentionally OUT for now — the real voice
// clips haven't been recorded yet (the placeholders were removed). When they land
// in assets/audio/, re-add playback here (loop the chosen voice; stop in dismiss).

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function nowLabel(): string {
  const d = new Date()
  const h = d.getHours()
  const m = d.getMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

export default function WakeScreen() {
  const router = useRouter()
  const { profile } = useProfile()
  const name = profile?.first_name?.trim() || 'there'
  const [time] = useState(nowLabel)
  // The "Preview the wake-up" entry (Settings) passes ?preview=1 so it never
  // writes to today's row — only a real alarm wake should record it.
  const { preview } = useLocalSearchParams<{ preview?: string }>()
  const isPreview = preview === '1'

  // A slow breathing pulse on the sun, so the screen feels alive but calm.
  const pulse = useSharedValue(1)
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.12, { duration: 2600, easing: Easing.inOut(Easing.ease) }), -1, true)
  }, [pulse])
  const sunStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }))

  // "Start my morning": into the full flow (Today → check-in). Streak credit comes
  // from the check-in as usual.
  const startMorning = () => {
    router.replace('/')
  }

  // "Not today": just wake, no routine. Record woke_at so the day still counts
  // toward the streak, then land on the calm Today (which shows the rested state).
  const justWake = () => {
    if (!isPreview) void markWoke(logicalDate()).catch(() => {})
    router.replace('/')
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <Animated.View style={[styles.sun, sunStyle]}>
          <Feather name="sunrise" size={52} color={day.gold} />
        </Animated.View>
        <Text style={styles.time}>{time}</Text>
        <Text style={styles.greeting}>
          {greeting()}, {name}.
        </Text>
        <Text style={styles.sub}>Take a breath. Your day starts when you&rsquo;re ready.</Text>
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.button} onPress={startMorning} accessibilityRole="button">
          <Text style={styles.buttonLabel}>Start my morning</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          onPress={justWake}
          accessibilityRole="button"
          accessibilityHint="Skip the routine today — you'll still keep your streak"
        >
          <Text style={styles.secondaryLabel}>Not today, just wake me</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: day.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  sun: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: day.goldTint,
    marginBottom: 28,
  },
  time: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 16,
    letterSpacing: 1,
    color: day.muted,
    marginBottom: 10,
  },
  greeting: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 34,
    color: day.text,
    textAlign: 'center',
  },
  sub: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 16,
    lineHeight: 23,
    color: day.muted,
    textAlign: 'center',
    marginTop: 14,
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 12,
  },
  button: {
    backgroundColor: day.gold,
    borderRadius: 16,
    paddingVertical: 19,
    alignItems: 'center',
  },
  buttonLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
    color: day.onAccent,
  },
  secondary: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    color: day.muted,
  },
})
