import { Platform } from 'react-native'

// Local morning + evening reminders — the reliable daily CUE that brings users
// back. Unlike the AlarmKit voice alarm (iOS 26.1+ only), these local
// notifications fire on any dev/production build.
//
// Scheduled as DATED ONE-SHOTS for a short horizon, re-armed on every app open
// (each sync cancels + reschedules). This is what lets the copy VARY per day
// (a single DAILY repeat is frozen — identical copy every day breeds banner-
// blindness within a week), lets the evening reminder be STREAK-AWARE (loss
// aversion is the strongest streak lever), and lets us SKIP tonight's evening
// nudge once the user has already reflected (telling someone to do what they just
// did is the classic un-subscribe trigger).
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

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DEFAULT_MORNING = '07:30' // when the alarm is off, still cue the morning check-in
const HORIZON_DAYS = 7 // days of dated one-shots scheduled ahead, re-armed each open

// Rotating morning bodies — one frozen line trains users to swipe past within a week.
const MORNING_BODIES = [
  'The day hasn’t decided who you are yet. You have.',
  'Before the world starts asking — how are you arriving?',
  'A quiet minute now. The rest of the day compounds from it.',
  'Thirty seconds to meet the morning on your terms.',
  'Ninety seconds to point the day where you want it.',
  'How are you arriving today? One read sets the tone.',
  'Wake to a plan, not a scramble — start here.',
]

// Generic evening bodies (used when there's no live streak to protect).
const EVENING_BODIES = [
  'Tomorrow’s morning is written tonight. Take a minute.',
  'Close today gently, and wake to a plan instead of a scramble.',
  'One reflection now — future-you wakes up grateful.',
  'A calmer morning starts tonight. Take a moment to reflect on today.',
  'Set up tomorrow before you sleep — it’s two quiet minutes.',
]

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
  /** Current streak, so the evening reminder can invoke loss aversion. */
  streak?: number
  /** Whether tonight's reflection is already done — skip tonight's evening nudge. */
  reflectedToday?: boolean
}

function parseHM(hm: string): { hour: number; minute: number } {
  const [hour, minute] = hm.split(':').map(Number)
  return { hour, minute }
}

/** Evening reminder time: ~13.5h after wake so it lands in the user's real wind-down,
 *  clamped to a sane 19:00–22:00 window. Falls back to 20:00 without a valid wake time. */
function eveningHM(wakeTime: string | null): { hour: number; minute: number } {
  if (!wakeTime || !TIME_RE.test(wakeTime)) return { hour: 20, minute: 0 }
  const { hour, minute } = parseHM(wakeTime)
  const mins = Math.min(22 * 60, Math.max(19 * 60, hour * 60 + minute + 13 * 60 + 30))
  return { hour: Math.floor(mins / 60), minute: mins % 60 }
}

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000)
}

/**
 * Re-arm the daily reminders. Scheduled as dated one-shots for the next HORIZON_DAYS
 * (re-armed on every launch/focus), so copy rotates, the evening nudge is streak-aware,
 * and tonight's evening reminder is skipped once the reflection is done. The morning
 * cue fires even when the voice alarm is off (a large segment on pre-iOS-26.1). No-op
 * without the native module or permission.
 */
export async function syncReminders(input: SyncInput): Promise<void> {
  const N = getNotifications()
  if (Platform.OS === 'web' || !N) return
  try {
    if (!(await granted(N))) return
    await N.cancelAllScheduledNotificationsAsync()

    const name = input.firstName?.trim()
    const morningTitle = name ? `Good morning, ${name}` : 'Good morning'
    const morning =
      input.wakeTime && TIME_RE.test(input.wakeTime) ? parseHM(input.wakeTime) : parseHM(DEFAULT_MORNING)
    const evening = eveningHM(input.wakeTime)
    const streak = input.streak ?? 0

    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const doy = dayOfYear(now)
    const DATE = N.SchedulableTriggerInputTypes.DATE

    for (let i = 0; i < HORIZON_DAYS; i++) {
      // ── Morning check-in cue (always, even with the alarm off) ──
      const mDate = new Date(midnight)
      mDate.setDate(mDate.getDate() + i)
      mDate.setHours(morning.hour, morning.minute, 0, 0)
      if (mDate.getTime() > now.getTime()) {
        await N.scheduleNotificationAsync({
          content: { title: morningTitle, body: MORNING_BODIES[(doy + i) % MORNING_BODIES.length] },
          trigger: { type: DATE, date: mDate },
        })
      }

      // ── Evening "set up tomorrow" cue (streak-aware; skip tonight if reflected) ──
      const eDate = new Date(midnight)
      eDate.setDate(eDate.getDate() + i)
      eDate.setHours(evening.hour, evening.minute, 0, 0)
      const skipTonight = i === 0 && input.reflectedToday
      if (eDate.getTime() > now.getTime() && !skipTonight) {
        // Loss aversion for a live streak (the near-term days share today's count);
        // a plain nudge otherwise.
        const useStreak = streak >= 2 && i <= 2
        await N.scheduleNotificationAsync({
          content: useStreak
            ? {
                title: `Your ${streak}-day streak is still alive`,
                body: 'Two minutes tonight keeps it going — set up tomorrow before you sleep.',
              }
            : { title: 'Set up tomorrow', body: EVENING_BODIES[(doy + i) % EVENING_BODIES.length] },
          trigger: { type: DATE, date: eDate },
        })
      }
    }
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
