import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  useFonts,
} from '@expo-google-fonts/playfair-display'
import { Asset } from 'expo-asset'
import { Image as ExpoImage } from 'expo-image'
import { Stack, usePathname, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef, useState } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { LaunchAnimation } from '@/components/LaunchAnimation'
import { applyWakeAlarm, DEFAULT_VOICE } from '@/lib/alarm'
import { AuthProvider, useAuth } from '@/lib/auth'
import { EntitlementProvider, useEntitlement } from '@/lib/entitlement'
import { syncReminders } from '@/lib/notifications'
import { ProfileProvider, useProfile } from '@/lib/profile'
import { getWeather } from '@/lib/weather'
import { day } from '@/theme/colors'

// Images shown on the core screens — prefetched at launch so they're decoded and
// cached before any screen renders them (no late pop-in, e.g. the WHERE YOU STAND
// watercolor when arriving on Today after the check-in).
const PRELOAD_IMAGES = [
  require('../../assets/images/valley.jpg'),
  require('../../assets/images/welcome-bg.jpg'),
]

// Warm pale cream that fills the whole app.
const BACKGROUND = day.background

// Keep the native splash up until our fonts are ready, so the serif title
// never flashes in a fallback face. Called in global scope per Expo's docs.
SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  })

  // Warm the image + weather caches once at launch so the Today home paints them
  // on first frame instead of popping in a beat late.
  useEffect(() => {
    ExpoImage.prefetch(PRELOAD_IMAGES.map((m) => Asset.fromModule(m).uri)).catch(() => {})
    void getWeather()
  }, [])

  return (
    <AuthProvider>
      <ProfileProvider>
        <EntitlementProvider>
          <SafeAreaProvider>
            <StatusBar style="dark" />
            <RootNavigator fontsReady={loaded || !!error} />
          </SafeAreaProvider>
        </EntitlementProvider>
      </ProfileProvider>
    </AuthProvider>
  )
}

// Gates routes on session + profile + entitlement. The first-run journey runs
// front to back: a signed-out visitor starts in the onboarding/welcome flow;
// once they've created an account and finished onboarding they hit the paywall;
// only an entitled, onboarded user reaches the tabs. /sign-in stays reachable
// from the welcome screen for returning users. Holds the splash until fonts, the
// first session check, and (when signed in) the profile + entitlement have all
// resolved, so there's no flash of the wrong screen.
function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { session, initializing } = useAuth()
  const { profile, loading: profileLoading } = useProfile()
  const { entitled, loading: entitlementLoading } = useEntitlement()
  // usePathname returns the clean, group-stripped path ('/sign-in', '/onboarding',
  // '/paywall', '/'), so the gate can match exact screens without depending on
  // whether useSegments surfaces the route-group parens — which it doesn't for
  // /sign-in, and which silently bounced signed-out users out of the auth screen.
  const pathname = usePathname()
  const router = useRouter()
  const ready = fontsReady && !initializing && !profileLoading && !entitlementLoading

  // Latch the first time everything resolves. After the initial load we keep the
  // Stack mounted even while the providers briefly reload — e.g. creating an
  // account mid-onboarding flips the session, which makes profile/entitlement
  // `loading` derive true for a beat. Returning null there would tear down the
  // onboarding screen and lose its in-progress step, snapping the user back to
  // the welcome screen. Routing still waits on `ready` below, so the gate simply
  // holds until the reload settles, then redirects (a new account → /paywall).
  const everReady = useRef(false)
  if (ready) everReady.current = true
  // The app-open animation plays once per cold launch, over the app, then dissolves.
  const [launchDone, setLaunchDone] = useState(false)

  useEffect(() => {
    if (ready) SplashScreen.hideAsync()
  }, [ready])

  // Re-arm the wake alarm on every launch when it's enabled. A repeating AlarmKit
  // alarm keeps the single soundName it was scheduled with, so re-arming here is
  // what advances the daily clip rotation. No-op on Tier 0 (Expo Go / non-26.1),
  // where the stored preference simply waits for a capable build.
  useEffect(() => {
    if (!profile?.wake_enabled || !profile.wake_time) return
    void applyWakeAlarm({
      enabled: true,
      time: profile.wake_time,
      voice: profile.wake_voice ?? DEFAULT_VOICE,
    }).catch(() => {})
  }, [profile?.wake_enabled, profile?.wake_time, profile?.wake_voice])

  // Keep the daily reminders (morning nudge + evening "set up tomorrow") in sync on
  // every launch. No-op without notification permission; the evening reminder
  // schedules even when the alarm is off.
  useEffect(() => {
    void syncReminders({
      wakeEnabled: profile?.wake_enabled ?? false,
      wakeTime: profile?.wake_time ?? null,
      firstName: profile?.first_name,
    })
  }, [profile?.wake_enabled, profile?.wake_time, profile?.first_name])

  useEffect(() => {
    if (!ready) return
    const onSignIn = pathname === '/sign-in'
    const onOnboarding = pathname === '/onboarding'
    const onPaywall = pathname === '/paywall'
    // The routine screen doubles as the paywall's "view a sample routine" demo
    // (?sample=1), so it stays reachable pre-purchase. A non-sample visit shows
    // only the "no routine yet" empty state — nothing to leak.
    const onRoutine = pathname === '/routine'

    // Signed out: the only allowed screens are the onboarding/welcome flow and
    // the sign-in screen (reachable from the welcome screen's "Sign in" link).
    // Anything else (a protected tab, the paywall) bounces back to onboarding.
    if (!session) {
      if (!onOnboarding && !onSignIn) router.replace('/onboarding')
      return
    }
    const onboarded = !!profile?.onboarding_completed_at
    if (!onboarded) {
      // Signed in, but onboarding never finished (or its save failed). Send them
      // straight to the questions — they already have an account; what's missing
      // is the routine setup, and completing it is their path into the app. The
      // marketing welcome beat would read as a dead end here.
      if (!onOnboarding) {
        router.replace({ pathname: '/onboarding', params: { start: 'questions' } })
      }
      return
    }
    if (!entitled) {
      if (!onPaywall && !onRoutine) router.replace('/paywall')
      return
    }
    // Fully set up — keep them out of the pre-app screens.
    if (onSignIn || onOnboarding || onPaywall) router.replace('/')
  }, [ready, session, profile, entitled, pathname, router])

  if (!everReady.current) return null

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: BACKGROUND },
        }}
      />
      {!launchDone && <LaunchAnimation onDone={() => setLaunchDone(true)} />}
    </>
  )
}
