/**
 * The Choose batch contract: types, limits, validation of the model's response
 * and the drafting prompt. Deliberately import-free so
 * scripts/check-choose-batch.mjs can load it with `node --experimental-strip-types`.
 */

export type Provenance = 'sourced' | 'your-story'

/** One angle as the model returns it. */
export interface ModelAngle {
  tribe: string
  archetype: string
  hook: string
  tension: string
  why_now: string
  provenance: Provenance
  sources: string[]
  story_prompt: string | null
}

/** One angle as stored in the current batch. */
export interface ChooseAngle extends ModelAngle {
  id: string
  status: 'open' | 'picked' | 'rejected'
  reject_reason: string | null
}

/** The account's single current batch, stored in `config` under `choose_batch`. */
export interface ChooseBatch {
  id: string
  created_at: string
  focus: string | null
  skill_slug: string
  angles: ChooseAngle[]
}

export const ANGLE_COUNT = 3
export const MAX_SOURCES = 2

export const LIMITS = {
  tribe: 80,
  archetype: 60,
  hook: 280,
  tension: 280,
  why_now: 280,
  story_prompt: 200,
  focus: 300,
  reject_reason: 200,
} as const

export type ValidationResult = { ok: true; angles: ModelAngle[] } | { ok: false; reason: string }

const TEXT_FIELDS = ['tribe', 'archetype', 'hook', 'tension', 'why_now'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Check a raw model response against the batch rules. The whole batch passes or
 * nothing does: values are trimmed, but no field is ever repaired or dropped.
 */
export function validateBatch(raw: unknown, allowedUrls: ReadonlySet<string>): ValidationResult {
  if (!isRecord(raw) || !Array.isArray(raw.angles)) {
    return { ok: false, reason: 'response has no angles array' }
  }
  if (raw.angles.length !== ANGLE_COUNT) {
    return { ok: false, reason: `expected ${ANGLE_COUNT} angles, got ${raw.angles.length}` }
  }

  const angles: ModelAngle[] = []
  for (let i = 0; i < raw.angles.length; i++) {
    const n = i + 1
    const angle: unknown = raw.angles[i]
    if (!isRecord(angle)) return { ok: false, reason: `angle ${n}: not an object` }

    const text: Record<(typeof TEXT_FIELDS)[number], string> = {
      tribe: '',
      archetype: '',
      hook: '',
      tension: '',
      why_now: '',
    }
    for (const field of TEXT_FIELDS) {
      const value = typeof angle[field] === 'string' ? (angle[field] as string).trim() : ''
      if (value.length < 1 || value.length > LIMITS[field]) {
        return { ok: false, reason: `angle ${n}: ${field} must be 1-${LIMITS[field]} characters` }
      }
      text[field] = value
    }

    const provenance = angle.provenance
    if (provenance !== 'sourced' && provenance !== 'your-story') {
      return { ok: false, reason: `angle ${n}: provenance must be sourced or your-story` }
    }

    const rawSources = angle.sources ?? []
    if (!Array.isArray(rawSources) || rawSources.some((s) => typeof s !== 'string')) {
      return { ok: false, reason: `angle ${n}: sources must be a list of URLs` }
    }
    const sources = (rawSources as string[]).map((s) => s.trim())

    let storyPrompt: string | null = null
    if (provenance === 'sourced') {
      if (sources.length < 1 || sources.length > MAX_SOURCES) {
        return { ok: false, reason: `angle ${n}: a sourced angle needs 1-${MAX_SOURCES} sources` }
      }
      const unknown = sources.find((s) => !allowedUrls.has(s))
      if (unknown !== undefined) {
        return { ok: false, reason: `angle ${n}: source not in research: ${unknown}` }
      }
      if (angle.story_prompt !== null && angle.story_prompt !== undefined) {
        return { ok: false, reason: `angle ${n}: a sourced angle has no story_prompt` }
      }
    } else {
      if (sources.length !== 0) {
        return { ok: false, reason: `angle ${n}: a your-story angle has no sources` }
      }
      const prompt = typeof angle.story_prompt === 'string' ? angle.story_prompt.trim() : ''
      if (prompt.length < 1 || prompt.length > LIMITS.story_prompt || !prompt.endsWith('?')) {
        return {
          ok: false,
          reason: `angle ${n}: story_prompt must be a question of 1-${LIMITS.story_prompt} characters ending in ?`,
        }
      }
      storyPrompt = prompt
    }

    angles.push({ ...text, provenance, sources, story_prompt: storyPrompt })
  }

  return { ok: true, angles }
}

/** The chat prompt for a picked angle (spec rule 17). */
export function buildDraftPrompt(angle: ModelAngle): string {
  const provenanceLine =
    angle.provenance === 'sourced'
      ? `Sources (use only these for facts): ${angle.sources.join(' ')}`
      : `This needs my real story. Ask me this before drafting and do not invent the moment: ${angle.story_prompt ?? ''}`
  return [
    'Draft a LinkedIn post from this angle. First open the skill (read_skill) and follow it.',
    '',
    `Tribe: ${angle.tribe}`,
    `Archetype: ${angle.archetype}`,
    `Hook idea: ${angle.hook}`,
    `The tension it names: ${angle.tension}`,
    `Why now: ${angle.why_now}`,
    provenanceLine,
  ].join('\n')
}
