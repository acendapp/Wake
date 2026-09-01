import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuth } from '@/lib/auth'
import { useEntitlement } from '@/lib/entitlement'
import { isValidEmail } from '@/lib/errors'
import { day } from '@/theme/colors'

// Email + password gate for *returning* users. On success this screen re-checks
// entitlement and routes itself: entitled → tabs, unentitled → paywall. (It can't
// lean on the root gate alone: signing into the account you're ALREADY in doesn't
// change the uid, so no provider re-runs — the press would be a silent no-op, as
// it was for a stranded subscriber sitting on the paywall.) New users don't create
// an account here: "Create an account" drops any lingering session and sends them
// into onboarding, which builds their routine first and creates the account at
// the final step.
export default function SignInScreen() {
  const { signIn, resetPassword, signOut, session } = useAuth()
  const { refresh } = useEntitlement()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  const canSubmit = isValidEmail(email) && password.length >= 6 && !busy

  const submit = async () => {
    setBusy(true)
    setError(null)
    setConfirm(null)
    try {
      const res = await signIn(email.trim(), password)
      if (res.error) {
        setError(res.error)
        return
      }
      // Fresh store check before routing — this is what rescues a user whose
      // entitlement was granted (or fixed) while they were stuck on this screen.
      const entitled = await refresh()
      router.replace(entitled ? '/' : '/paywall')
    } finally {
      // try/finally so an unexpected rejection can't strand the spinner forever.
      setBusy(false)
    }
  }

  // New users go through onboarding first; jump straight to the first question
  // (step 1), past the welcome screen they just came from. replace() so Back
  // doesn't drop them onto a stranded sign-in screen. Arriving from the paywall
  // there's still a live session — drop it first, or the root gate sees
  // "signed in + onboarded + unentitled" and bounces onboarding straight back
  // to the paywall.
  const createAccount = async () => {
    setBusy(true)
    try {
      if (session) await signOut()
      router.replace({ pathname: '/onboarding', params: { start: 'questions' } })
    } finally {
      setBusy(false)
    }
  }

  // Sends a reset link to whatever's in the email field. We require the email
  // first (the password is irrelevant here) and report back inline.
  const forgotPassword = async () => {
    if (email.trim().length < 4) {
      setConfirm(null)
      setError('Enter your email above, then tap “Forgot password.”')
      return
    }
    setBusy(true)
    setError(null)
    setConfirm(null)
    const res = await resetPassword(email.trim())
    if (res.error) setError(res.error)
    else setConfirm('Password reset link sent — check your email.')
    setBusy(false)
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.wrap}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Text style={styles.title}>Wake</Text>
            <Text style={styles.tagline}>Welcome back.</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={day.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={day.muted}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {confirm ? <Text style={styles.confirm}>{confirm}</Text> : null}

            <Pressable
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={submit}
              disabled={!canSubmit}
              accessibilityRole="button"
            >
              {busy ? (
                <View style={styles.busyRow}>
                  <ActivityIndicator color={day.onAccent} />
                  <Text style={styles.buttonLabel}>Signing in…</Text>
                </View>
              ) : (
                <Text style={styles.buttonLabel}>Sign in</Text>
              )}
            </Pressable>

            <Pressable
              onPress={forgotPassword}
              disabled={busy}
              style={styles.forgot}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.forgotLabel}>Forgot password?</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={createAccount}
            disabled={busy}
            style={styles.toggle}
            accessibilityRole="button"
          >
            <Text style={styles.toggleLabel}>New here? Create an account</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: day.background,
  },
  flex: {
    flex: 1,
  },
  wrap: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingVertical: 48,
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 44,
    color: day.text,
  },
  tagline: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 16,
    color: day.muted,
    marginTop: 8,
  },
  form: {
    gap: 14,
  },
  input: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 17,
    color: day.text,
    backgroundColor: day.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  error: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    color: day.negative,
    marginTop: 2,
  },
  confirm: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    color: day.positive,
    marginTop: 2,
  },
  button: {
    backgroundColor: day.gold,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: day.onAccent,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  forgot: {
    alignSelf: 'center',
    paddingVertical: 4,
    marginTop: 2,
  },
  forgotLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    color: day.muted,
    textDecorationLine: 'underline',
  },
  toggle: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  toggleLabel: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 15,
    color: day.muted,
    textDecorationLine: 'underline',
  },
})
