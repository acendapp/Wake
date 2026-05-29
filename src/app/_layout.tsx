import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  useFonts,
} from '@expo-google-fonts/playfair-display'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
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
  const segments = useSegments()
  const router = useRouter()
  const ready = fontsReady && !initializing && !profileLoading && !entitlementLoading

  useEffect(() => {
    if (ready) SplashScreen.hideAsync()
  }, [ready])

  useEffect(() => {
    if (!ready) return
    const inAuthGroup = segments[0] === '(auth)'
    const inOnboarding = segments[0] === 'onboarding'
    const inPaywall = segments[0] === 'paywall'

    // Signed out: begin in onboarding/welcome. /sign-in is still reachable via
    // the welcome screen's "Sign in" link, so don't bounce out of the auth group.
    if (!session) {
      if (!inAuthGroup && !inOnboarding) router.replace('/onboarding')
      return
    }
    const onboarded = !!profile?.onboarding_completed_at
    if (!onboarded) {
      if (!inOnboarding) router.replace('/onboarding')
      return
    }
    if (!entitled) {
      if (!inPaywall) router.replace('/paywall')
      return
    }
    // Fully set up — keep them out of the pre-app screens.
    if (inAuthGroup || inOnboarding || inPaywall) router.replace('/')
  }, [ready, session, profile, entitled, segments, router])

  if (!ready) return null

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: BACKGROUND },
      }}
    />
  )
}
