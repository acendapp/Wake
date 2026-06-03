import { Feather, Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { TrendChart } from '@/components/you/TrendChart'
import { useAuth } from '@/lib/auth'
import { completedDayCount } from '@/lib/days'
import { useProfile } from '@/lib/profile'
import { day } from '@/theme/colors'

// The You page — who you're becoming. The mirror to Today's "what to do now":
// identity up top, then the evidence (streak, trends, patterns), then the
// account plumbing tucked quietly at the bottom. Editorial rhythm: open
// sections on cream alternate with white cards, generous air between beats.
//
// Two faces, gated on real history:
//  - Cold start (under MIN_MORNINGS of check-ins): designed anticipation states
//    that say what will appear and how to earn it — never fake numbers.
//  - Rich (enough history): streak, trends, patterns, stats.
//
// Motion: sections cascade in on first open; the streak counts up; the chart
// draws itself and morphs between metrics; pills give spring feedback.

// ─────────────────────────────────────────────────────────────────────────────
// Cold-start gate. Until the real stats pipeline lands, the rich layout shows
// SAMPLE numbers (the block below) — so PREVIEW_WITH_SAMPLE_DATA=true forces it
// regardless of history. Flip to false to see the honest cold-start experience.
// When real stats land, delete the flag and the sample block together.
// ─────────────────────────────────────────────────────────────────────────────
const PREVIEW_WITH_SAMPLE_DATA = true
const MIN_MORNINGS_FOR_TRENDS = 3

// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER DATA — sample/static values for the rich layout. Wire to real
// `days` history (src/lib/days.ts) when the stats pipeline lands. The profile
// (name, intent, created_at), the day count, and Sign out are real.
// ─────────────────────────────────────────────────────────────────────────────

type Metric = 'energy' | 'mood' | 'focus'

const TREND: Record<Metric, number[]> = {
  energy: [5.2, 5.8, 5.1, 6.4, 6.0, 5.6, 6.8, 6.2, 7.1, 6.6, 7.4, 7.0, 7.8, 8.2],
  mood: [5.8, 6.2, 5.6, 6.0, 6.6, 7.0, 6.4, 6.8, 7.2, 6.9, 7.0, 7.6, 7.4, 8.0],
  focus: [4.8, 5.2, 5.8, 5.4, 6.2, 5.9, 6.6, 6.1, 6.8, 7.2, 6.9, 7.5, 7.9, 7.6],
}

const TREND_DELTA: Record<Metric, string> = {
  energy: 'Energy is running 12% above the week before.',
  mood: 'Mood is running 8% above the week before.',
  focus: 'Focus is running 15% above the week before.',
}

const METRIC_LABEL: Record<Metric, string> = {
  energy: 'Energy',
  mood: 'Mood',
  focus: 'Focus',
}

const STREAK = { current: 12, best: 18 }

// The current week, Monday-first. 'done' | 'missed' | 'ahead' (not yet reached).
const WEEK: { initial: string; status: 'done' | 'missed' | 'ahead' }[] = [
  { initial: 'M', status: 'done' },
  { initial: 'T', status: 'done' },
  { initial: 'W', status: 'done' },
  { initial: 'T', status: 'done' },
  { initial: 'F', status: 'missed' },
  { initial: 'S', status: 'done' },
  { initial: 'S', status: 'ahead' },
]

// How the user has been arriving to their days, as a share of mornings.
const GAP_MIX = [
  { key: 'deficit', label: 'In a deficit', pct: 23, color: day.negative },
  { key: 'aligned', label: 'Aligned', pct: 58, color: day.gold },
  { key: 'surplus', label: 'In surplus', pct: 19, color: day.positive },
] as const

const PATTERNS: {
  icon: React.ComponentProps<typeof Feather>['name']
  title: string
  body: string
}[] = [
  {
    icon: 'trending-up',
    title: 'Movement compounds',
    body: 'Mornings that start with your body moving run about 18% higher energy through the afternoon.',
  },
  {
    icon: 'sun',
    title: 'Light is your lever',
    body: 'When you get outside light in the first hour, your mood holds past 3pm instead of dipping.',
  },
]

const PORTFOLIO = [
  { value: '34', label: 'mornings built' },
  { value: '7.2h', label: 'invested in you' },
  { value: 'Tue', label: 'strongest day' },
  { value: '86%', label: 'follow-through' },
]

// ── Real-data helpers ────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// "Building calmer mornings" — the identity line under the name, from intent.
const INTENT_PHRASE: Record<string, string> = {
  calm: 'calmer mornings',
  energize: 'higher-energy mornings',
  focus: 'sharper mornings',
}

function memberSince(createdAt: string | undefined): string | null {
  if (!createdAt) return null
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return null
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** Calendar labels for the chart's scrub readout: "May 18" … "Today". */
function lastNDayLabels(n: number): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    out.push(i === 0 ? 'Today' : `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`)
  }
  return out
}

