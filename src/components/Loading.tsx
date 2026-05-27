import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { day } from '@/theme/colors'

// Full-screen loading state: a spinner with a line of context underneath, so a
// load never reads as a bare, meaningless circle. Used app-wide.
export function Loading({ label }: { label: string }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={day.gold} />
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  label: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    color: day.muted,
    marginTop: 14,
    textAlign: 'center',
  },
})
