import { Feather } from '@expo/vector-icons'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuth } from '@/lib/auth'
import { day } from '@/theme/colors'

// The Account screen, opened from the You page's "Account" row. Surfaces the
// signed-in email and the account actions a paying user needs: change password
// (via a reset email), manage/cancel the subscription (which lives in Apple ID
// settings, not in the app), and — required by App Store Guideline 5.1.1(v) —
// permanent account deletion.

// Apple's subscription-management page. On iOS this opens the App Store straight
// to the user's subscription list, where Wake can be cancelled. An auto-renewable
// subscription can ONLY be cancelled there — not by the app, and not by deleting
// the account — so this is the one link that saves a user from being billed after
// they thought they'd left.
const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions'

export default function AccountScreen() {
  const router = useRouter()
  const { session, resetPassword, deleteAccount } = useAuth()
  const email = session?.user.email ?? '—'

  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const close = () => router.back()

  const onChangePassword = async () => {
    if (busy || !session?.user.email) return
    setBusy(true)
    setNotice(null)
    setError(null)
    const res = await resetPassword(session.user.email)
    if (!mounted.current) return
    if (res.error) setError(res.error)
    else setNotice('Password reset link sent — check your email.')
    setBusy(false)
  }

  const runDelete = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    const res = await deleteAccount()
    // On success the session is cleared and the root gate navigates away — this
    // screen unmounts, so only handle the failure case.
    if (res.error && mounted.current) {
      setError(res.error)
      setBusy(false)
    }
  }

  const onManageSubscription = async () => {
    if (busy) return
    setError(null)
    setNotice(null)
    try {
      await Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)
    } catch {
      setError('Couldn’t open the App Store. Go to Settings → your name → Subscriptions.')
    }
  }

  const onDelete = () => {
    if (busy) return
    Alert.alert(
      'Delete your account?',
      'This permanently erases your account, profile, and every reflection. This cannot be undone.\n\nDeleting your account does not cancel a subscription — cancel it in Settings → your name → Subscriptions, or you’ll keep being charged.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: runDelete },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Feather name="x" size={24} color={day.muted} />
        </Pressable>
        <Text style={styles.headerTitle}>Account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.email}>{email}</Text>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={styles.row}
          onPress={onChangePassword}
          disabled={busy}
          accessibilityRole="button"
        >
          <View style={styles.rowIcon}>
            <Feather name="key" size={15} color={day.text} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Change password</Text>
            <Text style={styles.rowSub}>We’ll email you a reset link</Text>
          </View>
          <Feather name="chevron-right" size={18} color={day.border} />
        </Pressable>

        <Pressable
          style={styles.row}
          onPress={onManageSubscription}
          disabled={busy}
          accessibilityRole="button"
        >
          <View style={styles.rowIcon}>
            <Feather name="credit-card" size={15} color={day.text} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Manage subscription</Text>
            <Text style={styles.rowSub}>Change or cancel in your Apple ID settings</Text>
          </View>
          <Feather name="external-link" size={18} color={day.border} />
        </Pressable>

        <Pressable
          style={styles.row}
          onPress={onDelete}
          disabled={busy}
          accessibilityRole="button"
        >
          <View style={styles.rowIcon}>
            {busy ? (
              <ActivityIndicator size="small" color={day.negative} />
            ) : (
              <Feather name="trash-2" size={15} color={day.negative} />
            )}
          </View>
          <View style={styles.rowText}>
            <Text style={styles.deleteTitle}>Delete account</Text>
            <Text style={styles.rowSub}>Permanently erase your account and data</Text>
          </View>
        </Pressable>

        <Text style={styles.fine}>
          Deleting your account removes your profile and every reflection from Wake. It does
          not cancel your subscription — that’s managed in your Apple ID settings, using the
          link above.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: day.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    color: day.text,
  },
  headerSpacer: {
    width: 24,
  },
  scroll: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 32,
  },
  label: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: day.muted,
  },
  email: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 20,
    color: day.text,
    marginTop: 8,
  },
  notice: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    color: day.positive,
    marginTop: 18,
  },
  error: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 14,
    color: day.negative,
    marginTop: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: day.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 28,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: day.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: day.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 15,
    color: day.text,
  },
  deleteTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 15,
    color: day.negative,
  },
  rowSub: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12.5,
    color: day.muted,
    marginTop: 2,
  },
  fine: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 12.5,
    lineHeight: 18,
    color: day.muted,
    marginTop: 24,
  },
})
