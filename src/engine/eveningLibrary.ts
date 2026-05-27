import type { WindDownStep } from './types'

// The evening mirror of ACTION_LIBRARY: the moves that protect tomorrow's
// readiness. Ordered by `priority` (higher surfaces first and survives shorter
// wind-downs). Shipped as code for the same reasons as the morning library —
// the engine stays pure and easy to iterate on.
export const EVENING_LIBRARY: WindDownStep[] = [
  {
    slug: 'screens-down',
    title: 'Screens off 30 minutes before bed',
    description: 'Late light and the scroll both push sleep onset later. Put it down.',
    estMinutes: 30,
    priority: 100,
  },
  {
    slug: 'dim-lights',
    title: 'Dim the lights for the last hour',
    description: 'Low light cues melatonin and tells your body the day is closing.',
    estMinutes: 60,
    priority: 90,
  },
  {
    slug: 'lay-out-first-move',
    title: "Set out tomorrow's first move",
    description: 'Clothes, shoes, water — remove the friction between waking and starting.',
    estMinutes: 3,
    priority: 80,
  },
  {
    slug: 'slow-breath',
    title: 'Two minutes of slow breathing',
    description: 'A long exhale downshifts the nervous system out of the day.',
    estMinutes: 2,
    priority: 70,
  },
  {
    slug: 'cool-room',
    title: 'Cool the room toward 65°F',
    description: 'A falling core temperature is one of the strongest sleep signals.',
    estMinutes: 1,
    priority: 60,
  },
  {
    slug: 'no-nightcap',
    title: 'Swap the nightcap for water',
    description: 'Alcohol fragments the back half of the night, the most restorative part.',
    estMinutes: 1,
    priority: 50,
  },
]
