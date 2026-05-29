import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View } from 'react-native'

import { day } from '@/theme/colors'

// The "editorial curation" beat between the last onboarding answer and account
// creation. Serif lines fade in one at a time on the bare cream surface — no
// spinners, no progress bars — to stage the theater of a routine being composed
// in real time. When the sequence finishes, every line fades out together and
// `onDone` fires. Lines are passed in already personalized (see onboarding.tsx).

const LINE_FADE = 600 // each line eases in over this long
const LINE_GAP = 1200 // the unhurried pause between lines (~1.2s, per design)
const HOLD = 900 // beat after the final line before the canvas clears
const OUT_FADE = 700 // all lines fade out together

export function CurationLoader({
  lines,
  onDone,
}: {
  lines: string[]
  onDone: () => void
}) {
  // One opacity per line, plus a container opacity for the shared fade-out.
  const lineOpacities = useRef(lines.map(() => new Animated.Value(0))).current
  const containerOpacity = useRef(new Animated.Value(1)).current
  const done = useRef(false)

  useEffect(() => {
    const steps: Animated.CompositeAnimation[] = []
    lineOpacities.forEach((op) => {
      steps.push(
        Animated.timing(op, {
          toValue: 1,
          duration: LINE_FADE,
          useNativeDriver: true,
        }),
      )
      steps.push(Animated.delay(LINE_GAP))
    })
    steps.push(Animated.delay(HOLD))
    steps.push(
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: OUT_FADE,
        useNativeDriver: true,
      }),
    )

    const animation = Animated.sequence(steps)
    animation.start(({ finished }) => {
      if (finished && !done.current) {
        done.current = true
        onDone()
      }
    })
    return () => animation.stop()
    // Run once on mount; lines are fixed for the life of this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.stack, { opacity: containerOpacity }]}>
        {lines.map((line, i) => (
          <Animated.Text key={line} style={[styles.line, { opacity: lineOpacities[i] }]}>
            {line}
          </Animated.Text>
        ))}
      </Animated.View>
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
  stack: {
    gap: 22,
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
