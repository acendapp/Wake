import type { Goal } from './types'

// The V1 goal catalogue. Shipped as code (not the DB) so the engine stays pure,
// self-contained, and easy to iterate on. When we want to edit copy without an
// app release, this moves to a `goal_library` table.
//
// Structure: the engine selects *goals* (by state + scope), re-ranks them by the
// user's intent, then for each picks the largest *variant* that fits the
// remaining time budget. Variants are the SAME broad action at different
// durations, never different activities. This is the rail the LLM personalizes
// within, and the deterministic fallback when the model is slow or unavailable.
//
// WRITING PRINCIPLE (see Action in types.ts — applies to every move here and to
// anything the LLM generates):
//  • This is a WAKE-UP routine: short moves that get the user up and out of the
//    room. Keep durations small; breadth beats one long activity.
//  • `title` is the BROAD ACTION whose mere performance wins the gain
//    ("Move your body", "Get sunlight", "Read"), never a specific prescription.
//  • `example` is a low-intensity, optional illustration so anyone can do their
//    own version; the gain is attributed to the action, not the example.
//
// `intents` tags which intents a goal serves. Universal staples (sunlight,
// hydrate) list all three; specialized moves lean. The engine boosts matching
// goals, so the same Gap yields a different mix — and a different lead — per
// intent (calm → ease in, energize → move/cold, focus → set an intention).
//
// `scope` controls placement: the morning sequence only pulls `routine` goals.
// `day` goals (deep work, attack-the-hardest) stay dormant for a future surface.
//
// Cost convention: `estMinutes` is the *active* time a move spends from the
// budget. Near-instant behaviors (phone down, caffeine timing, hydrate, naming
// an intention) cost ~1, so they're almost always included rather than eating it.
// The "get out of bed" variant. Chronologically it can only ever be the first
// thing a person does, so both plan builders float it to the front of the
// sequence whenever it's included (the Focal Point / One Thing is unaffected).
export const GET_UP_SLUG = 'get-up-now-1'

