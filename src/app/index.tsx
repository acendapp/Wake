import { Feather, Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { ReadinessState } from '@/engine/types'

// Visual direction: calm, elite, editorial, warm — a high-end wellness brand,
// not a tech app. This pass builds only the top portion (background, icon row,
// title block); the morning flow lands beneath it next.
const COLORS = {
  background: '#FAF8F4', // soft warm cream, set on the screen + root layout
  charcoal: '#2A2A2A', // the "Wake" wordmark
  tagline: '#8A7B6A', // muted warm brown/gray
  iconCircle: '#EAEAEA', // light grey chip behind each icon
  iconBorder: '#DCDCDC', // subtle grey edge so the chip reads on cream
  icon: '#000000', // black glyphs
  divider: '#C4C4C4', // thin rule inside the card
  gold: '#8A6D2F', // deep antique gold — the greeting
  goldButton: '#9A7340', // warm antique gold — the START button base
  positive: '#2E7D4F', // muted green — the upside in a data insight
  negative: '#B23B3B', // muted red — the downside in a data insight
}

// Subtle top→bottom sheen for the START button — brackets the antique gold
// above (lighter at top, darker at bottom) for a little depth.
const GOLD_GRADIENT = ['#A87F4A', '#8C6736'] as const

// Media card: left half stays the card's background color, then fades across the
// right half to reveal the image. The last stop is the bg color at 0 alpha (not
// "transparent") so the fade keeps the warm hue instead of muddying toward black.
const MEDIA_FADE = [COLORS.background, COLORS.background, `${COLORS.background}00`] as const
const MEDIA_FADE_LOCATIONS = [0, 0.5, 1] as const

// Long names formatted by hand so the date line doesn't depend on the device
// JS engine's Intl support (Hermes coverage varies).
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// State-aware lead-in shown above the recommended activity. Keyed by the Gap
// model's readiness state (see src/engine/types.ts).
const PROMPTS: Record<ReadinessState, string> = {
  deficit: 'If you do nothing else today:',
  aligned: 'Your move for today:',
  surplus: 'Best use of your edge today:',
}

export default function Index() {
  // Placeholder until the Supabase profile / auth supplies the real name.
  const userName = 'Alex'

  const now = new Date()
  const dateLine = `${WEEKDAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}.`

  // Placeholder until a weather source is wired in.
  const temperature = 72

  // State-aware copy. Placeholder state until the morning check-in feeds real
  // readiness vs. day-difficulty into the engine's classifyState().
  const gapState: ReadinessState = 'aligned'
  const activity = 'a short walk before your 9:00.'

  // Smart insight. Placeholder `true` so the populated state shows; this flips
  // to false until the user has logged enough mornings to detect a pattern.
  const hasInsight = true

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
            <Ionicons name="partly-sunny-outline" size={22} color={COLORS.charcoal} />
            <Text style={styles.weatherTemp}>{temperature}°F</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.gapRow}>
          <View style={styles.gapText}>
            <Text style={styles.focalLabel}>Focal Point</Text>
            <Text style={styles.gapPrompt}>{PROMPTS[gapState]}</Text>
            <Text style={styles.gapActivity}>{activity}</Text>

            <View style={styles.insightRow}>
              <View style={styles.graphBadge}>
                <Feather name="trending-up" size={14} color={COLORS.gold} />
              </View>

              {hasInsight ? (
                <Text style={styles.insightText}>
                  When you walk, your focus hits{' '}
                  <Text style={styles.insightPos}>8+</Text>. Skipping it:{' '}
                  <Text style={styles.insightNeg}>under 5</Text>.
                </Text>
              ) : (
                <Text style={styles.insightText}>Your patterns will show here soon</Text>
              )}
            </View>
          </View>

          <Pressable
            style={styles.gapButton}
            accessibilityRole="button"
            accessibilityLabel="Start activity"
          >
            <LinearGradient
              colors={GOLD_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.gapButtonFill}
            >
              <View style={styles.commitCircle}>
                <Feather name="arrow-right" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.commitLabel}>START</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      <View style={[styles.card, styles.cardMedia]}>
        <View style={styles.cardMediaClip}>
          <Image
            source={require('../../assets/images/valley.png')}
            style={[StyleSheet.absoluteFill, styles.mediaImage]}
            contentFit="cover"
          />
          <LinearGradient
            colors={MEDIA_FADE}
            locations={MEDIA_FADE_LOCATIONS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />

          <Text style={styles.mediaLabel}>TODAY AT A GLANCE</Text>

          <View style={styles.glanceRow}>
            <View style={styles.glanceItem}>
              <Feather name="users" size={18} color="#1A1A1A" />
              <Text style={styles.glanceLabel}>Standup</Text>
            </View>

            <View style={styles.glanceDivider} />

            <View style={styles.glanceItem}>
              <Feather name="coffee" size={18} color="#1A1A1A" />
              <Text style={styles.glanceLabel}>Coffee</Text>
            </View>

            <View style={styles.glanceDivider} />

            <View style={styles.glanceItem}>
              <Feather name="video" size={18} color="#1A1A1A" />
              <Text style={styles.glanceLabel}>Call</Text>
            </View>

            <View style={styles.glanceDivider} />

            <View style={styles.glanceItem}>
              {/* No confident sleek workout glyph — fall back to the header's calendar icon. */}
              <Feather name="calendar" size={18} color="#1A1A1A" />
              <Text style={styles.glanceLabel}>Workout</Text>
            </View>
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
    // Negative pull tucks the whole stack (title, tagline, card) up closer to
    // the icon row — they all shift together since the card flows beneath this.
    marginTop: -8,
  },
  title: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 64,
    lineHeight: 72,
    color: COLORS.charcoal,
  },
  tagline: {
    // Pulled up 8px (4 → -4) to sit tighter under the wordmark. The card below
    // adds the same 8px back to its own margin, so the white box stays put.
    marginTop: -4,
    fontFamily: 'PlayfairDisplay_400Regular', // match the "Wake" wordmark
    fontSize: 15,
    letterSpacing: 0.3,
    // Playfair has no weight below 400, so color is the lever for perceived
    // weight. Mid-gray reads distinctly lighter than the charcoal wordmark.
    color: '#555555',
  },
  card: {
    // 24 + 8 to absorb the tagline's upward shift above, keeping the box fixed.
    marginTop: 32,
    height: 280,
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 16, // a third tighter than vertical → content sits closer to the L/R edges
    // Same fill as the screen background — the box now reads only by its shadow.
    backgroundColor: COLORS.background,
    // A little shadow hugging the border so the box stays visible against the
    // matching background; the small offset keeps it fairly even on all edges.
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardMedia: {
    // Media card below the main one — same surface (color + shadow + radius from
    // styles.card), half the height. No overflow:hidden here so the card's shadow
    // still shows; the clip child rounds the image. Padding zeroed for edge-to-edge.
    height: 140, // half of the main card's 280
    marginTop: 16,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  cardMediaClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24, // match the card so the image clips to the rounded corners
    overflow: 'hidden',
  },
  mediaImage: {
    // The image is less wide than the card, so under `cover` it fills the width
    // with no horizontal room for contentPosition. We push it right with a
    // translate; the left gap it leaves is hidden under the opaque part of the fade.
    transform: [{ translateX: 30 }],
  },
  mediaLabel: {
    position: 'absolute',
    top: 16,
    left: 16,
    fontFamily: 'PlayfairDisplay_400Regular', // same face as "Wake"
    fontSize: 10.5, // slightly bigger than the 8.5 date eyebrow
    letterSpacing: 0.5,
    color: '#1A1A1A', // dark, close to black
  },
  glanceRow: {
    position: 'absolute',
    left: 10,
    top: 0,
    bottom: 0,
    width: '62.5%', // 5/8 of the card, left-aligned
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20, // nudge the items just below vertical center
  },
  glanceItem: {
    flex: 1, // four equal columns
    alignItems: 'center',
    gap: 5, // between icon and name
  },
  glanceLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 9.5,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  glanceDivider: {
    width: StyleSheet.hairlineWidth, // thin grey vertical rule between items
    height: 36,
    backgroundColor: COLORS.divider,
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
    fontSize: 16,
    lineHeight: 20,
    color: COLORS.gold,
  },
  cardDate: {
    // More gap under the greeting. The divider flows beneath this row, so it
    // shifts down by the same amount automatically — the date↔divider gap holds.
    marginTop: 8,
    fontSize: 8.5,
    fontWeight: '500', // a touch heavier than the default 400
    // Uppercase + light tracking turns the date into a small eyebrow label.
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.tagline,
  },
  divider: {
    // hairlineWidth = the thinnest line the device can draw. Paired with a
    // darker grey so it stays visible at that thinness (the faint grey was why
    // the earlier hairline disappeared). The card's padding insets the ends.
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.divider,
    marginTop: 16,
  },
  gapRow: {
    flex: 1, // fills the card from below the divider down to its bottom padding
    flexDirection: 'row',
    marginTop: 16, // starts the row (text + button) slightly below the divider
    gap: 16,
  },
  gapText: {
    flex: 1, // left column; the gold button takes the right
  },
  focalLabel: {
    marginBottom: 20, // match the activity→icon gap below (graphBadge marginTop)
    fontSize: 8.5, // same size as the date eyebrow in the header
    fontWeight: '700', // a touch bolder still
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.gold, // same gold as the "Good morning" greeting
  },
  gapPrompt: {
    fontFamily: 'PlayfairDisplay_400Regular', // same face as "Wake"
    fontSize: 15,
    lineHeight: 20,
    color: '#000000', // the dynamic, state-aware lead-in
  },
  gapActivity: {
    marginTop: 4,
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.gold, // matches the "Good morning" greeting
  },
  graphBadge: {
    width: 28,
    height: 28,
    borderRadius: 14, // the small circle around the graph
    borderWidth: 1,
    borderColor: COLORS.divider, // same grey as the divider; graph glyph stays gold
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightRow: {
    marginTop: 20, // space below the activity (moved here from the badge)
    flexDirection: 'row',
    alignItems: 'flex-start', // insight text aligns to the top of the badge
    gap: 8,
  },
  insightText: {
    flex: 1, // fill the width to the right of the badge
    fontFamily: 'PlayfairDisplay_400Regular', // same face as "Wake"
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.tagline, // same gray as the day/date
  },
  insightPos: {
    color: COLORS.positive, // green — the upside ("8+")
  },
  insightNeg: {
    color: COLORS.negative, // red — the downside ("under 5")
  },
  gapButton: {
    width: 72,
    // Stretches to the row height (alignItems: 'stretch') but inset top/bottom,
    // so it's shorter than the full row and stays vertically centered with the
    // information in the left column.
    marginVertical: 20,
    borderRadius: 100, // clamps to width/2 → a pill / oval
    backgroundColor: COLORS.goldButton, // base color behind the gradient
    // Soft drop shadow for depth. No overflow:hidden here so the shadow shows;
    // the gradient child clips itself to the rounded shape instead.
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  gapButtonFill: {
    flex: 1, // fill the pill
    borderRadius: 100, // match the pill so the gradient clips to the shape
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8, // between the white ring and the START label
  },
  commitCircle: {
    width: 56,
    height: 56,
    borderRadius: 28, // thin-bordered ring inside the gold oval
    borderWidth: StyleSheet.hairlineWidth, // slightly thinner ring
    borderColor: '#FFFFFF', // thin white ring with a transparent center
    alignItems: 'center',
    justifyContent: 'center',
  },
  commitLabel: {
    fontFamily: 'PlayfairDisplay_400Regular', // same face as "Wake"
    fontSize: 13,
    color: '#FFFFFF', // white on the gold oval
  },
  weather: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weatherTemp: {
    fontFamily: 'PlayfairDisplay_400Regular', // match the "Wake" wordmark
    fontSize: 17,
    color: COLORS.charcoal,
    // Drop the font's extra vertical padding so the number's optical center
    // lines up with the icon (the row's alignItems: 'center' does the rest).
    includeFontPadding: false,
  },
})
