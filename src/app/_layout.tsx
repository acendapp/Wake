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
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <RootNavigator fontsReady={loaded || !!error} />
        </SafeAreaProvider>
      </ProfileProvider>
    </AuthProvider>
  )
}

// Gates routes on session + profile: signed-out users go to the auth group;
// signed-in users who haven't finished onboarding go to /onboarding; everyone
// else lands in the tabs. Holds the splash until fonts, the first session check,
// and (when signed in) the profile have all resolved, so there's no flash of the
// wrong screen.
function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { session, initializing } = useAuth()
  const { profile, loading: profileLoading } = useProfile()
  const segments = useSegments()
  const router = useRouter()
  const ready = fontsReady && !initializing && !profileLoading

  useEffect(() => {
    if (ready) SplashScreen.hideAsync()
  }, [ready])

  useEffect(() => {
    if (!ready) return
    const inAuthGroup = segments[0] === '(auth)'
    const inOnboarding = segments[0] === 'onboarding'
    if (!session) {
      if (!inAuthGroup) router.replace('/sign-in')
      return
    }
    const onboarded = !!profile?.onboarding_completed_at
    if (!onboarded) {
      if (!inOnboarding) router.replace('/onboarding')
    } else if (inAuthGroup || inOnboarding) {
      router.replace('/')
    }
  }, [ready, session, profile, segments, router])

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
