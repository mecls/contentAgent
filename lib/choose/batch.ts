/**
 * The Choose batch contract: types, limits, validation of the model's response
 * and the drafting prompt. Deliberately free of runtime imports so
 * scripts/check-choose-batch.mjs can load it with `node --experimental-strip-types`.
 * The one import below is type-only, and type-only imports are erased before node
 * sees the file — so the `@/` alias is never resolved at runtime. Keep it that way:
 * a value import here breaks both check scripts.
 */

import type { FunnelStage } from '@/lib/funnel/stages'

export type Provenance = 'sourced' | 'your-story'

/** One angle as the model returns it. */
export interface ModelAngle {
  tribe: string
  archetype: string
  hook: string
  tension: string
  why_now: string
  /** Which funnel stage this angle serves. The app assigns it; the model copies it back. */
  funnel_stage: FunnelStage
  provenance: Provenance
  sources: string[]
  story_prompt: string | null
}

/**
 * One angle as stored in the current batch. `funnel_stage` is optional here, unlike on
 * ModelAngle: a batch stored before the funnel existed is read back without validation
 * (`asBatch` in lib/choose/inputs.ts only checks the id and the angles array), so the
 * field really can be missing on an old batch. Callers fall back rather than assume.
 */
export interface ChooseAngle extends Omit<ModelAngle, 'funnel_stage'> {
  funnel_stage?: FunnelStage
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
 *
 * `expectedStages` is the assignment the app made for this batch (one per angle, in
 * order). An angle's stage is valid only if it was asked for, and the batch as a whole
 * must return that exact multiset — otherwise the model has quietly rebalanced the
 * funnel, which is the app's job, not its own.
 */
export function validateBatch(
  raw: unknown,
  allowedUrls: ReadonlySet<string>,
  expectedStages: readonly FunnelStage[],
): ValidationResult {
  if (!isRecord(raw) || !Array.isArray(raw.angles)) {
    return { ok: false, reason: 'response has no angles array' }
  }
  if (raw.angles.length !== expectedStages.length) {
    return { ok: false, reason: `expected ${expectedStages.length} angles, got ${raw.angles.length}` }
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

    const stage = angle.funnel_stage
    if (typeof stage !== 'string' || !expectedStages.includes(stage as FunnelStage)) {
      return {
        ok: false,
        reason: `angle ${n}: funnel_stage must be one of ${[...new Set(expectedStages)].join(', ')}`,
      }
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

    angles.push({ ...text, funnel_stage: stage as FunnelStage, provenance, sources, story_prompt: storyPrompt })
  }

  const want = [...expectedStages].sort().join(',')
  const got = angles.map((a) => a.funnel_stage).sort().join(',')
  if (want !== got) {
    return { ok: false, reason: `funnel stages must be exactly ${want} — got ${got}` }
  }

  return { ok: true, angles }
}

/** A model angle, or a stored one whose stage may predate the funnel. */
type DraftAngle = Omit<ModelAngle, 'funnel_stage'> & { funnel_stage?: FunnelStage }

/**
 * The chat prompt for a picked angle (spec rule 17). It names the stage but doesn't
 * explain it: the orchestrator already carries the definitions in its system prompt,
 * and write_content expands the full brief from lib/funnel/stages.ts.
 */
export function buildDraftPrompt(angle: DraftAngle): string {
  const provenanceLine =
    angle.provenance === 'sourced'
      ? `Sources (use only these for facts): ${angle.sources.join(' ')}`
      : `This needs my real story. Ask me this before drafting and do not invent the moment: ${angle.story_prompt ?? ''}`
  return [
    'Draft a LinkedIn post from this angle. First open the skill (read_skill) and follow it.',
    '',
    `Tribe: ${angle.tribe}`,
    `Archetype: ${angle.archetype}`,
    angle.funnel_stage ? `Funnel stage: ${angle.funnel_stage} — write it for that stage.` : '',
    `Hook idea: ${angle.hook}`,
    `The tension it names: ${angle.tension}`,
    `Why now: ${angle.why_now}`,
    provenanceLine,
  ]
    .filter(Boolean)
    .join('\n')
}
