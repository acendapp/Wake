// Citations for the health/behavioral claims the routine moves make (the "Why it
// works" line on each move). Apple Guideline 1.4.1 requires health information to
// carry findable citations to its sources; these surface both inline on each move's
// detail sheet AND in the Library's "Sources & references" screen.
//
// Organized by TOPIC rather than per-move, because many moves rest on the same
// science (all three caffeine moves, every movement move, etc.) — one topic, one
// vetted source list, mapped to the moves it backs. URLs are stable PubMed / PMC
// (NIH) permalinks and peer-reviewed journal DOIs; these identifiers don't move,
// so a reviewer (or user) clicking through never hits a dead link.

export type Source = { label: string; url: string }

export type SourceTopic = {
  key: string
  /** User-facing heading on the references screen. */
  title: string
  sources: Source[]
}

export const SOURCE_TOPICS: SourceTopic[] = [
  {
    key: 'light',
    title: 'Morning light & your body clock',
    sources: [
      {
        label: 'Human suprachiasmatic response to light & melatonin suppression — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6281828/',
      },
      {
        label: 'Light-induced changes of the human circadian clock — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3079938/',
      },
      {
        label: 'The circadian system modulates the cortisol awakening response — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9669756/',
      },
    ],
  },
  {
    key: 'movement',
    title: 'Movement & shaking off sleep',
    sources: [
      {
        label: 'Exercising caution upon waking — can exercise reduce sleep inertia? NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7155753/',
      },
      {
        label: 'The impact of a short burst of exercise on sleep inertia — PubMed',
        url: 'https://pubmed.ncbi.nlm.nih.gov/34606883/',
      },
      {
        label: 'Acute exercise improves mood, energy and motivation — PubMed',
        url: 'https://pubmed.ncbi.nlm.nih.gov/26741120/',
      },
    ],
  },
  {
    key: 'hydration',
    title: 'Hydration in the morning',
    sources: [
      {
        label: 'Mild dehydration impairs cognitive performance and mood — PubMed',
        url: 'https://pubmed.ncbi.nlm.nih.gov/21736786/',
      },
      {
        label: 'Effects of hydration status on cognitive performance and mood — PubMed',
        url: 'https://pubmed.ncbi.nlm.nih.gov/24480458/',
      },
    ],
  },
  {
    key: 'caffeine',
    title: 'Caffeine, adenosine & timing',
    sources: [
      {
        label: 'Adenosine, caffeine, and sleep–wake regulation: state of the science — PubMed',
        url: 'https://pubmed.ncbi.nlm.nih.gov/35575450/',
      },
      {
        label: 'Roles of adenosine and its receptors in sleep–wake regulation — PubMed',
        url: 'https://pubmed.ncbi.nlm.nih.gov/25175972/',
      },
    ],
  },
  {
    key: 'breathing',
    title: 'Slow breathing & the nervous system',
    sources: [
      {
        label: 'Acute effects of slow-paced breathing on emotion regulation — PubMed',
        url: 'https://pubmed.ncbi.nlm.nih.gov/40179113/',
      },
      {
        label: 'Breathing practices for stress and anxiety: systematic review — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10741869/',
      },
    ],
  },
  {
    key: 'gratitude',
    title: 'Gratitude & mood',
    sources: [
      {
        label: 'Emmons & McCullough, “Counting blessings versus burdens” — PubMed',
        url: 'https://pubmed.ncbi.nlm.nih.gov/12585811/',
      },
      {
        label: 'The effects of gratitude interventions: systematic review & meta-analysis — PubMed',
        url: 'https://pubmed.ncbi.nlm.nih.gov/37585888/',
      },
    ],
  },
  {
    key: 'connection',
    title: 'Connection & wellbeing',
    sources: [
      {
        label: 'Spending time with others and subjective well-being — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7416486/',
      },
      {
        label: 'Social interaction modality and positive affect — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9770761/',
      },
    ],
  },
  {
    key: 'intention',
    title: 'Setting an intention & a plan',
    sources: [
      {
        label: 'Mechanisms of implementation-intention (if–then plan) effects — PubMed',
        url: 'https://pubmed.ncbi.nlm.nih.gov/18096108/',
      },
      {
        label: 'Mental contrasting with implementation intentions: meta-analysis — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8149892/',
      },
    ],
  },
  {
    key: 'imagery',
    title: 'Mental rehearsal',
    sources: [
      {
        label: 'Mental representation and motor imagery training — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4033090/',
      },
      {
        label: 'Best practice for motor imagery: systematic review — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3141540/',
      },
    ],
  },
  {
    key: 'writing',
    title: 'Getting thoughts onto paper',
    sources: [
      {
        label: 'Health effects of expressive writing: meta-analysis — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2736499/',
      },
      {
        label: 'The durability of beneficial effects of expressive writing — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4842937/',
      },
    ],
  },
  {
    key: 'mindfulness',
    title: 'Meditation, attention & reactivity',
    sources: [
      {
        label: 'Brief mindfulness training reduces mind-wandering — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5329004/',
      },
      {
        label: 'Brief mindfulness meditation improves emotion processing — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6795685/',
      },
    ],
  },
  {
    key: 'nutrition',
    title: 'Protein & steady energy',
    sources: [
      {
        label: 'Effect of a high-protein breakfast on the ghrelin (hunger) response — PubMed',
        url: 'https://pubmed.ncbi.nlm.nih.gov/16469977/',
      },
      {
        label: 'High-protein breakfast attenuates the later glucose response — PubMed',
        url: 'https://pubmed.ncbi.nlm.nih.gov/25733459/',
      },
    ],
  },
  {
    key: 'music',
    title: 'Music & mood',
    sources: [
      {
        label: 'Emotion regulation through listening to music in everyday life — PubMed',
        url: 'https://pubmed.ncbi.nlm.nih.gov/21902567/',
      },
      {
        label: 'The impact of musicking on emotion regulation: meta-analysis — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11405141/',
      },
    ],
  },
  {
    key: 'cold',
    title: 'Cold water & alertness',
    sources: [
      {
        label: 'Plasma norepinephrine responses of man in cold water — PubMed',
        url: 'https://pubmed.ncbi.nlm.nih.gov/911386/',
      },
    ],
  },
  {
    key: 'walking',
    title: 'Walking & thinking',
    sources: [
      {
        label: 'Oppezzo & Schwartz, “Give your ideas some legs” (walking & creativity) — PubMed',
        url: 'https://pubmed.ncbi.nlm.nih.gov/24749966/',
      },
      {
        label: 'The impact of walking on creative thinking: meta-analysis — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC13170883/',
      },
    ],
  },
  {
    key: 'goals',
    title: 'Reaching for a goal',
    sources: [
      {
        label: 'Goal-setting difficulty, self-regulation and performance — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3588684/',
      },
      {
        label: 'Goal difficulty & specificity on performance — PubMed',
        url: 'https://pubmed.ncbi.nlm.nih.gov/9258843/',
      },
    ],
  },
  {
    key: 'accomplishment',
    title: 'Small wins & momentum',
    sources: [
      {
        label: 'Sense of accomplishment in the brain’s reward system — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5215289/',
      },
    ],
  },
  {
    key: 'attention',
    title: 'Protecting your attention',
    sources: [
      {
        label: 'Leroy, “Why is it so hard to do my work?” (attention residue) — ScienceDirect',
        url: 'https://www.sciencedirect.com/science/article/abs/pii/S0749597809000399',
      },
      {
        label: 'Task engagement across transitions (attention residue) — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8827296/',
      },
    ],
  },
  {
    key: 'waking',
    title: 'Easing out of sleep inertia',
    sources: [
      {
        label: 'A morning routine to decrease subjective sleep inertia — PubMed',
        url: 'https://pubmed.ncbi.nlm.nih.gov/30399503/',
      },
      {
        label: 'Sleep inertia: current insights — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5124508/',
      },
    ],
  },
  {
    key: 'cognition',
    title: 'When your mind is freshest',
    sources: [
      {
        label: 'Sleep inertia and the recovery of cognitive function after waking — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5124508/',
      },
      {
        label: 'A circadian rhythm in cognitive impairment on waking — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3130065/',
      },
    ],
  },
  {
    key: 'habit',
    title: 'Habits & context cues',
    sources: [
      {
        label: 'Automaticity and the Self-Report Habit Index — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3552971/',
      },
      {
        label: 'Beneficial habits and positive life outcomes — NIH/PMC',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4731333/',
      },
    ],
  },
]

