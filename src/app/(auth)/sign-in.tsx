import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuth } from '@/lib/auth'
import { day } from '@/theme/colors'

// Email + password gate. On success the auth listener flips the session and the
// root layout redirects into the tabs — so this screen never navigates itself.
export default function SignInScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  const canSubmit = email.trim().length > 3 && password.length >= 6 && !busy

  const submit = async () => {
    setBusy(true)
    setError(null)
    setConfirm(null)
    if (mode === 'in') {
      const res = await signIn(email.trim(), password)
      if (res.error) setError(res.error)
    } else {
      const res = await signUp(email.trim(), password)
      if (res.error) setError(res.error)
      else if (res.needsConfirmation) {
        setConfirm('Check your email to confirm your account, then sign in.')
        setMode('in')
      }
    }
    setBusy(false)
  }

  const toggle = () => {
    setMode((m) => (m === 'in' ? 'up' : 'in'))
    setError(null)
    setConfirm(null)
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.wrap}>
          <View>
            <Text style={styles.title}>Wake</Text>
            <Text style={styles.tagline}>
              {mode === 'in' ? 'Welcome back.' : 'Your best days begin here.'}
            </Text>
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
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              textContentType={mode === 'in' ? 'password' : 'newPassword'}
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
                  <Text style={styles.buttonLabel}>
                    {mode === 'in' ? 'Signing in…' : 'Creating account…'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.buttonLabel}>
                  {mode === 'in' ? 'Sign in' : 'Create account'}
                </Text>
              )}
            </Pressable>
          </View>

          <Pressable onPress={toggle} style={styles.toggle} accessibilityRole="button">
            <Text style={styles.toggleLabel}>
              {mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
            </Text>
          </Pressable>
        </View>
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
    flex: 1,
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
