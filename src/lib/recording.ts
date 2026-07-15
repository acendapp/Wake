// ⚠️⚠️ TEMPORARY — MARKETING FOOTAGE ONLY. MUST be false to ship. ⚠️⚠️
//
// When RECORDING is true, the app displays a fixed, polished morning (name
// "Sarah", a journaling focal point + insight, an armed Aurora alarm at 6:30, a
// 14-morning streak, populated "Where You Stand") regardless of the real account
// or data — so screen recordings are consistent and look intentional. It overrides
// DISPLAY only; it does not write anything. Search for `RECORDING` to find every
// override (TodayHome, routine, wake, index). Flip back to false before any build.
export const RECORDING = false

// The hardcoded values shown while RECORDING. One place so the footage stays
// consistent across every screen.
export const REC = {
  name: 'James',
  greetingWord: 'Good morning',
  wakeTimeLabel: '6:30 AM',
  wakeVoiceName: 'Aurora',
  streak: 14,
  lastNight: 'Rested',
  demand: '6/10',
  routineTime: '10 min',
  focalTitle: 'Write a page in your journal',
  focalExample: 'A few lines on how you slept, and one thing you want from today.',
  insight: 'On mornings you journal first, your focus runs 3 points higher.',
} as const
