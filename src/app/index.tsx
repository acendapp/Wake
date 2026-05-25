import { Feather, Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

// Visual direction: calm, elite, editorial, warm — a high-end wellness brand,
// not a tech app. This pass builds only the top portion (background, icon row,
// title block); the morning flow lands beneath it next.
const COLORS = {
  background: '#F2EFE9', // soft warm cream, set on the screen + root layout
  charcoal: '#2A2A2A', // the "Wake" wordmark
  tagline: '#8A7B6A', // muted warm brown/gray
  iconCircle: '#EAEAEA', // light grey chip behind each icon
  iconBorder: '#DCDCDC', // subtle grey edge so the chip reads on cream
  icon: '#000000', // black glyphs
  card: '#FFFFFF', // empty content card
  gold: '#8A6D2F', // deep antique gold — the greeting
}

// Long names formatted by hand so the date line doesn't depend on the device
// JS engine's Intl support (Hermes coverage varies).
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function Index() {
  // Placeholder until the Supabase profile / auth supplies the real name.
  const userName = 'Alex'

  const now = new Date()
  const dateLine = `${WEEKDAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}.`

  // Placeholder until a weather source is wired in.
  const temperature = 72

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.iconRow}>
        <Pressable
          style={styles.iconButton}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Weather"
        >
          <Feather name="sun" size={18} color={COLORS.icon} />
        </Pressable>

        <Pressable
          style={styles.iconButton}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Calendar"
        >
          <Feather name="calendar" size={18} color={COLORS.icon} />
        </Pressable>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.title}>Wake</Text>
        <Text style={styles.tagline}>Start your day the right way.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardGreeting}>Good morning, {userName}.</Text>
            <Text style={styles.cardDate}>{dateLine}</Text>
          </View>

          <View style={styles.weather}>
            <Ionicons name="partly-sunny-outline" size={30} color={COLORS.charcoal} />
            <Text style={styles.weatherTemp}>{temperature}°F</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.iconCircle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.iconBorder,
  },
  titleBlock: {
    alignItems: 'center',
    marginTop: 8,
  },
  title: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 64,
    lineHeight: 72,
    color: COLORS.charcoal,
  },
  tagline: {
    marginTop: 4,
    fontSize: 15,
    letterSpacing: 0.3,
    color: COLORS.tagline,
  },
  card: {
    marginTop: 24,
    height: 220,
    borderRadius: 24,
    padding: 24,
    backgroundColor: COLORS.card,
    // Soft lift so the white card reads against the cream background.
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderText: {
    flex: 1,
    marginRight: 12,
  },
  cardGreeting: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 18,
    lineHeight: 24,
    color: COLORS.gold,
  },
  cardDate: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.tagline,
  },
  weather: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weatherTemp: {
    fontSize: 17,
    color: COLORS.charcoal,
  },
})