// ── Motion helpers ───────────────────────────────────────────────────────────

/** Eased count-up for hero numbers (0 → target over `duration` ms). */
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf: number
    const start = Date.now()
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

/** A page section that cascades in (fade + rise) when the tab first opens. */
function Section({ delay = 0, children }: { delay?: number; children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(500).delay(delay)}>{children}</Animated.View>
  )
}

/** A metric pill with spring press feedback. */
function SpringPill({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.9, { damping: 14, stiffness: 320 })
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 320 })
        }}
        onPress={onPress}
        style={[styles.pill, selected && styles.pillOn]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        <Text style={[styles.pillLabel, selected && styles.pillLabelOn]}>{label}</Text>
      </Pressable>
    </Animated.View>
  )
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function YouScreen() {
  const { profile } = useProfile()
  const { session, signOut } = useAuth()
  const { width: screenWidth } = useWindowDimensions()
  const scrollRef = useRef<ScrollView>(null)

  const [metric, setMetric] = useState<Metric>('energy')

  // Sign-out in flight — keeps the row from feeling dead while the auth call
  // runs (it can take a moment offline before the local fallback kicks in).
  const [signingOut, setSigningOut] = useState(false)

  // Real history count → drives the cold-start gate. Refreshed on focus so the
  // page advances as mornings accumulate.
  const [dayCount, setDayCount] = useState<number | null>(null)
  useFocusEffect(
    useCallback(() => {
      let active = true
      completedDayCount()
        .then((c) => {
          if (active) setDayCount(c)
        })
        .catch(() => {
          if (active) setDayCount(0)
        })
      return () => {
        active = false
      }
    }, []),
  )

  // Settings gears on other tabs land here with a fresh ?settings=<timestamp>
  // param; each new value scrolls down to the settings section. The delay lets
  // the tab switch + entrance animations settle before the scroll starts.
  const { settings } = useLocalSearchParams<{ settings?: string }>()
  useEffect(() => {
    if (!settings) return
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 350)
    return () => clearTimeout(t)
  }, [settings])

  const count = dayCount ?? 0
  const hasHistory = PREVIEW_WITH_SAMPLE_DATA || count >= MIN_MORNINGS_FOR_TRENDS

  const firstName = profile?.first_name?.trim() || 'You'
  const becoming = INTENT_PHRASE[profile?.intent ?? ''] ?? 'better mornings'
  const since = memberSince(profile?.created_at)
  const email = session?.user.email ?? '—'

  const streakValue = useCountUp(hasHistory ? STREAK.current : 0)
  const chartLabels = lastNDayLabels(TREND[metric].length)

  // Chart canvas: screen minus the page padding and the card's inner padding.
  const chartWidth = screenWidth - PAGE_PAD * 2 - CARD_PAD * 2

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header: identity ─────────────────────────────────────────────── */}
        <Section>
          <View style={styles.headerRow}>
            <Text style={styles.eyebrow}>Who you&rsquo;re becoming</Text>
            <Pressable
              onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <Feather name="settings" size={18} color={day.muted} />
            </Pressable>
          </View>
          <Text style={styles.name}>{firstName}</Text>
          <Text style={styles.identityLine}>
            Building <Text style={styles.identityAccent}>{becoming}</Text>
            {since ? ` since ${since}.` : '.'}
          </Text>

          <View style={styles.starRow}>
            <View style={styles.starLine} />
            <Ionicons name="star" size={11} color={day.gold} style={styles.starIcon} />
            <View style={styles.starLine} />
          </View>
        </Section>

        {hasHistory ? (
          <>
            {/* ── Streak hero ──────────────────────────────────────────────── */}
            <Section delay={90}>
              <View style={styles.streakRow}>
                <View style={styles.streakMain}>
                  <Text style={styles.streakNumber}>{streakValue}</Text>
                  <Text style={styles.streakUnit}>morning{'\n'}streak</Text>
                </View>
                <View style={styles.streakDivider} />
                <View>
                  <Text style={styles.streakBest}>{STREAK.best}</Text>
                  <Text style={styles.streakBestLabel}>your best</Text>
                </View>
              </View>

              <View style={styles.weekRow}>
                {WEEK.map((d, i) => (
                  <View key={`${d.initial}-${i}`} style={styles.weekDay}>
                    <View
                      style={[
                        styles.weekDot,
                        d.status === 'done' && styles.weekDotDone,
                        d.status === 'ahead' && styles.weekDotAhead,
                      ]}
                    >
                      {d.status === 'done' && (
                        <Feather name="check" size={12} color={day.onAccent} />
                      )}
                    </View>
                    <Text style={styles.weekInitial}>{d.initial}</Text>
                  </View>
                ))}
              </View>
            </Section>

            {/* ── Trend chart card ─────────────────────────────────────────── */}
            <Section delay={180}>
              <View style={styles.card}>
                <Text style={styles.cardEyebrow}>The last 14 mornings</Text>

                <View style={styles.pillRow}>
                  {(Object.keys(TREND) as Metric[]).map((m) => (
                    <SpringPill
                      key={m}
                      label={METRIC_LABEL[m]}
                      selected={metric === m}
                      onPress={() => setMetric(m)}
                    />
                  ))}
                </View>

                <View style={styles.chartWrap}>
                  <TrendChart
                    data={TREND[metric]}
                    labels={chartLabels}
                    width={chartWidth}
                    height={150}
                    color={day.gold}
                  />
                </View>

                <View style={styles.chartAxis}>
                  <Text style={styles.chartAxisLabel}>2 weeks ago</Text>
                  <Text style={styles.chartAxisHint}>Press &amp; drag to explore</Text>
                  <Text style={styles.chartAxisLabel}>Today</Text>
                </View>

                <View style={styles.deltaRow}>
                  <Feather name="trending-up" size={14} color={day.positive} />
                  <Text style={styles.deltaText}>{TREND_DELTA[metric]}</Text>
                </View>
              </View>
            </Section>

            {/* ── How you arrive (gap mix) ─────────────────────────────────── */}
            <Section delay={270}>
              <View style={styles.card}>
                <Text style={styles.cardEyebrow}>How you arrive to your days</Text>

                <View style={styles.mixBar}>
                  {GAP_MIX.map((seg, i) => (
                    <View
                      key={seg.key}
                      style={[
                        styles.mixSegment,
                        { flex: seg.pct, backgroundColor: seg.color },
                        i === 0 && styles.mixSegmentFirst,
                        i === GAP_MIX.length - 1 && styles.mixSegmentLast,
                      ]}
                    />
                  ))}
                </View>

                <View style={styles.mixLegend}>
                  {GAP_MIX.map((seg) => (
                    <View key={seg.key} style={styles.mixLegendRow}>
                      <View style={[styles.mixSwatch, { backgroundColor: seg.color }]} />
                      <Text style={styles.mixLabel}>{seg.label}</Text>
                      <Text style={styles.mixPct}>{seg.pct}%</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.mixRead}>
                  Most mornings, you&rsquo;re matched to what your day asks. The work now is
                  turning deficits into alignment.
                </Text>
              </View>
            </Section>

            {/* ── Patterns ─────────────────────────────────────────────────── */}
            <Section delay={360}>
              <Text style={styles.sectionEyebrow}>Patterns we&rsquo;re seeing</Text>
              {PATTERNS.map((p) => (
                <View key={p.title} style={styles.patternCard}>
                  <View style={styles.patternIcon}>
                    <Feather name={p.icon} size={16} color={day.gold} />
                  </View>
                  <View style={styles.patternText}>
                    <Text style={styles.patternTitle}>{p.title}</Text>
                    <Text style={styles.patternBody}>{p.body}</Text>
                  </View>
                </View>
              ))}
            </Section>

            {/* ── Portfolio ────────────────────────────────────────────────── */}
            <Section delay={450}>
              <Text style={styles.sectionEyebrow}>Your mornings so far</Text>
              <View style={styles.statGrid}>
                {PORTFOLIO.map((s) => (
                  <View key={s.label} style={styles.statCell}>
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </Section>
          </>
        ) : (
          <>
            {/* ── Cold start: the story starts now ─────────────────────────── */}
            <Section delay={90}>
              <View style={styles.coldHero}>
                <Text style={styles.coldTitle}>
                  {count === 0 ? 'Your story starts now.' : `Morning ${count} is in the books.`}
                </Text>
                <Text style={styles.coldBody}>
                  {count === 0
                    ? 'Check in tomorrow morning and Wake starts charting who you’re becoming.'
                    : 'Keep going — every check-in sharpens the picture.'}
                </Text>
              </View>
            </Section>

            {/* ── Cold trend card ───────────────────────────────────────────── */}
            <Section delay={180}>
              <View style={styles.card}>
                <Text style={styles.cardEyebrow}>The last 14 mornings</Text>
                <View style={styles.coldChartGhost}>
                  <View style={styles.coldGhostLine} />
                </View>
                <Text style={styles.coldCardCopy}>
                  Your first trend draws itself after {MIN_MORNINGS_FOR_TRENDS} mornings.
                </Text>
                <View style={styles.coldProgressRow}>
                  {Array.from({ length: MIN_MORNINGS_FOR_TRENDS }, (_, i) => (
                    <View
                      key={i}
                      style={[styles.coldProgressDot, i < count && styles.coldProgressDotOn]}
                    />
                  ))}
                  <Text style={styles.coldProgressLabel}>
                    {Math.min(count, MIN_MORNINGS_FOR_TRENDS)} of {MIN_MORNINGS_FOR_TRENDS}
                  </Text>
                </View>
              </View>
            </Section>

            {/* ── Cold gap mix ──────────────────────────────────────────────── */}
            <Section delay={270}>
              <View style={styles.card}>
                <Text style={styles.cardEyebrow}>How you arrive to your days</Text>
                <View style={styles.coldMixBar} />
                <View style={styles.mixLegend}>
                  {GAP_MIX.map((seg) => (
                    <View key={seg.key} style={styles.mixLegendRow}>
                      <View style={[styles.mixSwatch, { backgroundColor: seg.color }]} />
                      <Text style={styles.mixLabel}>{seg.label}</Text>
                      <Text style={styles.mixPctEmpty}>—</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.coldCardCopy}>
                  Once we&rsquo;ve seen a few mornings, you&rsquo;ll see how often you arrive in
                  deficit, aligned, or in surplus.
                </Text>
              </View>
            </Section>

            {/* ── Cold patterns ─────────────────────────────────────────────── */}
            <Section delay={360}>
              <Text style={styles.sectionEyebrow}>Patterns we&rsquo;re seeing</Text>
              <View style={styles.patternCard}>
                <View style={styles.patternIcon}>
                  <Feather name="eye" size={16} color={day.gold} />
                </View>
                <View style={styles.patternText}>
                  <Text style={styles.patternTitle}>Nothing yet — and that&rsquo;s right.</Text>
                  <Text style={styles.patternBody}>
                    Patterns emerge around week two. Every check-in teaches Wake how your
                    mornings actually work.
                  </Text>
                </View>
              </View>
            </Section>
          </>
        )}

        {/* ── Editorial closer ─────────────────────────────────────────────── */}
        <Section delay={hasHistory ? 540 : 450}>
          <View style={styles.quoteBlock}>
            <View style={styles.starRow}>
              <View style={styles.starLine} />
              <Ionicons name="star" size={11} color={day.gold} style={styles.starIcon} />
              <View style={styles.starLine} />
            </View>
            <Text style={styles.quote}>
              The way you wake, repeated,{'\n'}becomes who you are.
            </Text>
          </View>
        </Section>

        {/* ── Settings ─────────────────────────────────────────────────────── */}
        <Section delay={hasHistory ? 630 : 540}>
          <Text style={styles.sectionEyebrow}>Settings</Text>
          <View style={styles.settingsCard}>
            <SettingsRow icon="sliders" title="Morning signals" sub="Intent, time budget, chronotype" />
            <View style={styles.settingsSeparator} />
            <SettingsRow icon="bell" title="Notifications" sub="Wake-up nudge, evening reminder" />
            <View style={styles.settingsSeparator} />
            <SettingsRow icon="user" title="Account" sub={email} />
            <View style={styles.settingsSeparator} />
            <Pressable
              style={styles.settingsRow}
              onPress={async () => {
                if (signingOut) return
                setSigningOut(true)
                await signOut()
                // Normally the root gate unmounts this screen before this runs;
                // resetting covers any path where it doesn't.
                setSigningOut(false)
              }}
              disabled={signingOut}
              accessibilityRole="button"
            >
              <View style={styles.settingsIcon}>
                {signingOut ? (
                  <ActivityIndicator size="small" color={day.negative} />
                ) : (
                  <Feather name="log-out" size={15} color={day.negative} />
                )}
              </View>
              <Text style={styles.signOutLabel}>
                {signingOut ? 'Signing out…' : 'Sign out'}
              </Text>
            </Pressable>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  )
}

// A quiet settings row — icon chip, title + subline, chevron. Not yet wired:
// these become real screens when their features land.
function SettingsRow({
  icon,
  title,
  sub,
}: {
  icon: React.ComponentProps<typeof Feather>['name']
  title: string
  sub: string
}) {
  return (
    <Pressable style={styles.settingsRow} accessibilityRole="button">
      <View style={styles.settingsIcon}>
        <Feather name={icon} size={15} color={day.text} />
      </View>
      <View style={styles.settingsText}>
        <Text style={styles.settingsTitle}>{title}</Text>
        <Text style={styles.settingsSub}>{sub}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={day.border} />
    </Pressable>
  )
}

// Layout constants shared between styles and the chart-width math.
const PAGE_PAD = 28
const CARD_PAD = 20

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: day.background,
  },
  scroll: {
    paddingHorizontal: PAGE_PAD,
    paddingTop: 18,
    paddingBottom: 48,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: day.muted,
  },
  name: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 44,
    color: day.text,
    marginTop: 10,
  },
  identityLine: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: day.muted,
    marginTop: 6,
  },
  identityAccent: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    color: day.gold,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
  },
  starLine: {
    width: 36,
    height: 1,
    backgroundColor: day.gold,
    opacity: 0.5,
  },
  starIcon: {
    marginHorizontal: 10,
  },

  // ── Streak ──────────────────────────────────────────────────────────────────
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
    gap: 24,
  },
  streakMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  streakNumber: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 72,
    lineHeight: 76,
    color: day.text,
    // Keep the layout still while the count-up runs (numerals vary in width).
    minWidth: 86,
    textAlign: 'center',
  },
  streakUnit: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    lineHeight: 20,
    color: day.muted,
  },
  streakDivider: {
    width: StyleSheet.hairlineWidth,
    height: 44,
    backgroundColor: day.border,
  },
  streakBest: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 26,
    color: day.gold,
  },
  streakBestLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 13,
    color: day.muted,
    marginTop: 2,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
    paddingHorizontal: 6,
  },
  weekDay: {
    alignItems: 'center',
    gap: 8,
  },
  weekDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    backgroundColor: day.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDotDone: {
    backgroundColor: day.gold,
    borderColor: day.gold,
  },
  weekDotAhead: {
    borderStyle: 'dashed',
    borderWidth: 1,
  },
  weekInitial: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    color: day.muted,
  },

  // ── Cards (shared) ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: day.surface,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    padding: CARD_PAD,
    marginTop: 28,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  cardEyebrow: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: day.muted,
  },
  sectionEyebrow: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: day.muted,
    marginTop: 36,
  },

  // ── Trend card ──────────────────────────────────────────────────────────────
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    backgroundColor: day.background,
  },
  pillOn: {
    backgroundColor: day.gold,
    borderColor: day.gold,
  },
  pillLabel: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 13,
    color: day.muted,
  },
  pillLabelOn: {
    color: day.onAccent,
  },
  chartWrap: {
    marginTop: 6,
  },
  chartAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  chartAxisLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: day.muted,
  },
  chartAxisHint: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontStyle: 'italic',
    fontSize: 11,
    color: day.border,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: day.border,
  },
  deltaText: {
    flex: 1,
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: day.positive,
  },

  // ── Gap mix card ────────────────────────────────────────────────────────────
  mixBar: {
    flexDirection: 'row',
    height: 14,
    marginTop: 20,
    gap: 3,
  },
  mixSegment: {
    height: '100%',
    borderRadius: 3,
  },
  mixSegmentFirst: {
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 7,
  },
  mixSegmentLast: {
    borderTopRightRadius: 7,
    borderBottomRightRadius: 7,
  },
  mixLegend: {
    marginTop: 18,
    gap: 10,
  },
  mixLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mixSwatch: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  mixLabel: {
    flex: 1,
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    color: day.text,
  },
  mixPct: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 14,
    color: day.text,
  },
  mixPctEmpty: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 14,
    color: day.border,
  },
  mixRead: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: day.muted,
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: day.border,
  },

  // ── Cold start ──────────────────────────────────────────────────────────────
  coldHero: {
    alignItems: 'center',
    marginTop: 30,
  },
  coldTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 26,
    lineHeight: 34,
    color: day.text,
    textAlign: 'center',
  },
  coldBody: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    lineHeight: 23,
    color: day.muted,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 300,
  },
  coldChartGhost: {
    height: 110,
    justifyContent: 'center',
    marginTop: 16,
  },
  coldGhostLine: {
    height: 0,
    borderTopWidth: 1.5,
    borderColor: day.border,
    borderStyle: 'dashed',
  },
  coldCardCopy: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: day.muted,
    marginTop: 4,
  },
  coldProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  coldProgressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: day.border,
    backgroundColor: day.background,
  },
  coldProgressDotOn: {
    backgroundColor: day.gold,
    borderColor: day.gold,
  },
  coldProgressLabel: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 13,
    color: day.muted,
    marginLeft: 4,
  },
  coldMixBar: {
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: day.border,
    borderStyle: 'dashed',
    marginTop: 20,
  },

  // ── Pattern cards ───────────────────────────────────────────────────────────
  patternCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: day.surface,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    padding: 18,
    marginTop: 14,
  },
  patternIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: day.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patternText: {
    flex: 1,
  },
  patternTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: day.text,
  },
  patternBody: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: day.muted,
    marginTop: 5,
  },

  // ── Stat grid ───────────────────────────────────────────────────────────────
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    gap: 12,
  },
  statCell: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: day.surface,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    paddingVertical: 22,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 30,
    color: day.text,
  },
  statLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 13,
    color: day.muted,
    marginTop: 4,
  },

  // ── Quote ───────────────────────────────────────────────────────────────────
  quoteBlock: {
    marginTop: 40,
    alignItems: 'center',
  },
  quote: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontStyle: 'italic',
    fontSize: 19,
    lineHeight: 28,
    color: day.text,
    textAlign: 'center',
    marginTop: 22,
  },

  // ── Settings ────────────────────────────────────────────────────────────────
  settingsCard: {
    backgroundColor: day.surface,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    marginTop: 14,
    paddingHorizontal: 18,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 14,
  },
  settingsSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: day.border,
    marginLeft: 46,
  },
  settingsIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: day.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsText: {
    flex: 1,
  },
  settingsTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 15,
    color: day.text,
  },
  settingsSub: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12.5,
    color: day.muted,
    marginTop: 2,
  },
  signOutLabel: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 15,
    color: day.negative,
  },
})
