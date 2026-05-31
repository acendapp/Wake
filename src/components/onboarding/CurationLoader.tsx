import { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, View } from 'react-native'

import { day } from '@/theme/colors'

// The "editorial curation" beat between the last onboarding answer and account
// creation. One serif line at a time, centered on the bare cream surface — each
// fades in, holds, then fades out and is replaced by the next — to stage the
// theater of a routine being composed in real time. No spinners, no progress
// bars. When the final line clears, `onDone` fires. Lines are passed in already
// personalized (see onboarding.tsx).

const LINE_IN = 600 // each line eases in over this long
const LINE_HOLD = 1100 // it rests, fully visible, for this beat
const LINE_OUT = 500 // then fades out before the next takes its place

export function CurationLoader({
  lines,
  onDone,
}: {
  lines: string[]
  onDone: () => void
}) {
  // A single opacity drives the one visible line; `index` advances through them.
  const opacity = useRef(new Animated.Value(0)).current
  const [index, setIndex] = useState(0)
  const done = useRef(false)

  const finish = () => {
    if (done.current) return
    done.current = true
    onDone()
  }

  useEffect(() => {
    if (lines.length === 0) {
      finish()
      return
    }
    const isLast = index >= lines.length - 1
    opacity.setValue(0)
    const animation = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: LINE_IN, useNativeDriver: true }),
      Animated.delay(LINE_HOLD),
      Animated.timing(opacity, { toValue: 0, duration: LINE_OUT, useNativeDriver: true }),
    ])
    animation.start(({ finished }) => {
      if (!finished) return
      if (isLast) finish()
      else setIndex((i) => i + 1)
    })
    return () => animation.stop()
    // Re-runs each time the line advances; lines are fixed for the screen's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  return (
    <View style={styles.root}>
      <Animated.Text style={[styles.line, { opacity }]}>{lines[index]}</Animated.Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: day.background,
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  line: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontStyle: 'italic',
    fontSize: 21,
    lineHeight: 30,
    color: day.text,
    textAlign: 'center',
  },
})
