import type { Action } from './types'

// The V1 action catalogue. Shipped as code (not the DB) so the engine stays
// pure, self-contained, and easy to iterate on. When we want to edit copy
// without an app release, this moves to an `action_library` table.
//
// `states` controls eligibility; `priority` controls ordering within a state.
export const ACTION_LIBRARY: Action[] = [
  // ── Deficit: stabilize and elevate ───────────────────────────────────────
  {
    slug: 'walk-before-first',
    title: 'Take a 6-minute walk before your first commitment',
    description: 'Movement plus morning light is the fastest way to lift a low state.',
    category: 'movement',
    states: ['deficit'],
    estMinutes: 6,
    priority: 100,
  },
  {
    slug: 'morning-light',
    title: 'Get 5 minutes of outdoor light',
    description: 'Anchors your circadian clock and starts a clean cortisol curve.',
    category: 'light',
    states: ['deficit', 'aligned'],
    estMinutes: 5,
    priority: 88,
  },
  {
    slug: 'delay-caffeine',
    title: 'Hold caffeine for 60–90 minutes after waking',
    description: 'Lets your natural cortisol peak first, so you avoid the mid-morning crash.',
    category: 'caffeine',
    states: ['deficit'],
    estMinutes: 1,
    priority: 72,
  },
  {
    slug: 'protein-breakfast',
    title: 'Eat a high-protein breakfast',
    description: 'Steadies blood sugar and energy through a demanding morning.',
    category: 'nutrition',
    states: ['deficit'],
    estMinutes: 10,
    priority: 60,
  },
  {
    slug: 'phone-down-20',
    title: 'Keep the phone face-down for the first 20 minutes',
    description: 'Protects a fragile state from an early dopamine spike and crash.',
    category: 'digital',
    states: ['deficit'],
    estMinutes: 20,
    priority: 50,
  },

  // ── Aligned: protect and hold the state ──────────────────────────────────
  {
    slug: 'protect-first-90',
    title: 'Guard your first 90 minutes for one real task',
    description: "You're matched to the day — spend the freshest block where it counts.",
    category: 'focus',
    states: ['aligned'],
    estMinutes: 90,
    priority: 100,
  },
  {
    slug: 'clean-caffeine',
    title: 'Keep caffeine clean — one cup, timed',
    description: "Don't over-spike a good baseline; protect this afternoon's energy.",
    category: 'caffeine',
    states: ['aligned'],
    estMinutes: 1,
    priority: 80,
  },
  {
    slug: 'skip-the-feed',
    title: 'Skip the feed this morning',
    description: 'A steady state is easy to lose to a scroll. Stay off the spike.',
    category: 'digital',
    states: ['aligned'],
    estMinutes: 1,
    priority: 68,
  },
  {
    slug: 'easy-movement',
    title: 'A short, easy walk to lock it in',
    description: 'Light movement consolidates a stable, ready state.',
    category: 'movement',
    states: ['aligned'],
    estMinutes: 8,
    priority: 56,
  },

  // ── Surplus: spend the excess capacity deliberately ──────────────────────
  {
    slug: 'attack-hardest',
    title: 'Attack the hardest thing on your list first',
    description: 'You have more in the tank than today requires — aim it at what matters.',
    category: 'focus',
    states: ['surplus'],
    estMinutes: 60,
    priority: 100,
  },
  {
    slug: 'deep-work-block',
    title: 'Open a 2-hour deep-work block',
    description: 'High capacity is the rarest input. Convert it into real output.',
    category: 'focus',
    states: ['surplus'],
    estMinutes: 120,
    priority: 86,
  },
  {
    slug: 'train-hard',
    title: 'Train hard today',
    description: 'Your body can take the load — bank the adaptation while you can.',
    category: 'movement',
    states: ['surplus'],
    estMinutes: 45,
    priority: 72,
  },
  {
    slug: 'make-the-call',
    title: "Make the hard call you've been deferring",
    description: 'Surplus days are for the decisions that need a clear head.',
    category: 'focus',
    states: ['surplus'],
    estMinutes: 15,
    priority: 60,
  },

  // ── Cross-state staples ──────────────────────────────────────────────────
  {
    slug: 'hydrate-first',
    title: 'Drink a full glass of water before coffee',
    description: 'You wake up dehydrated; rehydrating sharpens early focus.',
    category: 'hydration',
    states: ['deficit', 'aligned', 'surplus'],
    estMinutes: 1,
    priority: 40,
  },
]
