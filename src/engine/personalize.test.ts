import { describe, expect, it } from 'vitest'
import { buildCandidates, buildMessages, parsePersonalizedSequence } from './personalize'
import type { PersonalizationContext, PersonalizedResponse } from './personalize'

// A valid deficit response within a 20-min budget (maxMoves 5, moveCap 7).
const validResponse: PersonalizedResponse = {
  leadSlug: 'move-body-3',
  moves: [
    { slug: 'move-body-3', example: 'a minute of pacing by the bed is plenty.' },
    { slug: 'sunlight-3', example: 'crack the blinds and stand in it.' },
    { slug: 'set-intention-2', example: 'one word for how you want today to go.' },
    { slug: 'breath-2', example: 'three slow breaths before you stand.' },
    { slug: 'hydrate-1', example: 'the glass you left by the bed.' },
  ],
}

describe('buildCandidates', () => {
  it('offers only routine goals for the state', () => {
    const c = buildCandidates('surplus')
    expect(c.length).toBeGreaterThan(0)
    // Day-scope goals (e.g. deep-work-block) must never be offered.
    expect(c.some((g) => g.goalSlug === 'deep-work-block')).toBe(false)
    expect(c.every((g) => g.variants.length > 0)).toBe(true)
  })
})

describe('buildMessages', () => {
  it('packs the constraints and candidates into the user message', () => {
    const ctx = baseCtx()
    const { system, user } = buildMessages(ctx, buildCandidates(ctx.state))
    expect(system.length).toBeGreaterThan(0)
    const parsed = JSON.parse(user)
    expect(parsed.constraints_for_output.budgetMinutes).toBe(20)
    expect(parsed.constraints_for_output.maxMoves).toBe(5)
    expect(Array.isArray(parsed.candidates)).toBe(true)
    expect(parsed.person.intent).toBe('energize')
    expect(Array.isArray(parsed.recentFocalPoints)).toBe(true)
  })

  it('passes recent focal points through so the model can rotate the lead', () => {
    const ctx = { ...baseCtx(), recentFocalSlugs: ['move-body-3', 'sunlight-3'] }
    const { user } = buildMessages(ctx, buildCandidates(ctx.state))
    expect(JSON.parse(user).recentFocalPoints).toEqual(['move-body-3', 'sunlight-3'])
  })
})

describe('parsePersonalizedSequence', () => {
  it('accepts a valid response and leads with leadSlug', () => {
    const { sequence, oneThing } = parsePersonalizedSequence(validResponse, 'deficit', 20)
    expect(sequence).toHaveLength(5)
    expect(oneThing.slug).toBe('move-body-3')
    expect(sequence[0]).toBe(oneThing)
    // The model's personalized example overrides the library default.
    expect(oneThing.example).toBe('a minute of pacing by the bed is plenty.')
  })

  it('parses a JSON string as well as an object', () => {
    const { oneThing } = parsePersonalizedSequence(JSON.stringify(validResponse), 'deficit', 20)
    expect(oneThing.slug).toBe('move-body-3')
  })

  it('parses JSON wrapped in markdown code fences (real Haiku output)', () => {
    // Haiku frequently wraps its JSON in ```json … ``` despite "no markdown".
    const fenced = '```json\n' + JSON.stringify(validResponse) + '\n```'
    const { oneThing } = parsePersonalizedSequence(fenced, 'deficit', 20)
    expect(oneThing.slug).toBe('move-body-3')
  })

  it('parses JSON with a stray line of prose around it', () => {
    const noisy = 'Here is the routine:\n' + JSON.stringify(validResponse) + '\nLet me know!'
    const { oneThing } = parsePersonalizedSequence(noisy, 'deficit', 20)
    expect(oneThing.slug).toBe('move-body-3')
  })

  it('rejects an unknown move slug', () => {
    const bad = { ...validResponse, moves: [{ slug: 'not-a-real-move', example: 'x' }], leadSlug: 'not-a-real-move' }
    expect(() => parsePersonalizedSequence(bad, 'deficit', 20)).toThrow(/unknown move/)
  })

  it('rejects two variants of the same goal', () => {
    const bad: PersonalizedResponse = {
      leadSlug: 'sunlight-10',
      moves: [
        { slug: 'sunlight-10', example: 'a' },
        { slug: 'sunlight-3', example: 'b' },
      ],
    }
    // budget 30 → moveCap 10, so the 10-min variant clears the cap and we reach
    // the duplicate-goal check.
    expect(() => parsePersonalizedSequence(bad, 'deficit', 30)).toThrow(/duplicate goal/)
  })

  it('rejects a sequence over the time budget', () => {
    const bad: PersonalizedResponse = {
      leadSlug: 'move-body-3',
      moves: [
        { slug: 'move-body-3', example: 'a' },
        { slug: 'sunlight-3', example: 'b' },
      ],
    }
    // budget 5 → two 3-min moves = 6m > 5m
    expect(() => parsePersonalizedSequence(bad, 'deficit', 5)).toThrow(/exceeds budget/)
  })

  it('rejects a single move over the per-move cap', () => {
    const bad: PersonalizedResponse = {
      leadSlug: 'shower-5',
      moves: [{ slug: 'shower-5', example: 'a' }],
    }
    // budget 5 → moveCap 3; a 5-min shower exceeds it
    expect(() => parsePersonalizedSequence(bad, 'deficit', 5)).toThrow(/move cap/)
  })

  it('rejects too many moves for the budget', () => {
    const bad: PersonalizedResponse = {
      leadSlug: 'move-body-3',
      moves: [
        { slug: 'move-body-3', example: 'a' },
        { slug: 'sunlight-3', example: 'b' },
        { slug: 'set-intention-2', example: 'c' },
        { slug: 'breath-2', example: 'd' },
      ],
    }
    // budget 5 → maxMoves 3, but 4 supplied
    expect(() => parsePersonalizedSequence(bad, 'deficit', 5)).toThrow(/exceeds 3/)
  })

  it('rejects an empty example', () => {
    const bad: PersonalizedResponse = {
      leadSlug: 'move-body-3',
      moves: [{ slug: 'move-body-3', example: '   ' }],
    }
    expect(() => parsePersonalizedSequence(bad, 'deficit', 20)).toThrow(/empty example/)
  })

  it('rejects a leadSlug that is not among the moves', () => {
    const bad: PersonalizedResponse = {
      leadSlug: 'hydrate-1',
      moves: [{ slug: 'move-body-3', example: 'a' }],
    }
    expect(() => parsePersonalizedSequence(bad, 'deficit', 20)).toThrow(/leadSlug not among/)
  })

  it('rejects malformed responses', () => {
    expect(() => parsePersonalizedSequence('{"moves":[]}', 'deficit', 20)).toThrow()
    expect(() => parsePersonalizedSequence('not json', 'deficit', 20)).toThrow()
  })
})

function baseCtx(): PersonalizationContext {
  return {
    state: 'deficit',
    gap: -3,
    dayDifficulty: 8,
    budgetMinutes: 20,
    intent: 'energize',
    fitnessLevel: 'moderate',
    chronotype: 'late',
    frictionPoint: 'getting_ready',
    goals: ['more energy'],
    constraints: ['no equipment'],
    ageRange: '25_34',
    sex: 'male',
    reflections: [
      { date: '2026-05-30', lookback: 'behind', energy: 4, mood: 5, focus: 4, note: null, completedSlugs: ['move-body-3'] },
    ],
    recentFocalSlugs: [],
  }
}
