import { eligibleRoutineGoals, maxMoves, moveCap } from './generatePlan'
import type { Action, ActionCategory, Intent, ReadinessState } from './types'

// The Claude personalization layer — pure, runtime-agnostic logic so it unit-tests
// in isolation and the client can validate the model's output before trusting it.
//
// MODEL C (the agreed design): Claude SELECTS, orders, time-scales, and rewrites
// the example copy of moves drawn from the VETTED library — it never invents
// moves on the hot path. This module builds the candidate set + prompt and
// validates the response back into a grounded Plan. Anything off-contract throws,
// and the caller falls back to the deterministic generatePlan. The library stays
// the rail; the model personalizes within it.

const MAX_EXAMPLE_LENGTH = 220

/** A move offered to the model: a vetted goal and its allowed time-variants. */
export interface Candidate {
  goalSlug: string
  category: ActionCategory
  intents: Intent[]
  variants: Action[]
}

/** A recent evening reflection — the learning signal fed to the model. */
export interface ReflectionSummary {
  date: string
  lookback: 'behind' | 'matched' | 'ahead' | null
  energy: number | null
  mood: number | null
  focus: number | null
  note: string | null
  completedSlugs: string[]
}

/** Everything the model needs to personalize one state's routine. */
export interface PersonalizationContext {
  state: ReadinessState
  gap: number
  dayDifficulty: number
  budgetMinutes: number
  intent: Intent | null
  fitnessLevel: string | null
  chronotype: string | null
  frictionPoint: string | null
  goals: string[]
  constraints: string[]
  ageRange: string | null
  sex: string | null
  reflections: ReflectionSummary[]
}

/** The structured shape we require back from the model. */
export interface PersonalizedResponse {
  moves: { slug: string; example: string }[]
  leadSlug: string
}

/** Build the vetted candidate set for a state — the rail the model selects within. */
export function buildCandidates(state: ReadinessState): Candidate[] {
  return eligibleRoutineGoals(state).map((g) => ({
    goalSlug: g.slug,
    category: g.category,
    intents: g.intents,
    variants: g.variants,
  }))
}

const SYSTEM_PROMPT = `You personalize a morning WAKE-UP routine for one person, for tomorrow.

Hard rules — follow exactly:
1. ONLY use moves from the provided candidate list. Never invent a move. Each pick must reference a real variant "slug" from a candidate.
2. Pick at most "maxMoves" moves and keep the total of their "estMinutes" at or under "budgetMinutes". No single move may exceed "moveCap" minutes.
3. Pick at most one variant per goal (one "goalSlug").
4. Choose and order moves to fit THIS person — their intent, fitness, friction point, goals, constraints, and how recent mornings actually went (the reflections). Lead with the single highest-leverage move for them; that is "leadSlug".
5. Rewrite each move's "example" so it fits this person (their fitness, constraints, equipment). Keep it short, gentle, and optional in tone. The gain is in the broad ACTION, never the specific example — never prescribe an intensity someone may not be able to do.
6. This is a wake-up routine (get out of bed and out of the room), not a workout or a work plan. Favor breadth of short moves.
7. Output ONLY minified JSON: {"moves":[{"slug":"...","example":"..."}],"leadSlug":"..."}. No prose, no markdown.`

/** Assemble the system + user messages for the Anthropic Messages API. */
export function buildMessages(
  ctx: PersonalizationContext,
  candidates: Candidate[],
): { system: string; user: string } {
  const user = JSON.stringify({
    constraints_for_output: {
      budgetMinutes: ctx.budgetMinutes,
      maxMoves: maxMoves(ctx.budgetMinutes),
      moveCap: moveCap(ctx.budgetMinutes),
    },
    today: {
      state: ctx.state,
      gap: ctx.gap,
      dayDifficulty: ctx.dayDifficulty,
      note:
        ctx.state === 'deficit'
          ? "They're behind what the day asks — stabilize and lift them."
          : ctx.state === 'surplus'
            ? 'They have more capacity than the day needs — set up a strong day.'
            : "They're matched to the day — protect and hold the state.",
    },
    person: {
      intent: ctx.intent,
      fitnessLevel: ctx.fitnessLevel,
      chronotype: ctx.chronotype,
      frictionPoint: ctx.frictionPoint,
      goals: ctx.goals,
      constraints: ctx.constraints,
      ageRange: ctx.ageRange,
      sex: ctx.sex,
    },
    recentMornings: ctx.reflections,
    candidates,
  })
  return { system: SYSTEM_PROMPT, user }
}

function parseResponse(raw: string | PersonalizedResponse): PersonalizedResponse {
  const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (!obj || typeof obj !== 'object') throw new Error('Personalization: response not an object')
  const moves = (obj as PersonalizedResponse).moves
  const leadSlug = (obj as PersonalizedResponse).leadSlug
  if (!Array.isArray(moves) || moves.length === 0) {
    throw new Error('Personalization: missing moves')
  }
  if (typeof leadSlug !== 'string' || leadSlug.length === 0) {
    throw new Error('Personalization: missing leadSlug')
  }
  return { moves, leadSlug }
}

/**
 * Validate the model's response against the vetted candidates and the budget,
 * returning a grounded sequence (oneThing first). Throws on ANY violation so the
 * caller can fall back to the deterministic plan — a wrong personalization must
 * never reach the user.
 */
export function parsePersonalizedSequence(
  raw: string | PersonalizedResponse,
  state: ReadinessState,
  budgetMinutes: number,
): { sequence: Action[]; oneThing: Action } {
  const { moves, leadSlug } = parseResponse(raw)

  // Flatten the vetted variants into a slug → (action, goal) lookup.
  const byVariant = new Map<string, { action: Action; goalSlug: string }>()
  for (const c of buildCandidates(state)) {
    for (const v of c.variants) byVariant.set(v.slug, { action: v, goalSlug: c.goalSlug })
  }

  const limit = maxMoves(budgetMinutes)
  const cap = moveCap(budgetMinutes)
  if (moves.length > limit) throw new Error(`Personalization: ${moves.length} moves exceeds ${limit}`)

  const seenGoals = new Set<string>()
  const resolved: Action[] = []
  let total = 0
  for (const m of moves) {
    const hit = byVariant.get(m.slug)
    if (!hit) throw new Error(`Personalization: unknown move slug "${m.slug}"`)
    if (seenGoals.has(hit.goalSlug)) throw new Error(`Personalization: duplicate goal "${hit.goalSlug}"`)
    if (typeof m.example !== 'string' || m.example.trim().length === 0) {
      throw new Error(`Personalization: empty example for "${m.slug}"`)
    }
    if (hit.action.estMinutes > cap) throw new Error(`Personalization: "${m.slug}" exceeds move cap`)
    seenGoals.add(hit.goalSlug)
    total += hit.action.estMinutes
    // Keep the vetted action; take only the model's personalized example (trimmed/capped).
    resolved.push({ ...hit.action, example: m.example.trim().slice(0, MAX_EXAMPLE_LENGTH) })
  }
  if (total > budgetMinutes) throw new Error(`Personalization: ${total}m exceeds budget ${budgetMinutes}m`)

  // Lead must be one of the picked moves; float it to the front.
  const leadIndex = resolved.findIndex((a) => a.slug === leadSlug)
  if (leadIndex === -1) throw new Error('Personalization: leadSlug not among moves')
  const [lead] = resolved.splice(leadIndex, 1)
  resolved.unshift(lead)

  return { sequence: resolved, oneThing: lead }
}