// Each routine goal (by slug) → the topic whose sources back its claim. Goals with
// `scope: 'day'` are dormant (never shown), so they're intentionally absent.
const GOAL_TOPIC: Record<string, string> = {
  'morning-light': 'light',
  'set-intention': 'intention',
  'ease-in': 'waking',
  'cold-splash': 'cold',
  'settle-mind': 'breathing',
  gratitude: 'gratitude',
  'hydrate-first': 'hydration',
  'get-up-now': 'waking',
  'fresh-air': 'waking',
  // get-dressed / take-shower / fuel-well were removed from the library Aug 2026,
  // but old stored plans can still surface their moves — keep their topics mapped.
  'get-dressed': 'habit',
  'take-shower': 'waking',
  'make-bed': 'accomplishment',
  'clear-head': 'writing',
  'picture-day': 'imagery',
  'stretch-out': 'movement',
  'deep-breaths': 'breathing',
  'warm-drink': 'hydration',
  'reach-out': 'connection',
  'put-on-music': 'music',
  'move-body': 'movement',
  'walk-and-think': 'walking',
  'protein-breakfast': 'nutrition',
  'delay-caffeine': 'caffeine',
  'protect-state-digital': 'attention',
  'consolidate-movement': 'movement',
  'clean-caffeine': 'caffeine',
  'protect-focus': 'intention',
  'skip-the-feed': 'attention',
  'prime-body': 'movement',
  'feed-the-mind': 'cognition',
  meditate: 'mindfulness',
  'fuel-well': 'nutrition',
  'plan-day': 'intention',
  'write-top-priority': 'intention',
  'break-it-down': 'goals',
  'look-forward': 'gratitude',
  'recent-win': 'accomplishment',
  'kind-word': 'gratitude',
  'time-caffeine': 'caffeine',
  'stretch-goal': 'goals',
  'quick-exercises': 'movement',
}

const TOPIC_BY_KEY = new Map(SOURCE_TOPICS.map((t) => [t.key, t]))

/** The vetted sources backing a goal's claim, or [] if it has none (e.g. day-scope). */
export function sourcesForGoal(goalSlug: string): Source[] {
  const key = GOAL_TOPIC[goalSlug]
  return (key && TOPIC_BY_KEY.get(key)?.sources) || []
}
