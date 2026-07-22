import { Feather } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Loading } from '@/components/Loading'
import { Scale } from '@/components/reflect/Scale'
import { StreakCelebration } from '@/components/today/StreakCelebration'
import { TodayHome } from '@/components/today/TodayHome'
import { classifyState } from '@/engine/generatePlan'
import type { ReadinessState } from '@/engine/types'
import { pregeneratePlansFor, resolveMorningPlan } from '@/lib/routine'
import {
  addDays,
  daysForStats,
  getDay,
  logicalDate,
  peekDay,
  saveMorning,
  type DayRow,
} from '@/lib/days'
import { useEntitlement } from '@/lib/entitlement'
import { errorMessage } from '@/lib/errors'
import { hapticImpact, hapticSuccess } from '@/lib/haptics'
import { syncReminders } from '@/lib/notifications'
import { getCelebratedMilestone, setCelebratedMilestone } from '@/lib/prefs'
import { useProfile } from '@/lib/profile'
import { REC, RECORDING } from '@/lib/recording'
import { maybeRequestReview } from '@/lib/review'
import { computeTodayInsight, computeYouStats, milestoneReached } from '@/lib/stats'
import { isEveningNow, logicalNow } from '@/lib/time'
import { cachedWeather, getWeather, type Weather } from '@/lib/weather'
import { day as theme, goldGradient } from '@/theme/colors'

// The Today tab. The populated home (greeting card, Focal Point, The Gap, full
// sequence) lives in the shared TodayHome component — this file owns the data
// loading and the day's other states: loading, error, first-run welcome, the
// evening pivot, the morning check-in, and the reflection-done close-out.
//
// Visual direction: calm, elite, editorial, warm — a high-end wellness brand,
// not a tech app. Colors alias the shared theme (src/theme/colors.ts).
const COLORS = {
  background: theme.background,
  charcoal: theme.text,
  tagline: theme.muted,
  gold: theme.gold,
  negative: theme.negative,
}

const GOLD_GRADIENT = goldGradient

// The valley watercolor (1777x885 landscape) that grounds the evening states. Its
// soft edges already fade to cream, so it sits on the background with no gradient:
// text lives in the clean "sky" up top, the low sun and winding river anchor the
// bottom of the screen. Aspect ratio is fixed so the bottom-anchored image keeps
// its shape on every screen size.
const VALLEY_ASPECT = 1777 / 885

// Long names formatted by hand so the weekday eyebrow doesn't depend on the
// device JS engine's Intl support (Hermes coverage varies).
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// A coarse word for how last night ended, from yesterday's logged energy.
function lastNightWord(energy: number | null | undefined): string {
  if (energy == null) return '—'
  if (energy <= 3) return 'Drained'
  if (energy <= 6) return 'Steady'
  return 'Strong'
}

// The Today screen swaps between several full-screen states (check-in, evening
// pivot, populated home, …). Wrapping each returned tree in this fader makes those
// swaps a soft fade-in instead of an abrupt cut. The distinct `key` per state
// makes it remount (and re-animate) only when the state actually changes.
function wrap(key: string, node: React.ReactNode) {
  return (
    <Animated.View key={key} style={styles.flex} entering={FadeIn.duration(260)}>
      {node}
    </Animated.View>
  )
}

