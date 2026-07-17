import { Platform } from 'react-native'

// Local morning + evening reminders — the reliable daily CUE that brings users
// back. Unlike the AlarmKit voice alarm (iOS 26.1+ only), these local
// notifications fire on any dev/production build:
//   • Morning — a gentle nudge at the wake time to open the app and set the day.
//   • Evening — a prompt to set up tomorrow, which drives the reflection and the
//     next-morning plan pre-generation.
// Everything is best-effort and no-ops on failure so a permissions hiccup never
// blocks the ritual. isValidTime mirrors the "HH:MM" 24h check used for the alarm.
//
// LAZY + GUARDED, like billing.ts: expo-notifications is a native module absent
// from Expo Go and from any build made before it was added. We require it behind a
// try/catch and no-op when it's missing, so importing this file never crashes the
// app — it just means no reminders until a build that includes the module.

type NotificationsModule = typeof import('expo-notifications')

let cached: NotificationsModule | null | undefined
/** The native module if present in this binary, else null (cached). */
function getNotifications(): NotificationsModule | null {
  if (cached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('expo-notifications') as NotificationsModule
      // Show the banner even when a reminder arrives while foregrounded. Done once,
      // here, so it's only set when the native module actually exists.
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      })
      cached = mod
    } catch {
      cached = null
    }
  }
  return cached
}

const EVENING_HOUR = 20 // 8pm — a calm time to prompt "set up tomorrow"
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** Ask for notification permission (no-op re-prompt if already decided). Returns
 *  whether reminders can be scheduled. */
export async function requestNotificationPermission(): Promise<boolean> {
  const N = getNotifications()
  if (Platform.OS === 'web' || !N) return false
  try {
    const current = await N.getPermissionsAsync()
    if (current.status === 'granted') return true
    const asked = await N.requestPermissionsAsync()
    return asked.status === 'granted'
  } catch {
    return false
  }
}

async function granted(N: NotificationsModule): Promise<boolean> {
  try {
    const { status } = await N.getPermissionsAsync()
    return status === 'granted'
  } catch {
    return false
  }
}

type SyncInput = {
  wakeEnabled: boolean
  wakeTime: string | null // "HH:MM"
  firstName?: string | null
}

/**
 * Re-arm the daily reminders — a morning nudge at the wake time (only when the
 * alarm is on with a valid time) and an evening "set up tomorrow" reminder. Clears
 * the previous schedule first so it's idempotent; safe to call on every launch and
 * settings save. No-op without the native module or permission.
 */
export async function syncReminders({ wakeEnabled, wakeTime, firstName }: SyncInput): Promise<void> {
  const N = getNotifications()
  if (Platform.OS === 'web' || !N) return
  try {
    if (!(await granted(N))) return
    await N.cancelAllScheduledNotificationsAsync()

    const name = firstName?.trim()
    if (wakeEnabled && wakeTime && TIME_RE.test(wakeTime)) {
      const [hour, minute] = wakeTime.split(':').map(Number)
      await N.scheduleNotificationAsync({
        content: {
          title: name ? `Good morning, ${name}` : 'Good morning',
          body: 'Thirty seconds to set your day. Open Wake when you’re ready.',
        },
        trigger: { type: N.SchedulableTriggerInputTypes.DAILY, hour, minute },
      })
    }

    await N.scheduleNotificationAsync({
      content: {
        title: 'Set up tomorrow',
        body: 'A calmer morning starts tonight — take a moment to reflect on today.',
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DAILY,
        hour: EVENING_HOUR,
        minute: 0,
      },
    })
  } catch {
    // best-effort — a failed schedule never blocks anything
  }
}

/** Cancel all scheduled reminders (e.g. a settings toggle off). */
export async function clearReminders(): Promise<void> {
  const N = getNotifications()
  if (!N) return
  try {
    await N.cancelAllScheduledNotificationsAsync()
  } catch {
    // best-effort
  }
}
