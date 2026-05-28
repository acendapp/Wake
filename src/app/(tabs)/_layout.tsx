import { Feather } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { StyleSheet } from 'react-native'

// Bottom-tab palette. Mirrors the values in the Today screen's COLORS until those
// move into a shared theme module — see [[shared-theme-colors-followup]]. Gold is
// the app's accent (greeting + START button), so it marks the active tab; muted
// warm brown marks the rest.
const ACTIVE = '#8A6D2F' // deep antique gold
const INACTIVE = '#8A7B6A' // muted warm brown/gray
const SURFACE = '#FAF8F4' // the cream that fills the app
const HAIRLINE = '#DCDCDC' // subtle grey edge

// A touch smaller than React Navigation's default (24) so the glyphs sit quieter
// in the bar and don't crowd the Playfair labels.
const ICON_SIZE = 19

// Tab order: morning (Today) → review (Reflect) → learn (Library) → who you're
// becoming (You). Icons echo it: sun, moon, book, then the person. (Today's sun
// is why the header weather glyph was moved off `sun` to `cloud`.)
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
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
  )
}

const styles = StyleSheet.create({
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
