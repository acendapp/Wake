import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { day } from '@/theme/colors'

// The app-open animation: on warm cream, a gold sunrise glow blooms while the
// "Wake" serif wordmark eases up and fades in; it holds a beat, then the whole
// screen dissolves to reveal the app. Rendered as a full-screen overlay by the
// root layout on cold launch; calls onDone once it has faded out so the parent
// can unmount it.

const GLOW_MS = 950
const HOLD_MS = 600
const FADE_MS = 550

export function LaunchAnimation({ onDone }: { onDone: () => void }) {
  const glow = useSharedValue(0) // 0→1 bloom (scale + fade)
  const word = useSharedValue(0) // 0→1 rise + fade
  const screen = useSharedValue(1) // 1→0 dissolve to the app

  useEffect(() => {
    glow.value = withTiming(1, { duration: GLOW_MS, easing: Easing.out(Easing.cubic) })
    word.value = withDelay(220, withTiming(1, { duration: 780, easing: Easing.out(Easing.cubic) }))
    screen.value = withDelay(
      GLOW_MS + HOLD_MS,
      withTiming(0, { duration: FADE_MS, easing: Easing.inOut(Easing.ease) }, (finished) => {
        if (finished) runOnJS(onDone)()
      }),
    )
  }, [glow, word, screen, onDone])

  const rootStyle = useAnimatedStyle(() => ({ opacity: screen.value }))
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 0.7 + glow.value * 0.45 }],
  }))
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * 16 }],
  }))

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]} pointerEvents="none">
      <Animated.Image
        source={require('../../assets/images/sunrise-glow.png')}
        style={[styles.glow, glowStyle]}
        resizeMode="contain"
      />
      <Animated.Text style={[styles.word, wordStyle]}>Wake</Animated.Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: day.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 380,
    height: 380,
  },
  word: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 46,
    letterSpacing: 1,
    color: day.text,
  },
})
