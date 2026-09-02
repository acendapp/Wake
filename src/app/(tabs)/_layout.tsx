import { Feather } from '@expo/vector-icons'
import { Tabs, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useEntitlement } from '@/lib/entitlement'
import { daysUntil } from '@/lib/time'
import { day } from '@/theme/colors'

// Bottom-tab palette, from the shared theme. Gold is the app's accent (greeting +
// START button), so it marks the active tab; muted warm brown marks the rest.
const ACTIVE = day.gold // deep antique gold
const INACTIVE = day.muted // muted warm brown/gray
const SURFACE = day.background // the cream that fills the app
const HAIRLINE = day.border // subtle grey edge

// A touch smaller than React Navigation's default (24) so the glyphs sit quieter
// in the bar and don't crowd the Playfair labels.
const ICON_SIZE = 19

// The promo-grace countdown: a user whose code was deactivated keeps access for
// 7 days, and this pill — floating over every tab — is how they find out and
// where they convert. Tapping it opens the paywall (the root gate lets a grace
// user visit it). Absolutely positioned so no screen's own layout shifts.
function GraceBanner() {
  const { promoGraceEndsAt } = useEntitlement()
  const router = useRouter()
  if (promoGraceEndsAt === null) return null
  const days = daysUntil(promoGraceEndsAt)
  const when = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
  return (
    <SafeAreaView edges={['top']} style={styles.bannerSafe} pointerEvents="box-none">
      <Pressable
        onPress={() => router.push('/paywall')}
        style={({ pressed }) => [styles.banner, pressed && { opacity: 0.9 }]}
        accessibilityRole="button"
      >
        <Text style={styles.bannerText}>
          Your free access ends {when} — <Text style={styles.bannerLink}>keep your mornings</Text>
        </Text>
      </Pressable>
    </SafeAreaView>
  )
}

// Tab order: morning (Today) → review (Reflect) → learn (Library) → who you're
// becoming (You). Icons echo it: sun, moon, book, then the person. (Today's sun
// is why the header weather glyph was moved off `sun` to `cloud`.)
export default function TabsLayout() {
  return (
    <View style={styles.flex}>
      <GraceBanner />
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        // NOTE: bottom-tab `animation: 'fade'` was tried but it detaches/remounts
        // inactive screens, which re-fires the You page's staggered FadeInDown
        // section animations on every return (blank flash). Left off; tab switches
        // stay instant. In-screen + stack transitions carry the "soft" feel.
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <Feather name="sun" size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reflect"
        options={{
          title: 'Reflect',
          tabBarIcon: ({ color }) => <Feather name="moon" size={ICON_SIZE} color={color} />,
          // Reflect is a full-screen evening ritual — hide the tab bar whenever it's
          // the active tab. Declared here (static) rather than toggled from inside the
          // screen, so switching into/out of Reflect never flickers the bar. The
          // screen's own X / Done buttons navigate back to Today.
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color }) => <Feather name="book-open" size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarIcon: ({ color }) => <Feather name="user" size={ICON_SIZE} color={color} />,
        }}
      />
      </Tabs>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  // Grace countdown pill: floats over screen content inside the top safe area,
  // gold-tinted so it reads as a gentle nudge, not an error.
  bannerSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
  },
  banner: {
    marginTop: 6,
    marginHorizontal: 24,
    backgroundColor: day.goldTint,
    borderWidth: 1,
    borderColor: day.gold,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bannerText: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 13,
    color: day.text,
    textAlign: 'center',
  },
  bannerLink: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    color: day.gold,
    textDecorationLine: 'underline',
  },
  bar: {
    backgroundColor: SURFACE,
    borderTopColor: HAIRLINE,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0, // drop Android's default shadow so it reads as one flat surface
  },
  label: {
    fontFamily: 'PlayfairDisplay_400Regular', // same serif face as the "Wake" wordmark
    fontSize: 11,
  },
  item: {
    paddingTop: 4, // a little air between the icon and the bar's top edge
  },
})
