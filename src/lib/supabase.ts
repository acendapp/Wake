import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env and set ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  )
}

// The storage key the session persists under. Pinned to the same value supabase
// derives by default (`sb-<project-ref>-auth-token`) so existing sessions stay
// valid — made explicit so sign-out can force-remove it when supabase's own
// signOut() fails (it keeps the local session whenever server revocation fails).
export const AUTH_STORAGE_KEY = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: AUTH_STORAGE_KEY,
    // AsyncStorage persists the session on native between launches. On web we
    // omit it so supabase uses localStorage in a real browser and falls back to
    // in-memory during static (server-side) web rendering. Passing AsyncStorage
    // on web crashes the web render — it touches `window`, which doesn't exist
    // during SSR ("window is not defined").
    ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection on native (that's a web OAuth concern).
    detectSessionInUrl: false,
  },
})