export default function Index() {
  const router = useRouter()
  const { profile } = useProfile()
  const { entitled } = useEntitlement()

  // Today's row (+ yesterday, for the "last night" read), reloaded whenever the
  // tab regains focus so a fresh reflection or check-in shows immediately.
  const [loading, setLoading] = useState(true)
  const [today, setToday] = useState<DayRow | null>(null)
  const [yesterday, setYesterday] = useState<DayRow | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Live local weather (best-effort; null hides the block). Cached in the lib,
  // so the focus-reload below is effectively free between refreshes.
  // Seed from the module cache so the weather paints on the first frame (no
  // pop-in) when it was already fetched this session / app launch.
  const [weather, setWeather] = useState<Weather | null>(cachedWeather)

  // Whether the user has ever logged a day (a check-in or a reflection). False →
  // brand-new account → Today opens on the first-run welcome instead of a
  // check-in they can't meaningfully use yet. Defaults true so returning users
  // never see the welcome flash while the count loads.
  const [hasHistory, setHasHistory] = useState(true)

  // A real one-line insight from history for the Focal Point card; null until
  // there's enough data, where the card shows an honest "patterns forming" line.
  const [insight, setInsight] = useState<string | null>(null)
  const [streak, setStreak] = useState<number | null>(null)
  // A streak milestone to celebrate (e.g. 7), or null. Fires once per milestone.
  const [celebration, setCelebration] = useState<number | null>(null)

  // Morning check-in inputs (used only until checked in). `forceCheckIn` lets the
  // evening "log today anyway" link drop into the check-in past the pivot.
  const [readinessInput, setReadinessInput] = useState(6)
  const [demandInput, setDemandInput] = useState(RECORDING ? 6 : 5)
  const [forceCheckIn, setForceCheckIn] = useState(false)
  // Set by the rested-state "set up my morning anyway" link, to leave the calm
  // rested view and show the check-in for a user who'd tapped "just wake me".
  const [startRoutineAnyway, setStartRoutineAnyway] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Liveness guards. `mounted` blocks any setState after the screen leaves;
  // `loadGen` makes the newest load() the only one allowed to commit, so two
  // focus-reloads racing can't resolve out of order and clobber fresh data
  // with stale.
  const mounted = useRef(true)
  const loadGen = useRef(0)
  // Dates we've already tried to back-fill plan options for this session, so the
  // safety-net re-arm (below) fires at most once per day even across refocuses —
  // and never loops when a generation attempt fails to write.
  const pregenTried = useRef<Set<string>>(new Set())
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = useCallback(async () => {
    const gen = ++loadGen.current
    const live = () => mounted.current && gen === loadGen.current
    setLoadError(null)
    // Clear the "log today anyway" override on every (re)focus: a user who tapped
    // it, then left without checking in, should return to the evening pivot rather
    // than be stuck on the demoted check-in form for the rest of the session.
    setForceCheckIn(false)
    // NOTE: do NOT reset startRoutineAnyway here. A user who tapped "set up my
    // morning anyway" from the rested state and then tabs away and back should stay
    // in the check-in flow, not get silently bounced to the rested screen.
    // Weather rides along with every (re)load but never blocks it.
    void getWeather().then((w) => {
      if (live()) setWeather(w)
    })
    try {
      const date = logicalDate()
      const [t, y, rows] = await Promise.all([
        getDay(date),
        getDay(addDays(date, -1)),
        daysForStats(),
      ])
      if (!live()) return
      // RECORDING: present a fresh, un-checked-in day on every load so the flow
      // always starts at the check-in and the home never shows a "done" routine —
      // no DB reset needed, and it stays fresh for every take. See recording.ts.
      setToday(
        RECORDING && t
          ? {
              ...t,
              readiness: null,
              day_difficulty: null,
              completed_slugs: [],
              morning_completed_at: null,
              evening_completed_at: null,
              woke_at: null,
            }
          : t,
      )
      setYesterday(y)
      setHasHistory(rows.length > 0) // rows are already filtered to activity days
      setInsight(computeTodayInsight(rows))
      setStreak(computeYouStats(rows, date).streak.current)
      setLoadError(null)

      // Safety net: personalization is pre-generated the evening before, so a
      // missed or failed evening pre-gen (e.g. an outage) leaves today with no
      // Claude options and the morning silently falls back to deterministic. If
      // the check-in isn't done yet and today has no options, build them now in
      // the background, then reload to pick them up. Guarded to once per day per
      // session so it can't loop when generation fails to write.
      const noOptions = !t?.plan_options || Object.keys(t.plan_options).length === 0
      if (!t?.readiness && noOptions && !pregenTried.current.has(date)) {
        pregenTried.current.add(date)
        void pregeneratePlansFor(date).then((wrote) => {
          if (wrote && live()) load()
        })
      }
    } catch (e) {
      if (!live()) return
      setLoadError(errorMessage(e, 'Could not load today.'))
    } finally {
      if (live()) setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      // Paint the freshest known row synchronously before the network refetch, so
      // returning from Reflect (which just wrote evening_completed_at) shows the
      // post-reflection view at once — not a flash of the pre-reflection home.
      const cached = peekDay(logicalDate())
      if (cached !== undefined) setToday(cached)
      load()
    }, [load]),
  )

  // useFocusEffect only fires on navigation focus — it misses the app being
  // foregrounded while Today is already the active tab. Without this, a phone left
  // on Today overnight still shows last night's state (stale date, evening close-
  // out) until you switch tabs. Reload whenever the app returns to the foreground
  // so the morning moment is always current.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load()
    })
    return () => sub.remove()
  }, [load])

  // The celebration is a reward for finishing the morning, so it must never fire on
  // a bare app-open. Gate it on today actually being done — a completed check-in or
  // the "just wake me" path. Without this, a streak that ticks a milestone overnight
  // (e.g. via the grace bridge in computeYouStats) would pop the moment the Today
  // tab loads, before the user has done anything today.
  const morningDoneToday = today?.morning_completed_at != null || today?.woke_at != null

  // Celebrate when the streak crosses a milestone (3, 7, 14, 30…), once each. The
  // last-celebrated value is persisted so it never re-fires; keying on the highest
  // milestone REACHED (not an exact match) means a user who missed the precise day
  // still gets the moment — it just waits until they've completed that morning.
  useEffect(() => {
    if (RECORDING) return // never pop the celebration during marketing footage
    if (streak == null) return
    if (!morningDoneToday) return // only after they've finished the morning
    const reached = milestoneReached(streak)
    if (reached == null) return
    let cancelled = false
    void getCelebratedMilestone().then((celebrated) => {
      if (cancelled || reached <= celebrated) return
      setCelebration(reached)
      hapticSuccess()
      void setCelebratedMilestone(reached)
    })
    return () => {
      cancelled = true
    }
  }, [streak, morningDoneToday])

  // The logical "now": until 3am this is still yesterday's date, so the weekday
  // eyebrow and the evening pivot roll over together.
  const now = logicalNow()
  const isEvening = isEveningNow()
  const checkedIn = today?.readiness != null
  // RECORDING: skip the "what's today asking?" scale so the check-in only asks
  // readiness, then goes straight to the home (demand defaults to 6 to match the
  // hardcoded "6/10" glance). See src/lib/recording.ts.
  const demandKnown = RECORDING ? true : today?.day_difficulty != null
  // Tonight's reflection is done — tomorrow is already set up, so the evening
  // "set up tomorrow" prompt must not reappear when they land back on Today.
  const reflectedToday = today?.evening_completed_at != null
  // No routine today: either the user tapped "Not today, just wake me" on the
  // alarm (woke_at set), OR they pre-committed the alarm-only tier in last night's
  // reflection. Either way, show the calm rested state instead of nagging the
  // check-in — unless they've since asked to set up their morning after all.
  const wokeOnly = today?.woke_at != null && !checkedIn
  // The calm "rested" state is the per-morning "just wake me" path (woke_at) only —
  // there's no standing alarm-only tier any more.
  const restedToday = wokeOnly && !startRoutineAnyway && !isEvening

  // Re-arm the local reminders with the live streak + whether tonight's reflection is
  // done, so the evening nudge invokes loss aversion and never nags after reflecting.
  useEffect(() => {
    void syncReminders({
      wakeEnabled: profile?.wake_enabled ?? false,
      wakeTime: profile?.wake_time ?? null,
      firstName: profile?.first_name,
      streak: streak ?? 0,
      reflectedToday,
    })
  }, [streak, reflectedToday, profile?.wake_enabled, profile?.wake_time, profile?.first_name])

  // First name from the onboarding profile; falls back gracefully for any older
  // account created before names were collected.
  const userName = RECORDING ? REC.name : profile?.first_name?.trim() || 'there'

  const submitCheckIn = async () => {
    hapticImpact()
    setSubmitting(true)
    setSubmitError(null)
    try {
      // Demand comes from last night's reflection if it happened; otherwise the
      // inline demand tap supplies it so the Gap can still render.
      const dayDifficulty = today?.day_difficulty ?? demandInput
      const plan = resolveMorningPlan({
        readiness: readinessInput,
        dayDifficulty,
        intent: profile?.intent,
        options: today?.plan_options,
      })
      const row = await saveMorning(logicalDate(), { readiness: readinessInput, dayDifficulty, plan })
      if (!mounted.current) return
      // RECORDING: saveMorning returns the real row, which may still carry today's
      // old completed steps — strip them so the focal button reads START, not DONE.
      setToday(RECORDING ? { ...row, completed_slugs: [] } : row)
    } catch (e) {
      if (!mounted.current) return
      setSubmitError(errorMessage(e, 'Could not save your check-in.'))
    } finally {
      if (mounted.current) setSubmitting(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return wrap(
      'loading',
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Loading label="Loading today…" />
      </SafeAreaView>,
    )
  }

  // ── Load failed: show the real cause + a retry, so it never leaks into the
  // check-in. A common first cause is the schema not being applied yet. ────────
  if (loadError && !today) {
    return wrap(
      'error',
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.altWrap}>
          <View>
            <Text style={styles.altEyebrow}>A hiccup</Text>
            <Text style={styles.altTitle}>We couldn&rsquo;t load today.</Text>
            <Text style={styles.altBody}>{loadError}</Text>
          </View>
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              setLoading(true)
              load()
            }}
            accessibilityRole="button"
          >
            <Text style={styles.primaryLabel}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>,
    )
  }

  // ── Reflection done: the day is closed out — confirm it and rest, with a quiet
  // way back in to adjust. Shows whether or not there was a morning check-in, at
  // any hour, and regardless of a pending "log today anyway" tap: finishing the
  // reflection always lands here until the 3am rollover starts the next day. ──
  if (reflectedToday) {
    return wrap(
      'reflected',
      <View style={styles.safe}>
        <Image
          source={require('../../../assets/images/valley.jpg')}
          style={styles.eveningArt}
          contentFit="cover"
        />
        <SafeAreaView style={styles.eveningSafe} edges={['top']}>
          <View style={styles.eveningWrap}>
            <View>
              <Feather name="moon" size={22} color={COLORS.gold} />
              <Text style={styles.eveningEyebrow}>All set</Text>
              <Text style={styles.eveningTitle}>Tomorrow&rsquo;s ready, {userName}.</Text>
              <Text style={styles.eveningBody}>
                You&rsquo;ve set up tomorrow morning. Rest up — your routine will be waiting
                when you wake.
              </Text>
            </View>
            <Pressable
              style={styles.eveningQuietLink}
              onPress={() => router.push('/reflect')}
              accessibilityRole="button"
            >
              <Text style={styles.eveningQuietLabel}>Adjust tomorrow</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>,
    )
  }

  // ── First run: never logged a day. The real loop starts tonight (Reflect sets
  // up tomorrow), so instead of a check-in they can't meaningfully use yet, offer
  // a feel for the mechanism: a sample routine, and the path into Reflect. ──────
  if (!hasHistory && !checkedIn) {
    return wrap(
      'firstRun',
      <View style={styles.safe}>
        <Image
          source={require('../../../assets/images/valley.jpg')}
          style={styles.eveningArt}
          contentFit="cover"
        />
        <SafeAreaView style={styles.eveningSafe} edges={['top']}>
          <View style={styles.eveningWrap}>
            <View>
              <Feather name="sunrise" size={22} color={COLORS.gold} />
              <Text style={styles.eveningEyebrow}>Welcome to Wake</Text>
              <Text style={styles.eveningTitle}>
                Your mornings begin tomorrow, {userName}.
              </Text>
              <Text style={styles.eveningBody}>
                Each evening, Reflect sets up the next morning — and you wake to a routine
                built for how you arrive. Until then, here&rsquo;s what one looks like.
              </Text>
            </View>
            <View>
              <Pressable
                style={styles.eveningButton}
                onPress={() =>
                  router.push({ pathname: '/routine', params: { sample: '1' } })
                }
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={GOLD_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.eveningButtonFill}
                >
                  <Text style={styles.eveningButtonLabel}>View a sample routine</Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                style={styles.welcomeSecondaryButton}
                onPress={() => router.push('/reflect')}
                accessibilityRole="button"
              >
                <Text style={styles.welcomeSecondaryLabel}>
                  Set up tomorrow in Reflect
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>,
    )
  }

  // ── Rested: they woke to the alarm and chose "just wake me" — no routine today.
  // A calm acknowledgment (waking counts), with a quiet way into the routine if
  // they change their mind. Yields to the evening pivot after EVENING_HOUR. ─────
  if (restedToday) {
    return wrap(
      'rested',
      <View style={styles.safe}>
        <Image
          source={require('../../../assets/images/valley.jpg')}
          style={styles.eveningArt}
          contentFit="cover"
        />
        <SafeAreaView style={styles.eveningSafe} edges={['top']}>
          <View style={styles.eveningWrap}>
            <View>
              <Feather name="sunrise" size={22} color={COLORS.gold} />
              <Text style={styles.eveningEyebrow}>{WEEKDAYS[now.getDay()]} morning</Text>
              <Text style={styles.eveningTitle}>You&rsquo;re up, {userName}.</Text>
              <Text style={styles.eveningBody}>
                No routine today, and that&rsquo;s just fine. Waking well is the habit —
                you kept it. Come back tonight to set up tomorrow.
              </Text>
            </View>
            <View>
              <Pressable
                style={styles.eveningButton}
                onPress={() => setStartRoutineAnyway(true)}
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={GOLD_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.eveningButtonFill}
                >
                  <Text style={styles.eveningButtonLabel}>Set up my morning anyway</Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                style={styles.eveningQuietLink}
                onPress={() => router.push('/reflect')}
                accessibilityRole="button"
              >
                <Text style={styles.eveningQuietLabel}>Jump ahead to tonight</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>,
    )
  }

  // ── Evening, not checked in: the morning read is stale — pivot to tomorrow,
  // with the check-in demoted to a quiet link for the genuine late riser. ──────
  if (!checkedIn && isEvening && !forceCheckIn) {
    return wrap(
      'eveningPivot',
      <View style={styles.safe}>
        <Image
          source={require('../../../assets/images/valley.jpg')}
          style={styles.eveningArt}
          contentFit="cover"
        />
        <SafeAreaView style={styles.eveningSafe} edges={['top']}>
          <View style={styles.eveningWrap}>
            <View>
              <Feather name="moon" size={22} color={COLORS.gold} />
              <Text style={styles.eveningEyebrow}>{WEEKDAYS[now.getDay()]} evening</Text>
              <Text style={styles.eveningTitle}>
                Today&rsquo;s mostly behind you, {userName}.
              </Text>
              <Text style={styles.eveningBody}>
                No morning check-in today — that&rsquo;s alright. The best move now is to set
                up tomorrow.
              </Text>
            </View>
            <View>
              <Pressable
                style={styles.eveningButton}
                onPress={() => router.push('/reflect')}
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={GOLD_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.eveningButtonFill}
                >
                  <Text style={styles.eveningButtonLabel}>Set up tomorrow</Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                style={styles.eveningQuietLink}
                onPress={() => setForceCheckIn(true)}
                accessibilityRole="button"
              >
                <Text style={styles.eveningQuietLabel}>Still want to log today?</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>,
    )
  }

  // ── Not checked in: the morning one-tap (+ inline demand if Reflect was skipped) ──
  if (!checkedIn) {
    return wrap(
      'checkIn',
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.altWrap}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Text style={styles.altEyebrow}>{isEvening ? 'Logging today' : 'Good morning'}</Text>
            <Text style={styles.altTitle}>
              {isEvening ? 'Where are you, right now?' : `How are you arriving, ${userName}?`}
            </Text>
            {!demandKnown ? (
              <Text style={styles.altBody}>A couple of quick reads to set today&rsquo;s gap.</Text>
            ) : null}
          </View>

          <View style={styles.checkInScales}>
            <Scale
              label="How ready are you?"
              value={readinessInput}
              onChange={setReadinessInput}
              lowLabel="running on empty"
              highLabel="fully charged"
            />
            {!demandKnown ? (
              <Scale
                label="What's today asking?"
                value={demandInput}
                onChange={setDemandInput}
                lowLabel="open & restful"
                highLabel="demanding"
              />
            ) : null}
            {submitError ? <Text style={styles.altError}>{submitError}</Text> : null}
          </View>

          <Pressable
            style={[styles.primaryButton, submitting && styles.buttonDisabled]}
            onPress={submitCheckIn}
            disabled={submitting}
            accessibilityRole="button"
          >
            {submitting ? (
              <View style={styles.busyRow}>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.primaryLabel}>Reading your day…</Text>
              </View>
            ) : (
              <Text style={styles.primaryLabel}>See where you stand</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>,
    )
  }

  // ── Checked in: the populated Today home, from real data ────────────────────
  const row = today as DayRow
  const readiness = row.readiness as number
  const dayDifficulty = row.day_difficulty ?? readiness
  const gapState: ReadinessState = row.state ?? classifyState(readiness, dayDifficulty)

  return wrap(
    'home',
    <>
    <TodayHome
      userName={userName}
      weather={weather}
      readiness={readiness}
      dayDifficulty={dayDifficulty}
      gapState={gapState}
      plan={row.plan}
      // Live progress from the /routine screen (refreshed by the focus-reload).
      completedSlugs={row.completed_slugs ?? []}
      lastNight={lastNightWord(yesterday?.energy)}
      insight={insight}
      streak={streak}
      // A failed focus-reload (stale data still showing) surfaces here, tap to retry.
      notice={loadError ? 'Couldn’t refresh just now.' : null}
      onNoticePress={() => load()}
      onStart={() => router.push('/routine')}
      // Settings gear (same as the You page's) — jumps to You → Settings. The
      // fresh timestamp param makes every tap re-trigger the scroll there.
      onSettings={() =>
        router.push({ pathname: '/you', params: { settings: String(Date.now()) } })
      }
      // The voice alarm, surfaced in the daily loop — tap to manage.
      wakeEnabled={profile?.wake_enabled ?? false}
      wakeTime={profile?.wake_time ?? null}
      wakeVoiceId={profile?.wake_voice ?? null}
      onWakePress={() => router.push('/wake-alarm')}
    />
    {celebration != null && (
      <StreakCelebration
        milestone={celebration}
        onDismiss={() => {
          const reached = celebration
          setCelebration(null)
          // A paid user who just celebrated a 7+ day streak is at a genuine high
          // point — a great, non-annoying moment to ask for an App Store review.
          if (reached != null && reached >= 7) void maybeRequestReview(entitled)
        }}
      />
    )}
    </>,
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Pre-check-in states (loading / evening pivot / morning check-in) ────────
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  altWrap: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 28,
    justifyContent: 'space-between',
  },
  altEyebrow: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.tagline,
  },
  altTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 30,
    lineHeight: 38,
    color: COLORS.charcoal,
    marginTop: 10,
  },
  altBody: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.tagline,
    marginTop: 14,
  },
  altError: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    color: COLORS.negative,
    marginTop: 8,
  },
  checkInScales: {
    marginVertical: 28,
  },
  primaryButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  primaryLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.4,
  },

  // ── Evening states (the valley watercolor grounding the bottom of the screen) ──
  // Bottom-anchored at 140% width so it has presence without full-bleed cropping
  // (it's a 2:1 landscape — cover would throw away most of it and upscale ~3x).
  // Slightly overhung on the left/bottom so its soft vignette edges stay offscreen.
  eveningArt: {
    position: 'absolute',
    bottom: -10,
    left: '-20%',
    width: '140%',
    aspectRatio: VALLEY_ASPECT,
  },
  eveningSafe: {
    flex: 1,
  },
  eveningWrap: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 28,
    justifyContent: 'space-between',
  },
  eveningEyebrow: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.tagline,
    marginTop: 16,
  },
  eveningTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 34,
    lineHeight: 42,
    color: COLORS.charcoal,
    marginTop: 10,
  },
  eveningBody: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.tagline,
    marginTop: 22,
  },
  eveningButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  eveningButtonFill: {
    paddingVertical: 17,
    alignItems: 'center',
  },
  eveningButtonLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  // First-run secondary button: a real button (not a quiet link) per the design —
  // bordered gold on the cream/watercolor, sitting under the gradient primary.
  welcomeSecondaryButton: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(250, 248, 244, 0.65)', // keeps the label crisp over the art
  },
  welcomeSecondaryLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: COLORS.gold,
  },
  // Quiet links sit over the light watercolor (the river bend) — black so they
  // read clearly against it, underlined so they stay quieter than the gold button.
  eveningQuietLink: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  eveningQuietLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    color: '#000000',
    textDecorationLine: 'underline',
  },
})
