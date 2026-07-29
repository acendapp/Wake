import { Component, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { day } from '@/theme/colors'

// App-wide error boundary. A React render/lifecycle error anywhere below this
// point would otherwise unmount the whole tree and crash the app to a blank
// screen; here it's caught and turned into a calm, recoverable surface with a
// "Try again" that re-mounts the subtree. Placed ABOVE the providers in the root
// layout, so it survives even a provider throwing — which means the fallback must
// depend on NOTHING from app context (no theme provider, no safe-area provider,
// no navigation). It only catches render-time errors, not async/event-handler
// throws (those are already guarded case-by-case).

type Props = { children: ReactNode }
type State = { hasError: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Surface in development; in production this simply degrades to the fallback.
    if (__DEV__) console.error('[AppErrorBoundary] caught render error:', error, info)
  }

  private reset = () => this.setState({ hasError: false })

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <View style={styles.root}>
        <View style={styles.center}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            The app hit an unexpected snag. Your progress is saved — tap below to pick
            up where you left off.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={this.reset}
            accessibilityRole="button"
          >
            <Text style={styles.buttonLabel}>Try again</Text>
          </Pressable>
        </View>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: day.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 26,
    color: day.text,
    textAlign: 'center',
  },
  body: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: day.muted,
    textAlign: 'center',
    marginTop: 12,
  },
  button: {
    marginTop: 28,
    backgroundColor: day.gold,
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
    color: day.onAccent,
  },
})
