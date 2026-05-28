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
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <RootNavigator fontsReady={loaded || !!error} />
      </SafeAreaProvider>
    </AuthProvider>
  )
}

// Gates routes on the session: signed-out users are pushed to the auth group,
// signed-in users are kept out of it. Holds the splash until both fonts and the
// first session check are ready.
function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { session, initializing } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const ready = fontsReady && !initializing

  useEffect(() => {
    if (ready) SplashScreen.hideAsync()
  }, [ready])

  useEffect(() => {
    if (!ready) return
    const inAuthGroup = segments[0] === '(auth)'
    if (!session && !inAuthGroup) {
      router.replace('/sign-in')
    } else if (session && inAuthGroup) {
      router.replace('/')
    }
  }, [ready, session, segments, router])

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