export const GOAL_LIBRARY: Goal[] = [
  // ── Cross-state moves (eligible in every state; intent decides emphasis) ───
  {
    slug: 'morning-light',
    label: 'circadian light',
    category: 'light',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['calm', 'energize', 'focus'],
    priority: 78,
    variants: [
      {
        slug: 'sunlight-10',
        title: 'Get sunlight',
        example: 'step outside, or just sit by the brightest window you have.',
        description: 'Early light anchors your clock and starts a clean cortisol curve.',
        category: 'light',
        estMinutes: 10,
      },
      {
        slug: 'sunlight-3',
        title: 'Get sunlight',
        example: 'even a minute at an open window or doorway sends the wake signal.',
        description: 'Early light anchors your clock and starts a clean cortisol curve.',
        category: 'light',
        estMinutes: 3,
      },
    ],
  },
  {
    slug: 'set-intention',
    label: 'aim the day',
    category: 'focus',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['focus'],
    priority: 82,
    variants: [
      {
        slug: 'set-intention-2',
        title: 'Set one intention',
        example: 'name the single thing that would make today a good one.',
        description: 'A clear aim points the whole day — the naming is the win.',
        category: 'focus',
        estMinutes: 2,
      },
    ],
  },
  {
    slug: 'ease-in',
    label: 'gentle start',
    category: 'movement',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['calm'],
    priority: 80,
    variants: [
      {
        slug: 'ease-in-6',
        title: 'Ease into the morning',
        example: 'a slow stretch and a few easy breaths — no rush, no screens.',
        description: 'An unhurried start protects a calm baseline before the day pulls at it.',
        category: 'movement',
        estMinutes: 6,
      },
      {
        slug: 'ease-in-2',
        title: 'Ease into the morning',
        example: 'just sit up slowly and take a few easy breaths before you move.',
        description: 'An unhurried start protects a calm baseline before the day pulls at it.',
        category: 'movement',
        estMinutes: 2,
      },
    ],
  },
  {
    slug: 'cold-splash',
    label: 'sharpen alertness',
    category: 'movement',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['energize'],
    priority: 64,
    variants: [
      {
        slug: 'cold-splash-2',
        title: 'Wake yourself up sharply',
        example: 'splash cold water on your face, or finish your shower 30–60s cold.',
        description: 'A short cold burst sharpens alertness fast and locks in a high state.',
        category: 'movement',
        estMinutes: 2,
      },
    ],
  },
  {
    slug: 'settle-mind',
    label: 'settle the nervous system',
    category: 'focus',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['calm', 'focus'],
    priority: 58,
    variants: [
      {
        slug: 'breath-2',
        title: 'Settle your mind',
        example: 'a couple of minutes of slow breathing, eyes open or closed.',
        description: 'Settling the nervous system points your attention at the day ahead.',
        category: 'focus',
        estMinutes: 2,
      },
    ],
  },
  {
    slug: 'gratitude',
    label: 'steady the mood',
    category: 'focus',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['calm'],
    priority: 52,
    variants: [
      {
        slug: 'gratitude-3',
        title: 'Name something good',
        example: 'write three things that went right lately, and why they did.',
        description: 'A small gratitude beat steadies mood before the day pulls at it.',
        category: 'focus',
        estMinutes: 3,
      },
      {
        slug: 'gratitude-1',
        title: 'Name something good',
        example: "one thing you're grateful for — said out loud or written down.",
        description: 'A small gratitude beat steadies mood before the day pulls at it.',
        category: 'focus',
        estMinutes: 1,
      },
    ],
  },
  {
    slug: 'hydrate-first',
    label: 'rehydrate',
    category: 'hydration',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['calm', 'energize', 'focus'],
    priority: 40,
    variants: [
      {
        slug: 'hydrate-salt-2',
        title: 'Hydrate',
        example: 'water with a pinch of salt or electrolytes — you lose both overnight.',
        description: 'You wake up dehydrated and low on sodium; replacing both sharpens early focus.',
        category: 'hydration',
        estMinutes: 2,
      },
      {
        slug: 'hydrate-1',
        title: 'Hydrate',
        example: 'a full glass of water before any coffee.',
        description: 'You wake up dehydrated; rehydrating sharpens early focus.',
        category: 'hydration',
        estMinutes: 1,
      },
    ],
  },

  {
    slug: 'get-up-now',
    label: 'get out of bed',
    category: 'transition',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['energize', 'focus'],
    priority: 76,
    variants: [
      {
        slug: 'get-up-now-1',
        title: 'Get out of bed right away',
        example: 'feet on the floor, no snooze — up within a minute of waking.',
        description: 'The first decision of the day sets the tone; winning it is the win.',
        category: 'transition',
        estMinutes: 1,
      },
    ],
  },
  {
    slug: 'fresh-air',
    label: 'fresh air',
    category: 'light',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['energize', 'calm'],
    priority: 60,
    variants: [
      {
        slug: 'fresh-air-1',
        title: 'Let in fresh air',
        example: 'crack a window or step outside for a minute of fresh air.',
        description: 'Cool, fresh air is a fast, gentle signal to wake up.',
        category: 'light',
        estMinutes: 1,
      },
    ],
  },
  {
    slug: 'get-dressed',
    label: 'signal the day has begun',
    category: 'transition',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['energize', 'focus'],
    priority: 54,
    variants: [
      {
        slug: 'get-dressed-4',
        title: 'Get dressed for the day',
        example: 'out of pajamas and into real clothes — it tells your brain the day has begun.',
        description: 'Changing clothes is a clean line between sleep and the day.',
        category: 'transition',
        estMinutes: 4,
      },
    ],
  },
  {
    slug: 'take-shower',
    label: 'wake up and reset',
    category: 'transition',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['energize', 'calm'],
    priority: 52,
    variants: [
      {
        slug: 'shower-10',
        title: 'Take a shower',
        example: 'a shower to fully wake up and reset.',
        description: 'Warm water plus a fresh start wakes the body and the mind.',
        category: 'transition',
        estMinutes: 10,
      },
      {
        slug: 'shower-5',
        title: 'Take a shower',
        example: 'even a quick rinse resets you for the day.',
        description: 'Warm water plus a fresh start wakes the body and the mind.',
        category: 'transition',
        estMinutes: 5,
      },
    ],
  },
  {
    slug: 'make-bed',
    label: 'a small finished thing',
    category: 'focus',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['calm', 'focus'],
    priority: 56,
    variants: [
      {
        slug: 'make-bed-2',
        title: 'Make your bed',
        example: 'two minutes for a small, finished thing to start the day on.',
        description: 'One completed task in the first minutes builds quiet momentum.',
        category: 'focus',
        estMinutes: 2,
      },
    ],
  },
  {
    slug: 'clear-head',
    label: 'empty the mind',
    category: 'focus',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['focus', 'calm'],
    priority: 62,
    variants: [
      {
        slug: 'clear-head-8',
        title: 'Clear your head',
        example: 'fill a page, whatever comes — morning pages, no editing.',
        description: 'Getting thoughts out of your head frees up attention for the day.',
        category: 'focus',
        estMinutes: 8,
      },
      {
        slug: 'clear-head-4',
        title: 'Clear your head',
        example: "write down what's rattling around so it's on paper, not in you.",
        description: 'Getting thoughts out of your head frees up attention for the day.',
        category: 'focus',
        estMinutes: 4,
      },
    ],
  },
  {
    slug: 'picture-day',
    label: 'see it go well',
    category: 'focus',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['focus'],
    priority: 60,
    variants: [
      {
        slug: 'picture-day-2',
        title: 'Picture the day going well',
        example: 'a moment to see today going the way you want it to.',
        description: 'A brief mental rehearsal primes you to act the way you pictured.',
        category: 'focus',
        estMinutes: 2,
      },
    ],
  },
  {
    slug: 'stretch-out',
    label: 'loosen up',
    category: 'movement',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['calm', 'energize'],
    priority: 58,
    variants: [
      {
        slug: 'stretch-6',
        title: 'Stretch it out',
        example: 'a few minutes of easy stretching to loosen up.',
        description: 'Gentle stretching releases the stiffness of sleep and wakes the body.',
        category: 'movement',
        estMinutes: 6,
      },
      {
        slug: 'stretch-3',
        title: 'Stretch it out',
        example: 'reach overhead and roll your shoulders a few times.',
        description: 'Gentle stretching releases the stiffness of sleep and wakes the body.',
        category: 'movement',
        estMinutes: 3,
      },
    ],
  },
  {
    slug: 'deep-breaths',
    label: 'oxygenate and switch on',
    category: 'focus',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['energize'],
    priority: 50,
    variants: [
      {
        slug: 'deep-breaths-2',
        title: 'Take 5–10 deep breaths',
        example: 'breathe in for 4 seconds, hold for 4, release for 4 — five to ten times.',
        description: 'A few slow, deliberate breaths settle your nervous system and sharpen alertness.',
        category: 'focus',
        estMinutes: 2,
      },
    ],
  },
  {
    slug: 'warm-drink',
    label: 'a gentle warm start',
    category: 'hydration',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['calm'],
    priority: 42,
    variants: [
      {
        slug: 'warm-drink-2',
        title: 'Have a warm drink',
        example: 'warm water with lemon or herbal tea before any coffee.',
        description: 'A warm, unhurried drink eases you into the morning.',
        category: 'hydration',
        estMinutes: 2,
      },
    ],
  },
  {
    slug: 'reach-out',
    label: 'a moment of connection',
    category: 'focus',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['calm'],
    priority: 46,
    variants: [
      {
        slug: 'reach-out-1',
        title: 'Reach out to someone',
        example: 'a good-morning to someone you care about.',
        description: 'A small moment of connection lifts mood before the day starts.',
        category: 'focus',
        estMinutes: 1,
      },
    ],
  },
  {
    slug: 'put-on-music',
    label: 'set the tone with sound',
    category: 'focus',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['energize', 'calm'],
    priority: 44,
    variants: [
      {
        slug: 'music-2',
        title: 'Put on music',
        example: 'a song or two that lifts you.',
        description: 'The right sound shifts your state faster than almost anything.',
        category: 'focus',
        estMinutes: 2,
      },
    ],
  },

  // ── Deficit: stabilize and elevate ───────────────────────────────────────
  {
    slug: 'move-body',
    label: 'physical activation',
    category: 'movement',
    scope: 'routine',
    states: ['deficit'],
    intents: ['energize'],
    priority: 86,
    variants: [
      {
        slug: 'move-body-8',
        title: 'Get your blood moving',
        example: 'a short walk, a few stretches or squats — whatever feels easy this morning.',
        description: 'Moving at all is what lifts a low state — the form barely matters.',
        category: 'movement',
        estMinutes: 8,
      },
      {
        slug: 'move-body-3',
        title: 'Get your blood moving',
        example: 'even standing up to stretch or pace the room for a minute counts.',
        description: 'Moving at all is what lifts a low state — the form barely matters.',
        category: 'movement',
        estMinutes: 3,
      },
    ],
  },
  // Movement that serves a FOCUS morning (not just energy) — a walk to think, so
  // intent, not only state, shapes which movement surfaces.
  {
    slug: 'walk-and-think',
    label: 'move to think',
    category: 'movement',
    scope: 'routine',
    states: ['deficit', 'aligned'],
    intents: ['focus'],
    priority: 70,
    variants: [
      {
        slug: 'walk-think-10',
        title: 'Walk and think',
        example: 'ten minutes on foot with no phone — let the day’s plan sort itself out.',
        description: 'Easy movement with no input is where the day’s thinking untangles.',
        category: 'movement',
        estMinutes: 10,
      },
      {
        slug: 'walk-think-4',
        title: 'Walk and think',
        example: 'even a few minutes pacing or walking, turning over what matters today.',
        description: 'Easy movement with no input is where the day’s thinking untangles.',
        category: 'movement',
        estMinutes: 4,
      },
    ],
  },
  {
    slug: 'protein-breakfast',
    label: 'steady fuel',
    category: 'nutrition',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['energize', 'focus'],
    priority: 56,
    variants: [
      {
        slug: 'eat-protein-8',
        title: 'Eat something with protein',
        example: 'eggs, yogurt, cottage cheese — whatever is quick.',
        description: 'Protein steadies blood sugar and energy through a demanding morning.',
        category: 'nutrition',
        estMinutes: 8,
      },
      {
        slug: 'eat-protein-3',
        title: 'Eat something with protein',
        example: 'a protein shake or a handful of nuts on the way out works.',
        description: 'Protein steadies blood sugar and energy through a demanding morning.',
        category: 'nutrition',
        estMinutes: 3,
      },
    ],
  },
  {
    slug: 'delay-caffeine',
    label: 'caffeine timing',
    category: 'caffeine',
    scope: 'routine',
    states: ['deficit'],
    intents: ['calm', 'focus'],
    priority: 50,
    variants: [
      {
        slug: 'delay-caffeine-1',
        title: 'Ease into caffeine',
        example: 'a glass of water first; if the coffee can wait a little, let it.',
        description:
          'On a rough morning, water and light do more than a fast coffee — and the caffeine still works just as well a bit later.',
        category: 'caffeine',
        estMinutes: 1,
      },
    ],
  },
  {
    slug: 'protect-state-digital',
    label: 'protect a fragile state',
    category: 'digital',
    scope: 'routine',
    states: ['deficit'],
    intents: ['calm', 'focus'],
    priority: 46,
    variants: [
      {
        slug: 'phone-away-1',
        title: 'Stay off your phone',
        example: 'keep it face-down for the first 20 minutes you’re up.',
        description:
          'A shaky morning is easily knocked reactive — whatever you feed your attention first sets the tone.',
        category: 'digital',
        estMinutes: 1,
      },
    ],
  },

  // ── Aligned: protect and hold the state ──────────────────────────────────
  {
    slug: 'consolidate-movement',
    label: 'lock in the state',
    category: 'movement',
    scope: 'routine',
    states: ['aligned'],
    intents: ['energize'],
    priority: 84,
    variants: [
      {
        slug: 'easy-move-8',
        title: 'Keep your body gently moving',
        example: 'a gentle walk or a few stretches — nothing that drains you.',
        description: 'Light movement keeps the steady, ready state you woke up in — without spending it.',
        category: 'movement',
        estMinutes: 8,
      },
      {
        slug: 'easy-move-3',
        title: 'Keep your body gently moving',
        example: 'a quick stretch by the bed is enough.',
        description: 'Light movement keeps the steady, ready state you woke up in — without spending it.',
        category: 'movement',
        estMinutes: 3,
      },
    ],
  },
  {
    slug: 'clean-caffeine',
    label: 'caffeine timing',
    category: 'caffeine',
    scope: 'routine',
    states: ['aligned'],
    intents: ['calm', 'focus'],
    priority: 50,
    variants: [
      {
        slug: 'clean-caffeine-1',
        title: 'Keep caffeine to one cup',
        example: 'one cup, timed — not a steady drip all morning.',
        description:
          'One good cup is plenty; sipping all morning keeps caffeine in your system into the afternoon, where it works against you.',
        category: 'caffeine',
        estMinutes: 1,
      },
    ],
  },
  {
    slug: 'protect-focus',
    label: 'name what you protect',
    category: 'focus',
    scope: 'routine',
    states: ['aligned'],
    intents: ['focus'],
    priority: 60,
    variants: [
      {
        slug: 'protect-focus-2',
        title: 'Protect your focus',
        example: "name the one thing you won't let get derailed today.",
        description: 'Deciding what to guard up front keeps a steady day on track.',
        category: 'focus',
        estMinutes: 2,
      },
    ],
  },
  {
    slug: 'skip-the-feed',
    label: 'protect attention',
    category: 'digital',
    scope: 'routine',
    states: ['aligned'],
    intents: ['calm', 'focus'],
    priority: 46,
    variants: [
      {
        slug: 'skip-feed-1',
        title: 'Stay off the feed',
        example: 'leave the apps closed until you’re out the door.',
        description: 'A steady state is easy to lose to a scroll. Stay off the spike.',
        category: 'digital',
        estMinutes: 1,
      },
    ],
  },

  // ── Surplus: spend the excess capacity (short routine moves) ──────────────
  // Note: the *day-strategy* ways to spend a surplus (deep work, hard training)
  // are `scope: 'day'` below — they're not morning-routine moves.
  {
    slug: 'prime-body',
    label: 'prime the body',
    category: 'movement',
    scope: 'routine',
    states: ['surplus'],
    intents: ['energize'],
    priority: 86,
    variants: [
      {
        slug: 'prime-body-10',
        title: 'Prime your body',
        example: 'a brisk walk, a short mobility flow — use the energy without burning it.',
        description: 'High capacity is worth priming so a ready body matches a ready mind.',
        category: 'movement',
        estMinutes: 10,
      },
      {
        slug: 'prime-body-4',
        title: 'Prime your body',
        example: 'a few minutes of stretching or squats to switch the muscles on.',
        description: 'High capacity is worth priming so a ready body matches a ready mind.',
        category: 'movement',
        estMinutes: 4,
      },
    ],
  },
  {
    slug: 'feed-the-mind',
    label: 'feed the mind',
    category: 'focus',
    scope: 'routine',
    states: ['aligned', 'surplus'],
    intents: ['focus'],
    priority: 64,
    variants: [
      {
        slug: 'read-12',
        title: 'Read',
        example: 'a proper dozen minutes in a good book while your mind is fresh.',
        description: 'A little input while you’re sharp sets a thinking tone for the day.',
        category: 'focus',
        estMinutes: 12,
      },
      {
        slug: 'read-5',
        title: 'Read',
        example: 'a few pages of anything good — the gain is in reading, not what you read.',
        description: 'A little input while you’re sharp sets a thinking tone for the day.',
        category: 'focus',
        estMinutes: 5,
      },
    ],
  },

  // ── Day-strategy goals (scope: 'day' — NOT in the morning sequence) ───────
  // Dormant until a future "rest of your day" surface. Kept here so the catalogue
  // is one place and the scope split is explicit.
  {
    slug: 'protect-first-90',
    label: 'spend the freshest block',
    category: 'focus',
    scope: 'day',
    states: ['aligned'],
    intents: ['focus'],
    priority: 100,
    variants: [
      {
        slug: 'protect-first-90-1',
        title: 'Guard your freshest block',
        example: 'protect your first 90 minutes for one real task.',
        description: "You're matched to the day — spend the freshest block where it counts.",
        category: 'focus',
        estMinutes: 90,
      },
    ],
  },
  {
    slug: 'attack-hardest',
    label: 'aim the surplus',
    category: 'focus',
    scope: 'day',
    states: ['surplus'],
    intents: ['energize', 'focus'],
    priority: 100,
    variants: [
      {
        slug: 'attack-hardest-1',
        title: 'Attack the hardest thing first',
        example: 'take on the most demanding item on your list while capacity is high.',
        description: 'You have more in the tank than today requires — aim it at what matters.',
        category: 'focus',
        estMinutes: 60,
      },
    ],
  },
  {
    slug: 'deep-work-block',
    label: 'convert capacity to output',
    category: 'focus',
    scope: 'day',
    states: ['surplus'],
    intents: ['focus'],
    priority: 86,
    variants: [
      {
        slug: 'deep-work-block-1',
        title: 'Open a deep-work block',
        example: 'a focused 2-hour block on the work that matters most.',
        description: 'High capacity is the rarest input. Convert it into real output.',
        category: 'focus',
        estMinutes: 120,
      },
    ],
  },
  {
    slug: 'train-hard',
    label: 'bank the adaptation',
    category: 'movement',
    scope: 'day',
    states: ['surplus'],
    intents: ['energize'],
    priority: 72,
    variants: [
      {
        slug: 'train-hard-1',
        title: 'Train hard',
        example: 'a real workout your body can take today.',
        description: 'Your body can take the load — bank the adaptation while you can.',
        category: 'movement',
        estMinutes: 45,
      },
    ],
  },

  // ── Catalog additions (behavioral-science content audit) ─────────────────
  // A real meditation practice — the app positions as replacing a meditation app,
  // but the only mindfulness move was a 2-min downshift; this gives the 10/15-min
  // tiers an actual sit and a headline reason to exist.
  {
    slug: 'meditate',
    label: 'train attention',
    category: 'focus',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['calm', 'focus'],
    priority: 66,
    variants: [
      {
        slug: 'meditate-10',
        title: 'Meditate',
        example: 'ten minutes following your breath — guided or in silence, whatever settles you.',
        description: 'A short sit trains attention and lowers reactivity for the whole day.',
        category: 'focus',
        estMinutes: 10,
      },
      {
        slug: 'meditate-5',
        title: 'Meditate',
        example: 'five quiet minutes noticing the breath; when the mind wanders, come back.',
        description: 'A short sit trains attention and lowers reactivity for the whole day.',
        category: 'focus',
        estMinutes: 5,
      },
    ],
  },
  // Balanced breakfast for aligned/surplus mornings — nutrition was one deficit-only
  // move, so a steady or high-capacity morning was never offered breakfast at all.
  {
    slug: 'fuel-well',
    label: 'eat for a steady curve',
    category: 'nutrition',
    scope: 'routine',
    states: ['aligned', 'surplus'],
    intents: ['energize', 'focus'],
    priority: 54,
    variants: [
      {
        slug: 'fuel-well-8',
        title: 'Eat a real breakfast',
        example: 'protein plus something whole — eggs and fruit, yogurt and oats.',
        description: 'A balanced first meal holds energy flat instead of spiking then crashing.',
        category: 'nutrition',
        estMinutes: 8,
      },
      {
        slug: 'fuel-well-3',
        title: 'Eat a real breakfast',
        example: 'grab something with protein and fiber on the way — not just a pastry.',
        description: 'A balanced first meal holds energy flat instead of spiking then crashing.',
        category: 'nutrition',
        estMinutes: 3,
      },
    ],
  },
  // Concrete task-prioritization — the single highest-evidence productivity ritual
  // (identify your top few). Distinct from set-intention (feeling/tone).
  {
    slug: 'plan-day',
    label: "set the day's targets",
    category: 'focus',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['focus'],
    priority: 63,
    variants: [
      {
        slug: 'plan-day-3',
        title: "Choose today's top three",
        example: 'write the three things that, if done, make today a win.',
        description: 'A short ranked list turns a vague day into a plan you can act on.',
        category: 'focus',
        estMinutes: 3,
      },
    ],
  },
  // Caffeine guidance for surplus mornings (deficit + aligned already covered).
  {
    slug: 'time-caffeine',
    label: 'caffeine timing',
    category: 'caffeine',
    scope: 'routine',
    states: ['surplus'],
    intents: ['focus', 'energize'],
    priority: 50,
    variants: [
      {
        slug: 'time-caffeine-1',
        title: 'Save caffeine for the work',
        example: 'save the cup for your first hard block, not the moment you wake.',
        description:
          "You're already sharp — coffee does more aimed at your first hard task than a peak you already have.",
        category: 'caffeine',
        estMinutes: 1,
      },
    ],
  },
  // A surplus-specific routine move so a high-capacity morning feels different from
  // aligned — the flattering, shareable state deserves its own payoff.
  {
    slug: 'stretch-goal',
    label: 'use the surplus',
    category: 'focus',
    scope: 'routine',
    states: ['surplus'],
    intents: ['focus', 'energize'],
    priority: 58,
    variants: [
      {
        slug: 'stretch-goal-2',
        title: 'Set a stretch goal',
        example: "name one thing to push further than usual today, while you've got the capacity.",
        description: 'A surplus morning is the day to reach — spend the extra readiness on purpose.',
        category: 'focus',
        estMinutes: 2,
      },
    ],
  },
  // A quick calisthenics burst — more activating than the gentle "stretch it out"
  // move, concrete enough to just do. One short variant: under the 15-min budget's
  // per-move cap, longer strength sets would never be selected anyway.
  {
    slug: 'quick-exercises',
    label: 'a quick burst of effort',
    category: 'movement',
    scope: 'routine',
    states: ['deficit', 'aligned', 'surplus'],
    intents: ['energize'],
    priority: 62,
    variants: [
      {
        slug: 'quick-exercises-1',
        title: 'Do a few quick exercises',
        example: 'a couple pushups, a quick wall-sit, a short plank — anything to get your blood flowing.',
        description: 'A short burst of effort lifts your heart rate and clears the morning fog fast.',
        category: 'movement',
        estMinutes: 1,
      },
    ],
  },
]
