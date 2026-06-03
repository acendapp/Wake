import { Feather, Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useState } from 'react'
import {
  LayoutAnimation,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { Plan, ReadinessState } from '@/engine/types'
import { logicalNow } from '@/lib/time'
import type { Weather, WeatherCondition } from '@/lib/weather'

// The populated Today home — the "beautiful home page": Wake wordmark, greeting
// card with the Focal Point + START, Where You Stand, The Gap, and the full
// sequence. Extracted into a component so two surfaces render the exact same
// thing and can never drift apart:
//  • The Today tab, with the user's real morning (src/app/(tabs)/index.tsx)
//  • The sample routine's opening view (src/app/routine.tsx?sample=1)
//
// Visual direction: calm, elite, editorial, warm — a high-end wellness brand,
// not a tech app.

// Mirrors src/theme/colors.ts `day` plus this screen's extras; consolidation
// into the theme module is a standing follow-up.
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

// Read on the You-vs-Day relationship shown under THE GAP bars. `read` states the
// relationship, `move` is the imperative that echoes the engine's three FRAMING
// verbs — close the deficit / hold the alignment / spend the surplus. The two are
// rendered on separate lines so the takeaway always breaks cleanly.
const GAP_SUMMARY: Record<ReadinessState, { read: string; move: string }> = {
  deficit: { read: "The day asks for more than you're bringing.", move: 'Close the gap.' },
  aligned: { read: "You're matched to today.", move: 'Maintain it.' },
  surplus: { read: 'More in the tank than today needs.', move: 'Make the most of it.' },
}

// Rows in the "i" popup that explains the Gap model. Ordered behind → matched →
// ahead so the scale reads top-to-bottom like a dial. Each `move` echoes the
// engine's three FRAMING verbs (close / hold / spend). The dot colors run a
// muted traffic light: red behind, neutral matched, green ahead. The row whose
// state matches the live `gapState` is emphasized when the popup opens.
const GAP_LEGEND: { state: ReadinessState; label: string; dot: string; move: string }[] = [
  { state: 'deficit', label: 'Deficit', dot: COLORS.negative, move: 'The day asks for more than you are bringing.' },
  { state: 'aligned', label: 'Aligned', dot: COLORS.tagline, move: "You're matched to what's ahead." },
  { state: 'surplus', label: 'Surplus', dot: COLORS.positive, move: 'You have more in the tank than the day requires.' },
]

// The noun that completes "Right now, you're in ___." at the foot of the popup.
const GAP_FOOTNOTE: Record<ReadinessState, string> = {
  deficit: 'a deficit',
  aligned: 'alignment',
  surplus: 'a surplus',
}

// The You-vs-Day card's title, per state. "The Gap" only reads right when there
// IS a gap to close — alignment and surplus get their own names. (The info
// popup keeps "The Gap" as the model's name; this is just the card's face.)
const GAP_TITLE: Record<ReadinessState, string> = {
  deficit: 'The Gap',
  aligned: 'In Balance',
  surplus: 'The Surplus',
}

// Ionicons glyph per coarse weather condition (see src/lib/weather.ts).
const WEATHER_ICON: Record<WeatherCondition, React.ComponentProps<typeof Ionicons>['name']> = {
  clear: 'sunny-outline',
  partly: 'partly-sunny-outline',
  overcast: 'cloud-outline',
  fog: 'cloud-outline',
  rain: 'rainy-outline',
  snow: 'snow-outline',
  storm: 'thunderstorm-outline',
}

// Time-of-day greeting, from the real clock (not the logical 3am-rollover day —
// at 1am "Good evening" is right even though the app still treats it as yesterday).
function greetingWord(hours: number): string {
  if (hours >= 5 && hours < 12) return 'Good morning'
  if (hours >= 12 && hours < 17) return 'Good afternoon'
  return 'Good evening'
}

export type TodayHomeProps = {
  userName: string
  /** Live local weather; null hides the block. */
  weather: Weather | null
  /** 1–10 "You" reading. */
  readiness: number
  /** 1–10 "Day" reading. */
  dayDifficulty: number
  gapState: ReadinessState
  /** The morning's plan (focal point + sequence). Null renders empty card text. */
  plan: Plan | null
  /** Slugs already checked off — drives DONE states in the cards. */
  completedSlugs: string[]
  /** Coarse word for how last night ended ("Steady", "Drained", "—"). */
  lastNight: string
  /** Display string for the routine length ("10 min", "—"). */
  routineTime: string
  /**
   * The action named in the (still mocked) pattern insight — "When you ___, your
   * focus hits 8+". The sample passes "stretch" to match its focal move.
   */
  insightAction?: string
  /** The START pill. */
  onStart: () => void
  /** Settings gear, top-right (the Today tab). Mutually exclusive with onClose. */
  onSettings?: () => void
  /** Close X, top-right (the sample flow). */
  onClose?: () => void
}

export function TodayHome({
  userName,
  weather,
  readiness,
  dayDifficulty,
  gapState,
  plan,
  completedSlugs,
  lastNight,
  routineTime,
  insightAction = 'walk',
  onStart,
  onSettings,
  onClose,
}: TodayHomeProps) {
  // Whether the "i" popup explaining the Gap model is open.
  const [infoOpen, setInfoOpen] = useState(false)

  // Whether the collapsible "YOUR FULL SEQUENCE" card is expanded. Collapsed by
  // default — the screen leads with the single Focal Point move.
  const [sequenceOpen, setSequenceOpen] = useState(false)
  const toggleSequence = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setSequenceOpen((open) => !open)
  }

  // The logical "now": until 3am this is still yesterday's date.
  const now = logicalNow()
  const dateLine = `${WEEKDAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}.`

  const sequence = plan?.sequence ?? []
  const activity = plan?.oneThing.title ?? ''
  const activityExample = plan?.oneThing.example ?? ''
  const focalDone = plan ? completedSlugs.includes(plan.oneThing.slug) : false
  const dayDemand = `${dayDifficulty}/10`

  // The pattern insight is still mocked — the real stats pipeline replaces this.
  const hasInsight = true

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top-right affordance: the Today tab passes onSettings (gear → You →
            Settings); the sample flow passes onClose (X → back where you came). */}
        <View style={styles.iconRow}>
          {onSettings ? (
            <Pressable
              hitSlop={10}
              onPress={onSettings}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Feather name="settings" size={18} color={COLORS.tagline} />
            </Pressable>
          ) : onClose ? (
            <Pressable
              hitSlop={10}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Feather name="x" size={20} color={COLORS.tagline} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>Wake</Text>
          <Text style={styles.tagline}>Your best days begin here.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardGreeting}>{greetingWord(new Date().getHours())}, {userName}.</Text>
              <Text style={styles.cardDate}>{dateLine}</Text>
            </View>

            {/* Real local weather; hidden entirely when it can't be known. */}
            {weather && (
              <View style={styles.weather}>
                <Ionicons
                  name={WEATHER_ICON[weather.condition]}
                  size={22}
                  color={COLORS.charcoal}
                />
                <Text style={styles.weatherTemp}>{weather.temperatureF}°F</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.gapRow}>
            <View style={styles.gapText}>
              <Text style={styles.focalLabel}>Focal Point</Text>
              <Text style={styles.gapPrompt}>{PROMPTS[gapState]}</Text>
              <Text style={styles.gapActivity}>{activity}</Text>
              {activityExample ? (
                <Text style={styles.gapExample}>{activityExample}</Text>
              ) : null}

              <View style={styles.insightRow}>
                <View style={styles.graphBadge}>
                  <Feather name="trending-up" size={14} color={COLORS.gold} />
                </View>

                {hasInsight ? (
                  <Text style={styles.insightText}>
                    When you {insightAction}, your focus hits{' '}
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
              onPress={onStart}
              accessibilityRole="button"
              accessibilityLabel={focalDone ? 'Routine done — review it' : 'Start activity'}
            >
              <LinearGradient
                colors={GOLD_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.gapButtonFill}
              >
                {/* Done state mirrors START exactly — same gold, same thin white
                    ring — only the glyph changes (check instead of arrow). */}
                <View style={styles.commitCircle}>
                  <Feather
                    name={focalDone ? 'check' : 'arrow-right'}
                    size={20}
                    color="#FFFFFF"
                  />
                </View>
                <Text style={styles.commitLabel}>{focalDone ? 'DONE' : 'START'}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, styles.cardMedia]}>
          <View style={styles.cardMediaClip}>
            <Image
              source={require('../../../assets/images/valley.jpg')}
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

            <Text style={styles.mediaLabel}>WHERE YOU STAND</Text>

            <View style={styles.glanceRow}>
              <View style={styles.glanceItem}>
                <Feather name="activity" size={16} color="#1A1A1A" />
                <Text style={styles.glanceValue}>{dayDemand}</Text>
                <Text style={styles.glanceLabel}>Demand</Text>
              </View>

              <View style={styles.glanceDivider} />

              <View style={styles.glanceItem}>
                <Feather name="moon" size={16} color="#1A1A1A" />
                <Text style={styles.glanceValue}>{lastNight}</Text>
                <Text style={styles.glanceLabel}>Last night</Text>
              </View>

              <View style={styles.glanceDivider} />

              <View style={styles.glanceItem}>
                <Feather name="clock" size={16} color="#1A1A1A" />
                <Text style={styles.glanceValue}>{routineTime}</Text>
                <Text style={styles.glanceLabel}>Routine</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.card, styles.cardGap]}>
          <View style={styles.gapBoxHeader}>
            <Text style={[styles.focalLabel, styles.gapBoxLabel]}>{GAP_TITLE[gapState]}</Text>
            <Pressable
              style={styles.infoBadge}
              hitSlop={10}
              onPress={() => setInfoOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="About the Gap"
            >
              <Text style={styles.infoBadgeText}>i</Text>
            </Pressable>
          </View>

          <View style={styles.gapBars}>
            <View style={styles.gapBarRow}>
              <Text style={styles.gapBarLabel}>You</Text>
              <View style={styles.gapTrack}>
                <View style={[styles.gapFillYou, { flex: readiness }]} />
                <View style={{ flex: 10 - readiness }} />
              </View>
              <Text style={styles.gapBarValue}>{readiness}</Text>
            </View>

            <View style={styles.gapBarRow}>
              <Text style={styles.gapBarLabel}>Day</Text>
              <View style={styles.gapTrack}>
                <View style={[styles.gapFillDay, { flex: dayDifficulty }]} />
                <View style={{ flex: 10 - dayDifficulty }} />
              </View>
              <Text style={styles.gapBarValue}>{dayDifficulty}</Text>
            </View>
          </View>

          <Text style={styles.gapSummary}>{GAP_SUMMARY[gapState].read}</Text>
          <Text style={styles.gapMove}>{GAP_SUMMARY[gapState].move}</Text>
        </View>

        <View style={styles.cardSequence}>
          <Pressable
            style={styles.sequenceHeader}
            onPress={toggleSequence}
            accessibilityRole="button"
            accessibilityState={{ expanded: sequenceOpen }}
            accessibilityLabel="Your full sequence"
          >
            <Feather name="list" size={24} color={COLORS.gold} />

            <View style={styles.sequenceHeaderText}>
              <Text style={styles.sequenceTitle}>YOUR FULL SEQUENCE</Text>
              <Text style={styles.sequenceSubtitle}>
                {sequence.length} steps • Personalized for today
              </Text>
            </View>

            <Feather
              name={sequenceOpen ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={COLORS.charcoal}
            />
          </Pressable>

          {sequenceOpen && (
            <View style={styles.sequenceList}>
              {sequence.map((step, i) => {
                const stepDone = completedSlugs.includes(step.slug)
                return (
                  <View key={step.slug} style={[styles.stepRow, i > 0 && styles.stepRowDivided]}>
                    {stepDone ? (
                      <View style={styles.stepCheck}>
                        <Feather name="check" size={10} color={COLORS.background} />
                      </View>
                    ) : (
                      <Text style={styles.stepNumber}>{i + 1}</Text>
                    )}
                    <View style={styles.stepTextCol}>
                      <Text style={styles.stepText}>{step.title}</Text>
                      {step.example ? (
                        <Text style={styles.stepExample}>{step.example}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.stepMinutes}>{step.estMinutes} min</Text>
                  </View>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={infoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoOpen(false)}
      >
        {/* Backdrop: a tap anywhere off the card dismisses. The inner card is its
            own Pressable with a no-op onPress so it captures the touch and the
            backdrop's onPress never fires when you tap the card itself. */}
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>The Gap</Text>
              <Pressable
                style={styles.modalClose}
                hitSlop={10}
                onPress={() => setInfoOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Feather name="x" size={16} color={COLORS.tagline} />
              </Pressable>
            </View>

            <Text style={styles.modalBody}>
              Every morning, Wake reads two things: how you&rsquo;re showing up, and what the
              day demands.
            </Text>
            <Text style={styles.modalBody}>
              If you are not in balance with the day ahead, the distance between them is
              your gap or surplus.
            </Text>

            <View style={styles.legend}>
              {GAP_LEGEND.map((row) => {
                const current = row.state === gapState
                return (
                  <View key={row.state} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: row.dot }]} />
                    <Text style={[styles.legendLabel, current && styles.legendLabelCurrent]}>
                      {row.label}
                    </Text>
                    <Text style={styles.legendMove}>{row.move}</Text>
                  </View>
                )
              })}
            </View>

            <Text style={styles.modalFootnote}>
              Right now, you&rsquo;re in{' '}
              <Text style={{ color: GAP_LEGEND.find((row) => row.state === gapState)!.dot }}>
                {GAP_FOOTNOTE[gapState]}
              </Text>
              .
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1, // bounds the scroll viewport to the screen so the stack can scroll
  },
  scrollContent: {
    // The 24px side gutter now lives on the scroll content (was on `safe`), so the
    // scrollbar sits at the screen edge. paddingBottom gives the last card room to
    // breathe at the end of the scroll.
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 8,
    minHeight: 26, // keeps the title block put even when there's no icon
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
  cardGap: {
    // The "THE GAP" box below WHERE YOU STAND — the You-vs-Day bars. Height sized
    // to fit the header + two bars + summary line; matches that box's 16px top gap.
    // Inherits the card's cream fill, shadow, radius, and 24/16 padding so the
    // header sits inset exactly like FOCAL POINT does in the main card.
    height: 190,
    marginTop: 16,
  },
  gapBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6, // between the label and the info badge
    marginBottom: 18, // space before the bars
  },
  gapBoxLabel: {
    marginBottom: 0, // override focalLabel's 20 — the header row owns the spacing
  },
  infoBadge: {
    width: 16,
    height: 16,
    borderRadius: 5, // a rounded square (a "box"), distinct from the circular badges
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBadgeText: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontStyle: 'italic', // a serif italic "i" reads as an editorial info mark
    fontSize: 10,
    lineHeight: 11,
    color: COLORS.gold, // matches the gold "THE GAP" label
    includeFontPadding: false,
  },
  gapBars: {
    gap: 12, // between the You and Day rows
    marginBottom: 16, // space before the summary line
  },
  gapBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12, // label ↔ track ↔ value
  },
  gapBarLabel: {
    width: 30, // fixed so both tracks start at the same x
    fontSize: 8.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.tagline, // same muted eyebrow as the other labels
  },
  gapTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    flexDirection: 'row', // fill + remainder split the width by flex (= the 1–10 value)
    backgroundColor: COLORS.iconCircle, // light grey track behind the fill
    overflow: 'hidden', // clips the fill to the track's rounded ends
  },
  gapFillYou: {
    backgroundColor: COLORS.gold, // "You" in gold — the brand/self color
  },
  gapFillDay: {
    backgroundColor: COLORS.charcoal, // "Day" in charcoal — the heavier demand
  },
  gapBarValue: {
    width: 18, // fits a two-digit "10"
    textAlign: 'right',
    fontFamily: 'PlayfairDisplay_400Regular', // the content face
    fontSize: 13,
    color: COLORS.charcoal,
    includeFontPadding: false,
  },
  gapSummary: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.charcoal, // the takeaway line — dark enough to read clearly
  },
  gapMove: {
    fontFamily: 'PlayfairDisplay_600SemiBold', // the imperative — the verdict your eye lands on
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2, // sits on its own line under the read
    color: COLORS.charcoal,
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
    // Kept at 5/8 width so all three columns stay left of the image fade (which
    // begins revealing at 50%) and read cleanly on the opaque cream.
    width: '62.5%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 14, // taller 3-line items, so nudge down a touch less than before
  },
  glanceItem: {
    flex: 1, // three equal columns
    alignItems: 'center',
    gap: 4, // between icon, value, and label
  },
  glanceValue: {
    fontFamily: 'PlayfairDisplay_400Regular', // the content face, like the greeting
    fontSize: 13,
    lineHeight: 16,
    color: '#1A1A1A',
    includeFontPadding: false,
    textAlign: 'center',
  },
  glanceLabel: {
    // Small system-font eyebrow under the value — same treatment as the date and
    // Focal Point labels (uppercase, tracked, muted), not the Playfair content face.
    fontSize: 8,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.tagline,
    textAlign: 'center',
  },
  glanceDivider: {
    width: StyleSheet.hairlineWidth, // thin grey vertical rule between items
    height: 44, // taller than before to span the icon + value + label stack
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
  gapExample: {
    // The low-intensity illustration beneath the broad action. Deliberately
    // muted and secondary — the gain is in the action, not this example. Same
    // serif as the lead-in above it; only the size and color set it apart.
    marginTop: 4,
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.tagline,
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
  // A completed step in the full-sequence list: gold check disc in the same
  // 14pt footprint as the step number, so the column stays aligned.
  stepCheck: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
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
  modalBackdrop: {
    flex: 1,
    // Warm-tinted dark scrim (not pure black) so the dim stays in the brand's
    // warm world. Centers the card and insets it from the screen edges.
    backgroundColor: 'rgba(20, 18, 15, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360, // keeps the card from sprawling on larger phones / tablets
    borderRadius: 24, // matches the cards on the screen behind it
    backgroundColor: COLORS.background, // same cream surface as everything else
    paddingVertical: 28,
    paddingHorizontal: 24,
    // Deeper shadow than the inline cards so the popup clearly floats above the
    // dimmed screen.
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'PlayfairDisplay_400Regular', // the editorial display face
    fontSize: 24,
    color: COLORS.charcoal,
    includeFontPadding: false,
  },
  modalClose: {
    width: 28,
    height: 28,
    borderRadius: 14, // a circular chip, like the weather/calendar icon buttons
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.iconCircle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.iconBorder,
  },
  modalBody: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    lineHeight: 21,
    // A softened warm ink, lighter than the charcoal wordmark — keeps the
    // explainer calm and readable rather than stark black-on-cream.
    color: '#4A453E',
    marginBottom: 12,
  },
  legend: {
    marginTop: 8,
    marginBottom: 20,
    gap: 14, // between the three state rows
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  legendLabel: {
    width: 64, // fixed so every `move` line starts at the same x
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.tagline, // muted by default
  },
  legendLabelCurrent: {
    color: COLORS.gold, // the live state's label lights up gold
  },
  legendMove: {
    flex: 1,
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 13,
    lineHeight: 17,
    color: COLORS.charcoal,
  },
  modalFootnote: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.tagline, // subtle — it reinforces the highlighted legend row
    // The state noun inside is colored inline to match its dot above:
    // red (deficit) / aligned grey / green (surplus).
  },
  cardSequence: {
    // Same cream surface, radius, and shadow as the other cards, but no fixed
    // height — it grows when the sequence expands. (The shared `card` style bakes
    // in height: 280, so this collapsible defines its own surface instead.)
    marginTop: 16,
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sequenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12, // even spacing between the list icon, the text block, and the chevron
  },
  sequenceHeaderText: {
    flex: 1, // takes the middle, pushing the chevron to the right edge
  },
  sequenceTitle: {
    // Matches the date eyebrow exactly (system font, 8.5px, uppercase, tracked,
    // muted) per the request to mirror the date/day line's treatment.
    fontSize: 8.5,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.tagline,
  },
  sequenceSubtitle: {
    marginTop: 4,
    fontFamily: 'PlayfairDisplay_400Regular', // the "Wake" content face
    fontSize: 11.5, // a touch smaller than the card's body copy
    color: COLORS.tagline, // same muted tone as the title above it
  },
  sequenceList: {
    marginTop: 16, // space between the header and the first step
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start', // top-align: the action can now wrap to an example line
    gap: 12, // number ↔ action ↔ minutes
    paddingVertical: 12,
  },
  stepRowDivided: {
    // Every row but the first gets a hairline rule above it, so the steps read
    // as a clean divided list.
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.divider,
  },
  stepNumber: {
    width: 14, // fixed so the action text aligns down the column
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    color: COLORS.gold, // gold numerals tie the list to the brand accent
    includeFontPadding: false,
  },
  stepTextCol: {
    flex: 1, // the action + example column takes the slack between number and time
  },
  stepText: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    lineHeight: 19,
    color: COLORS.charcoal,
  },
  stepExample: {
    // Secondary illustration under each step's broad action. Muted on purpose —
    // same serif as the action above it; only size and color set it apart.
    marginTop: 2,
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.tagline,
  },
  stepMinutes: {
    // Subtle right-aligned time estimate — reinforces the "if you have the time"
    // framing. Same muted eyebrow treatment as the other small labels.
    fontSize: 8.5,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.tagline,
  },
})
