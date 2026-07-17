import { useRouter } from 'expo-router'
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

// Reached only via a password-reset link — the root gate routes here while
// `recovery` is true. The recovery session is already live at this point, so we
// just set the new password and hand routing back to the gate.

export default function ResetPasswordScreen() {
  const { updatePassword, cancelRecovery } = useAuth()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = password.length >= 6 && !busy

  const submit = async () => {
    setBusy(true)
    setError(null)
    const res = await updatePassword(password)
    if (res.error) {
      setError(res.error)
      setBusy(false)
      return
    }
    // Password set + recovery cleared — the gate now routes into the app.
    router.replace('/')
  }

  const cancel = async () => {
    // Clearing recovery + the session lets the gate route back to onboarding's
    // first question on its own — no manual navigation (which would race the gate).
    await cancelRecovery()
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.body}>Choose a new password for your account.</Text>

          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="New password"
            placeholderTextColor={day.muted}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            editable={!busy}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              !canSubmit && styles.buttonDisabled,
              pressed && canSubmit && { opacity: 0.88 },
            ]}
            onPress={submit}
            disabled={!canSubmit}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color={day.onAccent} />
            ) : (
              <Text style={styles.buttonLabel}>Save password</Text>
            )}
          </Pressable>

          <Pressable
            onPress={cancel}
            disabled={busy}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: day.background },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 30,
    color: day.text,
    marginBottom: 10,
  },
  body: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 16,
    lineHeight: 24,
    color: day.muted,
    marginBottom: 28,
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
    fontSize: 13.5,
    color: day.negative,
    marginTop: 12,
  },
  button: {
    backgroundColor: day.gold,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
    color: day.onAccent,
  },
  cancel: {
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 6,
  },
  cancelLabel: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 15,
    color: day.muted,
  },
})
