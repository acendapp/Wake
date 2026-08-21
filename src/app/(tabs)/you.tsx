import { Feather, Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
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
import { daysForStats, logicalDate } from '@/lib/days'
import { VOICES } from '@/lib/alarmCore'
import { openLegal, PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/lib/legal'
import { useProfile } from '@/lib/profile'
import { openWriteReview } from '@/lib/review'
import {
  computeYouStats,
  METRICS,
  METRIC_LABEL,
  type GapKey,
  type Metric,
  type YouStats,
} from '@/lib/stats'
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

const MIN_MORNINGS_FOR_TRENDS = 3

// Label + color for each gap-mix segment; the stats pipeline supplies the pcts.
const GAP_META: Record<GapKey, { label: string; color: string }> = {
  deficit: { label: 'Restore', color: day.negative },
  aligned: { label: 'Ready', color: day.gold },
  surplus: { label: 'Charged', color: day.positive },
}
const GAP_ORDER: GapKey[] = ['deficit', 'aligned', 'surplus']

// Monday-first weekday names + readable statuses, for the week-strip a11y labels
// (the single 'M'/'T'/… initials are ambiguous to a screen reader).
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const WEEK_STATUS_LABEL: Record<'done' | 'missed' | 'ahead', string> = {
  done: 'checked in',
  missed: 'missed',
  ahead: 'upcoming',
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPORARY — marketing footage only. When PREVIEW_WITH_SAMPLE_DATA is true, the
// You page renders these sample numbers (fully populated streak, trends, graphs)
// instead of the user's real history — the name still comes from the real
// profile. The real pipeline (computeYouStats) stays wired and untouched.
// ⚠️ SET BACK TO false BEFORE SHIPPING.
// ─────────────────────────────────────────────────────────────────────────────
const PREVIEW_WITH_SAMPLE_DATA = false
const SAMPLE_STATS: YouStats = {
  trend: {
    energy: [5.2, 5.8, 5.1, 6.4, 6.0, 5.6, 6.8, 6.2, 7.1, 6.6, 7.4, 7.0, 7.8, 8.2],
    mood: [5.8, 6.2, 5.6, 6.0, 6.6, 7.0, 6.4, 6.8, 7.2, 6.9, 7.0, 7.6, 7.4, 8.0],
    focus: [4.8, 5.2, 5.8, 5.4, 6.2, 5.9, 6.6, 6.1, 6.8, 7.2, 6.9, 7.5, 7.9, 7.6],
  },
  trendLabels: [
    'May 21', 'May 22', 'May 23', 'May 24', 'May 25', 'May 26', 'May 27',
    'May 28', 'May 29', 'May 30', 'May 31', 'Jun 1', 'Jun 2', 'Today',
  ],
  trendDelta: {
    energy: 'Energy is running 12% above the week before.',
    mood: 'Mood is running 8% above the week before.',
    focus: 'Focus is running 15% above the week before.',
  },
  hasTrend: true,
  reflectionCount: 14,
  streak: { current: 12, best: 18 },
  week: [
    { initial: 'M', status: 'done' },
    { initial: 'T', status: 'done' },
    { initial: 'W', status: 'done' },
    { initial: 'T', status: 'done' },
    { initial: 'F', status: 'missed' },
    { initial: 'S', status: 'done' },
    { initial: 'S', status: 'ahead' },
  ],
  gapMix: [
    { key: 'deficit', pct: 23 },
    { key: 'aligned', pct: 58 },
    { key: 'surplus', pct: 19 },
  ],
  gapRead:
    "Most mornings, you're matched to what your day asks. The work now is closing the gap on the mornings you wake behind.",
  portfolio: { morningsBuilt: 34, timeInvested: '7.2h', strongestDay: 'Tue', followThrough: '86%' },
  patterns: [
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
  ],
}

// ── Real-data helpers ────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
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

// ── Motion helpers ───────────────────────────────────────────────────────────

/** Eased count-up for hero numbers (0 → target over `duration` ms). */
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0)
  // Animate from the last shown value, not from 0 — so a stats refresh that nudges
  // the streak (e.g. 12 → 13 after a check-in) ticks smoothly instead of snapping
  // back to 0 and counting up again. First mount starts at 0, so the hero still
  // counts up on open.
  const from = useRef(0)
  useEffect(() => {
    const base = from.current
    let raf: number
    const start = Date.now()
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = Math.round(base + (target - base) * eased)
      setValue(current)
      from.current = current
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
  const router = useRouter()

  const [metric, setMetric] = useState<Metric>('energy')

  // Sign-out in flight — keeps the row from feeling dead while the auth call
  // runs (it can take a moment offline before the local fallback kicks in).
  const [signingOut, setSigningOut] = useState(false)

  // Real stats, computed from the user's `days` history. Refreshed on focus so
  // the page advances as mornings accumulate. `dayCount` (activity days) drives
  // the cold-start gate; null while the first load is in flight.
  const [stats, setStats] = useState<YouStats | null>(null)
  const [dayCount, setDayCount] = useState<number | null>(null)
  const [statsError, setStatsError] = useState(false)

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const loadStats = useCallback(() => {
    setStatsError(false)
    daysForStats()
      .then((rows) => {
        if (!mounted.current) return
        setDayCount(rows.length) // rows are already filtered to activity days
        setStats(computeYouStats(rows, logicalDate()))
      })
      .catch(() => {
        // A failed load is NOT zero history — leaving dayCount/stats as-is keeps any
        // data already on screen and routes a first-load failure to a retry, never
        // to the cold-start "your story starts now" that would misread real history.
        if (!mounted.current) return
        setStatsError(true)
      })
  }, [])

  // Refreshed on focus so the page advances as mornings accumulate.
  useFocusEffect(loadStats)

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
  // PREVIEW swaps in sample stats for marketing footage; real path otherwise.
  const viewStats = PREVIEW_WITH_SAMPLE_DATA ? SAMPLE_STATS : stats
  const hasHistory = PREVIEW_WITH_SAMPLE_DATA || count >= MIN_MORNINGS_FOR_TRENDS
  const loadingStats =
    !PREVIEW_WITH_SAMPLE_DATA && stats === null && dayCount === null && !statsError
  // First-load failure with nothing to show yet → a retry, not a fake cold start.
  const showStatsError = !PREVIEW_WITH_SAMPLE_DATA && statsError && !viewStats

  const firstName = profile?.first_name?.trim() || 'You'
  const becoming = INTENT_PHRASE[profile?.intent ?? ''] ?? 'better mornings'
  const since = memberSince(profile?.created_at)
  const email = session?.user.email ?? '—'

  const streakValue = useCountUp(hasHistory && viewStats ? viewStats.streak.current : 0)

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

        {loadingStats ? (
          <Section delay={90}>
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={day.gold} />
            </View>
          </Section>
        ) : showStatsError ? (
          <Section delay={90}>
            <View style={styles.loadingWrap}>
              <Feather name="cloud-off" size={24} color={day.muted} />
              <Text style={styles.coldBody}>Couldn’t load your stats just now.</Text>
              <Pressable style={styles.retryButton} onPress={loadStats} accessibilityRole="button">
                <Text style={styles.retryLabel}>Try again</Text>
              </Pressable>
            </View>
          </Section>
        ) : hasHistory && viewStats ? (
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
                  <Text style={styles.streakBest}>{viewStats.streak.best}</Text>
                  <Text style={styles.streakBestLabel}>your best</Text>
                </View>
              </View>

              <View style={styles.weekRow}>
                {viewStats.week.map((d, i) => (
                  <View
                    key={`${d.initial}-${i}`}
                    style={styles.weekDay}
                    accessible
                    accessibilityLabel={`${WEEKDAY_NAMES[i]}: ${WEEK_STATUS_LABEL[d.status]}`}
                  >
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
                  {METRICS.map((m) => (
                    <SpringPill
                      key={m}
                      label={METRIC_LABEL[m]}
                      selected={metric === m}
                      onPress={() => setMetric(m)}
                    />
                  ))}
                </View>

                {viewStats.hasTrend ? (
                  <>
                    <View style={styles.chartWrap}>
                      <TrendChart
                        data={viewStats.trend[metric]}
                        labels={viewStats.trendLabels}
                        width={chartWidth}
                        height={150}
                        color={day.gold}
                        seriesLabel={METRIC_LABEL[metric]}
                      />
                    </View>

                    <View style={styles.chartAxis}>
                      <Text style={styles.chartAxisLabel}>{viewStats.trendLabels[0]}</Text>
                      <Text style={styles.chartAxisHint}>Press &amp; drag to explore</Text>
                      <Text style={styles.chartAxisLabel}>Today</Text>
                    </View>

                    {viewStats.trendDelta[metric] ? (
                      <View style={styles.deltaRow}>
                        <Feather name="trending-up" size={14} color={day.positive} />
                        <Text style={styles.deltaText}>{viewStats.trendDelta[metric]}</Text>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.coldCardCopy}>
                    Your trend draws itself as you reflect in the evening —{' '}
                    {viewStats.reflectionCount} logged so far.
                  </Text>
                )}
              </View>
            </Section>

            {/* ── How you arrive (gap mix) ─────────────────────────────────── */}
            <Section delay={270}>
              <View style={styles.card}>
                <Text style={styles.cardEyebrow}>How you arrive to your days</Text>

                {viewStats.gapMix ? (
                  <>
                    <View style={styles.mixBar}>
                      {viewStats.gapMix
                        .filter((seg) => seg.pct > 0)
                        .map((seg, i, arr) => (
                          <View
                            key={seg.key}
                            style={[
                              styles.mixSegment,
                              { flex: seg.pct, backgroundColor: GAP_META[seg.key].color },
                              i === 0 && styles.mixSegmentFirst,
                              i === arr.length - 1 && styles.mixSegmentLast,
                            ]}
                          />
                        ))}
                    </View>

                    <View style={styles.mixLegend}>
                      {viewStats.gapMix.map((seg) => (
                        <View key={seg.key} style={styles.mixLegendRow}>
                          <View
                            style={[styles.mixSwatch, { backgroundColor: GAP_META[seg.key].color }]}
                          />
                          <Text style={styles.mixLabel}>{GAP_META[seg.key].label}</Text>
                          <Text style={styles.mixPct}>{seg.pct}%</Text>
                        </View>
                      ))}
                    </View>

                    {viewStats.gapRead ? <Text style={styles.mixRead}>{viewStats.gapRead}</Text> : null}
                  </>
                ) : (
                  <Text style={styles.coldCardCopy}>
                    Check in on a morning and Wake starts tracking how you arrive —
                    Restore, Ready, or Charged.
                  </Text>
                )}
              </View>
            </Section>

            {/* ── Patterns ─────────────────────────────────────────────────── */}
            <Section delay={360}>
              <Text style={styles.sectionEyebrow}>Patterns we&rsquo;re seeing</Text>
              {viewStats.patterns.length > 0 ? (
                viewStats.patterns.map((p) => (
                  <View key={p.title} style={styles.patternCard}>
                    <View style={styles.patternIcon}>
                      <Feather
                        name={p.icon as React.ComponentProps<typeof Feather>['name']}
                        size={16}
                        color={day.gold}
                      />
                    </View>
                    <View style={styles.patternText}>
                      <Text style={styles.patternTitle}>{p.title}</Text>
                      <Text style={styles.patternBody}>{p.body}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.patternCard}>
                  <View style={styles.patternIcon}>
                    <Feather name="eye" size={16} color={day.gold} />
                  </View>
                  <View style={styles.patternText}>
                    <Text style={styles.patternTitle}>Still taking shape.</Text>
                    <Text style={styles.patternBody}>
                      A few more mornings and Wake will surface what actually moves your
                      energy, mood, and focus.
                    </Text>
                  </View>
                </View>
              )}
            </Section>

            {/* ── Portfolio ────────────────────────────────────────────────── */}
            <Section delay={450}>
              <Text style={styles.sectionEyebrow}>Your mornings so far</Text>
              <View style={styles.statGrid}>
                {[
                  { value: String(viewStats.portfolio.morningsBuilt), label: 'mornings built' },
                  { value: viewStats.portfolio.timeInvested, label: 'invested in you' },
                  { value: viewStats.portfolio.strongestDay, label: 'strongest day' },
                  { value: viewStats.portfolio.followThrough, label: 'follow-through' },
                ].map((s) => (
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
                  {GAP_ORDER.map((key) => (
                    <View key={key} style={styles.mixLegendRow}>
                      <View style={[styles.mixSwatch, { backgroundColor: GAP_META[key].color }]} />
                      <Text style={styles.mixLabel}>{GAP_META[key].label}</Text>
                      <Text style={styles.mixPctEmpty}>—</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.coldCardCopy}>
                  Once we&rsquo;ve seen a few mornings, you&rsquo;ll see how often you arrive
                  Restore, Ready, or Charged.
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
            <SettingsRow
              icon="sliders"
              title="Morning signals"
              sub="Intent, time budget, chronotype"
              onPress={() => router.push('/morning-signals')}
            />
            <View style={styles.settingsSeparator} />
            <SettingsRow
              icon="bell"
              title="Wake alarm"
              sub={formatWakeSummary(profile?.wake_enabled, profile?.wake_time, profile?.wake_voice)}
              onPress={() => router.push('/wake-alarm')}
            />
            <View style={styles.settingsSeparator} />
            <SettingsRow
              icon="user"
              title="Account"
              sub={email}
              onPress={() => router.push('/account')}
            />
            <View style={styles.settingsSeparator} />
            {/* Always-available path to a review, so an enthusiastic user doesn't
                have to wait for the streak-milestone prompt (which iOS also throttles). */}
            <SettingsRow
              icon="star"
              title="Rate Wake"
              sub="Leave a review on the App Store"
              onPress={() => void openWriteReview()}
            />
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

        {/* ── Legal ─────────────────────────────────────────────────────────── */}
        <Section delay={hasHistory ? 720 : 630}>
          <Text style={styles.sectionEyebrow}>Legal</Text>
          <View style={styles.settingsCard}>
            <SettingsRow
              icon="file-text"
              title="Terms of Service"
              sub="The agreement you use Wake under"
              onPress={() => openLegal(TERMS_OF_SERVICE_URL)}
            />
            <View style={styles.settingsSeparator} />
            <SettingsRow
              icon="shield"
              title="Privacy Policy"
              sub="What we collect and how it's used"
              onPress={() => openLegal(PRIVACY_POLICY_URL)}
            />
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  )
}

// The wake-alarm row's subline: "Aurora · 7:00 AM" / "Off", from the stored
// voice id + 24h time.
function formatWakeSummary(enabled?: boolean, time?: string | null, voiceId?: string | null): string {
  if (!enabled || !time) return 'Off'
  const [h, m] = time.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return 'On'
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  const clock = `${h12}:${String(m).padStart(2, '0')} ${period}`
  const voiceName = VOICES.find((v) => v.id === voiceId)?.name
  return voiceName ? `${voiceName} · ${clock}` : clock
}

// A quiet settings row — icon chip, title + subline, chevron. Rows without an
// onPress are still inert (their feature hasn't landed yet).
function SettingsRow({
  icon,
  title,
  sub,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name']
  title: string
  sub: string
  onPress?: () => void
}) {
  // An inert row (no onPress yet) shouldn't read as a tappable button to a
  // screen reader — present it as plain text and drop the chevron affordance.
  const interactive = !!onPress
  return (
    <Pressable
      style={styles.settingsRow}
      onPress={onPress}
      disabled={!interactive}
      accessibilityRole={interactive ? 'button' : 'text'}
    >
      <View style={styles.settingsIcon}>
        <Feather name={icon} size={15} color={day.text} />
      </View>
      <View style={styles.settingsText}>
        <Text style={styles.settingsTitle}>{title}</Text>
        <Text style={styles.settingsSub}>{sub}</Text>
      </View>
      {interactive && <Feather name="chevron-right" size={18} color={day.border} />}
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
    color: day.muted,
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
    color: day.muted,
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
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  retryButton: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderWidth: 1.5,
    borderColor: day.gold,
  },
  retryLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 15,
    color: day.gold,
  },
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
