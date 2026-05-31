import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  useFonts,
} from '@expo-google-fonts/playfair-display'
import { Stack, usePathname, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AuthProvider, useAuth } from '@/lib/auth'
import { EntitlementProvider, useEntitlement } from '@/lib/entitlement'
import { ProfileProvider, useProfile } from '@/lib/profile'

// Warm pale cream that fills the whole app.
const BACKGROUND = '#FAF8F4'

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

  useEffect(() => {
    if (ready) SplashScreen.hideAsync()
  }, [ready])

  useEffect(() => {
    if (!ready) return
    const onSignIn = pathname === '/sign-in'
    const onOnboarding = pathname === '/onboarding'
    const onPaywall = pathname === '/paywall'

    // Signed out: the only allowed screens are the onboarding/welcome flow and
    // the sign-in screen (reachable from the welcome screen's "Sign in" link).
    // Anything else (a protected tab, the paywall) bounces back to onboarding.
    if (!session) {
      if (!onOnboarding && !onSignIn) router.replace('/onboarding')
      return
    }
    const onboarded = !!profile?.onboarding_completed_at
    if (!onboarded) {
      if (!onOnboarding) router.replace('/onboarding')
      return
    }
    if (!entitled) {
      if (!onPaywall) router.replace('/paywall')
      return
    }
    // Fully set up — keep them out of the pre-app screens.
    if (onSignIn || onOnboarding || onPaywall) router.replace('/')
  }, [ready, session, profile, entitled, pathname, router])

  if (!everReady.current) return null

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: BACKGROUND },
      }}
    />
  )
}
