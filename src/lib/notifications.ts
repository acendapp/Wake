import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

// Local morning + evening reminders — the reliable daily CUE that brings users
// back. Unlike the AlarmKit voice alarm (iOS 26.1+ only), these local
// notifications fire on any dev/production build:
//   • Morning — a gentle nudge at the wake time to open the app and set the day.
//   • Evening — a prompt to set up tomorrow, which drives the reflection and the
//     next-morning plan pre-generation.
// Everything is best-effort and no-ops on failure so a permissions hiccup never
// blocks the ritual. isValidTime mirrors the "HH:MM" 24h check used for the alarm.

// Show the banner even when a reminder arrives while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

const EVENING_HOUR = 20 // 8pm — a calm time to prompt "set up tomorrow"
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** Ask for notification permission (no-op re-prompt if already decided). Returns
 *  whether reminders can be scheduled. */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return false
    const current = await Notifications.getPermissionsAsync()
    if (current.status === 'granted') return true
    const asked = await Notifications.requestPermissionsAsync()
    return asked.status === 'granted'
  } catch {
    return false
  }
}

async function granted(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync()
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
 * settings save. No-op without permission.
 */
export async function syncReminders({ wakeEnabled, wakeTime, firstName }: SyncInput): Promise<void> {
  try {
    if (Platform.OS === 'web' || !(await granted())) return
    await Notifications.cancelAllScheduledNotificationsAsync()

    const name = firstName?.trim()
    if (wakeEnabled && wakeTime && TIME_RE.test(wakeTime)) {
      const [hour, minute] = wakeTime.split(':').map(Number)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: name ? `Good morning, ${name}` : 'Good morning',
          body: 'Thirty seconds to set your day. Open Wake when you’re ready.',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
      })
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Set up tomorrow',
        body: 'A calmer morning starts tonight — take a moment to reflect on today.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
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
  try {
    await Notifications.cancelAllScheduledNotificationsAsync()
  } catch {
    // best-effort
  }
}
