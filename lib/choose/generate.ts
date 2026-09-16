import { completeJSON } from '@/lib/agent/complete'
import { getChatModel } from '@/lib/agent/models'
import { ANGLE_COUNT, LIMITS, MAX_SOURCES, validateBatch, type ChooseBatch } from '@/lib/choose/batch'
import { loadGenerationInputs, type GenerationInputs } from '@/lib/choose/inputs'
import {
  allocateStages,
  FUNNEL_PRECEDENCE,
  recentMixLine,
  stageAssignmentBlock,
  stageRulesBlock,
  type FunnelStage,
} from '@/lib/funnel/stages'

/**
 * One Choose batch: build the prompt from the whole SKILL.md, stored research and
 * recent posts, call the account's chat model once, and validate the response.
 * No retries — a retry is the creator's next click. Only the Propose action calls
 * this; page loads never do.
 */

export type GenerateResult = { ok: true; batch: ChooseBatch } | { ok: false; reason: string }

function systemPrompt(): string {
  return [
    `You propose exactly ${ANGLE_COUNT} LinkedIn post angles for one creator. The creator's SKILL.md is the authority on their audience, tribes, archetypes, voice, constraints and cadence. Follow it, including its cadence and repetition rules — for example, don't propose the target or archetype the recent posts just used.`,
    'Each angle names: the layered tribe the post speaks to, an archetype named in the skill, a hook (the opening line idea), the private tension or thought the post names, and why now.',
    FUNNEL_PRECEDENCE,
    stageRulesBlock(),
    'EVERY ANGLE HAS AN ASSIGNED STAGE. The app assigns it, not you: copy each angle\'s "funnel_stage" from the ASSIGNED FUNNEL STAGES list, in the same order. Don\'t choose your own stages, don\'t reorder them, and don\'t return a stage that wasn\'t assigned — the whole batch is rejected when the stages don\'t match. The assignment already balances the mix across recent posts, so don\'t try to balance it yourself.',
    [
      'HONESTY — every angle is exactly one of two kinds:',
      `- "sourced": about a real event or finding from the RESEARCH list. "sources" holds 1-${MAX_SOURCES} URLs copied exactly from that list. "story_prompt" is null.`,
      '- "your-story": it needs a real moment from the creator\'s own work. "sources" is []. "story_prompt" is one specific question asking the creator for that moment, ending in "?".',
      'Never state a first-person memory, a customer, a result or a number as fact. Never invent a story, an event, or a specific scenario or detail (unit numbers, incidents, dollar amounts), even one written as "you". Never use material the skill marks as unverified or hypothetical. If the RESEARCH list is empty, every angle must be "your-story".',
    ].join('\n'),
    `Length limits in characters: tribe ${LIMITS.tribe}, archetype ${LIMITS.archetype}, hook ${LIMITS.hook}, tension ${LIMITS.tension}, why_now ${LIMITS.why_now}, story_prompt ${LIMITS.story_prompt}.`,
    `Return ONLY JSON: {"angles":[{"tribe":"","archetype":"","hook":"","tension":"","why_now":"","funnel_stage":"tofu","provenance":"sourced","sources":[],"story_prompt":null}]} with exactly ${ANGLE_COUNT} angles, in the same order as the assigned stages. No commentary.`,
  ].join('\n\n')
}

function userPrompt(
  inputs: GenerationInputs,
  focus: string | null,
  stages: readonly FunnelStage[],
): string {
  const research = inputs.research.length
    ? inputs.research
        .map((r) => `- ${r.url} — ${r.title ?? '(untitled)'}${r.summary ? ` — ${r.summary.slice(0, 300)}` : ''}`)
        .join('\n')
    : '(none)'
  const posts = inputs.posts.length
    ? inputs.posts
        .map(
          (p) =>
            `- [${p.status}; ${p.archetype ?? 'no archetype'}; ${p.funnel_stage ?? 'no stage'}; ${p.posted_at ?? 'not posted'}] ${p.hook ?? '(no hook)'}`,
        )
        .join('\n')
    : '(none)'
  const rejected = inputs.current?.angles.filter((a) => a.status === 'rejected') ?? []
  const picked = inputs.current?.angles.filter((a) => a.status === 'picked') ?? []

  return [
    `SKILL.md:\n${inputs.skillMd}`,
    `RESEARCH (last 7 days — the only URLs allowed in "sources"):\n${research}`,
    `RECENT POSTS (newest first):\n${posts}`,
    stageAssignmentBlock(stages),
    recentMixLine(inputs.recentCounts, inputs.mix),
    `FOCUS FOR THIS BATCH: ${focus ?? '(none)'}`,
    rejected.length
      ? `AVOID — the creator rejected these angles:\n${rejected.map((a) => `- "${a.hook}" — reason: ${a.reject_reason ?? ''}`).join('\n')}`
      : '',
    picked.length
      ? `ALREADY CHOSEN — don't propose these again:\n${picked.map((a) => `- "${a.hook}"`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

export async function generateBatch({
  accountId,
  slug,
  focus,
}: {
  accountId: string
  slug: string
  focus: string | null
}): Promise<GenerateResult> {
  const inputs = await loadGenerationInputs(accountId, slug)
  // The app decides the funnel balance, not the model: the stages correct whatever the
  // recent window is short of. Logged so every real run shows what it asked for.
  const stages = allocateStages(ANGLE_COUNT, inputs.mix, inputs.recentCounts)
  console.info('[choose] stages', stages.join(', '))
  const raw = await completeJSON({
    model: await getChatModel(accountId),
    // No explicit limit: reasoning models spend output tokens thinking first, and
    // 3,000 left glm-5.2 no room for the JSON. Uses LLM_MAX_TOKENS like other calls.
    system: systemPrompt(),
    user: userPrompt(inputs, focus, stages),
  })
  if (raw === null) return { ok: false, reason: 'response was not JSON' }

  const result = validateBatch(raw, new Set(inputs.research.map((r) => r.url)), stages)
  if (!result.ok) return result

  return {
    ok: true,
    batch: {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      focus,
      skill_slug: slug,
      angles: result.angles.map((a) => ({
        ...a,
        id: crypto.randomUUID(),
        status: 'open' as const,
        reject_reason: null,
      })),
    },
  }
}
