import { Feather } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Loading } from '@/components/Loading'
import { Scale } from '@/components/reflect/Scale'
import { TodayHome } from '@/components/today/TodayHome'
import { classifyState } from '@/engine/generatePlan'
import type { ReadinessState } from '@/engine/types'
import { resolveMorningPlan } from '@/lib/routine'
import {
  addDays,
  completedDayCount,
  getDay,
  logicalDate,
  saveMorning,
  type DayRow,
} from '@/lib/days'
import { errorMessage } from '@/lib/errors'
import { useProfile } from '@/lib/profile'
import { isEveningNow, logicalNow } from '@/lib/time'
import { getWeather, type Weather } from '@/lib/weather'

// The Today tab. The populated home (greeting card, Focal Point, The Gap, full
// sequence) lives in the shared TodayHome component — this file owns the data
// loading and the day's other states: loading, error, first-run welcome, the
// evening pivot, the morning check-in, and the reflection-done close-out.
//
// Visual direction: calm, elite, editorial, warm — a high-end wellness brand,
// not a tech app.
const COLORS = {
  background: '#FAF8F4', // soft warm cream, set on the screen + root layout
  charcoal: '#2A2A2A', // the "Wake" wordmark
  tagline: '#8A7B6A', // muted warm brown/gray
  gold: '#8A6D2F', // deep antique gold — the greeting
  negative: '#B23B3B', // muted red — error text
}

// Subtle top→bottom sheen for the gold buttons (matches TodayHome's START pill).
const GOLD_GRADIENT = ['#A87F4A', '#8C6736'] as const

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

export default function Index() {
  const router = useRouter()
  const { profile } = useProfile()

  // Today's row (+ yesterday, for the "last night" read), reloaded whenever the
  // tab regains focus so a fresh reflection or check-in shows immediately.
  const [loading, setLoading] = useState(true)
  const [today, setToday] = useState<DayRow | null>(null)
  const [yesterday, setYesterday] = useState<DayRow | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Live local weather (best-effort; null hides the block). Cached in the lib,
  // so the focus-reload below is effectively free between refreshes.
  const [weather, setWeather] = useState<Weather | null>(null)

  // Whether the user has ever logged a day (a check-in or a reflection). False →
  // brand-new account → Today opens on the first-run welcome instead of a
  // check-in they can't meaningfully use yet. Defaults true so returning users
  // never see the welcome flash while the count loads.
  const [hasHistory, setHasHistory] = useState(true)

  // Morning check-in inputs (used only until checked in). `forceCheckIn` lets the
  // evening "log today anyway" link drop into the check-in past the pivot.
  const [readinessInput, setReadinessInput] = useState(6)
  const [demandInput, setDemandInput] = useState(5)
  const [forceCheckIn, setForceCheckIn] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoadError(null)
    // Weather rides along with every (re)load but never blocks it.
    void getWeather().then(setWeather)
    try {
      const date = logicalDate()
      const [t, y, count] = await Promise.all([
        getDay(date),
        getDay(addDays(date, -1)),
        completedDayCount(),
      ])
      setToday(t)
      setYesterday(y)
      setHasHistory(count > 0)
    } catch (e) {
      setLoadError(errorMessage(e, 'Could not load today.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  // The logical "now": until 3am this is still yesterday's date, so the weekday
  // eyebrow and the evening pivot roll over together.
  const now = logicalNow()
  const isEvening = isEveningNow()
  const checkedIn = today?.readiness != null
  const demandKnown = today?.day_difficulty != null
  // Tonight's reflection is done — tomorrow is already set up, so the evening
  // "set up tomorrow" prompt must not reappear when they land back on Today.
  const reflectedToday = today?.evening_completed_at != null

  // First name from the onboarding profile; falls back gracefully for any older
  // account created before names were collected.
  const userName = profile?.first_name?.trim() || 'there'

  const submitCheckIn = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      // Demand comes from last night's reflection if it happened; otherwise the
      // inline demand tap supplies it so the Gap can still render.
      const dayDifficulty = today?.day_difficulty ?? demandInput
      const plan = resolveMorningPlan({
        readiness: readinessInput,
        dayDifficulty,
        routineMinutes: today?.routine_minutes,
        intent: profile?.intent,
        options: today?.plan_options,
      })
      const row = await saveMorning(logicalDate(), { readiness: readinessInput, dayDifficulty, plan })
      setToday(row)
    } catch (e) {
      setSubmitError(errorMessage(e, 'Could not save your check-in.'))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Loading label="Loading today…" />
      </SafeAreaView>
    )
  }

  // ── Load failed: show the real cause + a retry, so it never leaks into the
  // check-in. A common first cause is the schema not being applied yet. ────────
  if (loadError && !today) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.altWrap}>
          <View>
            <Text style={styles.altEyebrow}>Hmm</Text>
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
      </SafeAreaView>
    )
  }

  // ── Reflection done: the day is closed out — confirm it and rest, with a quiet
  // way back in to adjust. Shows whether or not there was a morning check-in, at
  // any hour, and regardless of a pending "log today anyway" tap: finishing the
  // reflection always lands here until the 3am rollover starts the next day. ──
  if (reflectedToday) {
    return (
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
      </View>
    )
  }

  // ── First run: never logged a day. The real loop starts tonight (Reflect sets
  // up tomorrow), so instead of a check-in they can't meaningfully use yet, offer
  // a feel for the mechanism: a sample routine, and the path into Reflect. ──────
  if (!hasHistory && !checkedIn) {
    return (
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
      </View>
    )
  }

  // ── Evening, not checked in: the morning read is stale — pivot to tomorrow,
  // with the check-in demoted to a quiet link for the genuine late riser. ──────
  if (!checkedIn && isEvening && !forceCheckIn) {
    return (
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
      </View>
    )
  }

  // ── Not checked in: the morning one-tap (+ inline demand if Reflect was skipped) ──
  if (!checkedIn) {
    return (
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
      </SafeAreaView>
    )
  }

  // ── Checked in: the populated Today home, from real data ────────────────────
  const row = today as DayRow
  const readiness = row.readiness as number
  const dayDifficulty = row.day_difficulty ?? readiness
  const gapState: ReadinessState = row.state ?? classifyState(readiness, dayDifficulty)

  return (
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
      routineTime={row.routine_minutes != null ? `${row.routine_minutes} min` : '—'}
      onStart={() => router.push('/routine')}
      // Settings gear (same as the You page's) — jumps to You → Settings. The
      // fresh timestamp param makes every tap re-trigger the scroll there.
      onSettings={() =>
        router.push({ pathname: '/you', params: { settings: String(Date.now()) } })
      }
    />
  )
}

const styles = StyleSheet.create({
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
