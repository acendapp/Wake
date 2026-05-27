import { Feather } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

// Shared empty-state for tabs whose screens aren't built yet. Sets each tab's
// identity — its icon, name, and a one-line promise of what will live there — in
// the same editorial voice as the Today screen, so an unfinished tab still reads
// as "intentionally coming" rather than broken.
type Props = {
  icon: keyof typeof Feather.glyphMap
  title: string
  tagline: string
  body: string
}

const COLORS = {
  background: '#FAF8F4',
  charcoal: '#2A2A2A',
  tagline: '#8A7B6A',
  gold: '#8A6D2F',
  iconCircle: '#EAEAEA',
  iconBorder: '#DCDCDC',
}

export function TabPlaceholder({ icon, title, tagline, body }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.center}>
        <View style={styles.iconChip}>
          <Feather name={icon} size={22} color={COLORS.gold} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.tagline}>{tagline}</Text>
        <Text style={styles.body}>{body}</Text>
        <Text style={styles.soon}>Coming soon</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  iconChip: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.iconCircle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.iconBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold', // the display weight, like "Wake"
    fontSize: 30,
    color: COLORS.charcoal,
  },
  tagline: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    color: COLORS.tagline,
    marginTop: 6,
  },
  body: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.charcoal,
    textAlign: 'center',
    marginTop: 18,
  },
  soon: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.tagline,
    marginTop: 22,
  },
})
