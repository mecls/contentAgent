// Free contract check for lib/funnel/stages.ts — no model call, no network.
// Run: node --experimental-strip-types scripts/check-funnel.mjs
//
// Also loads lib/choose/batch.ts, so it proves that file still runs without a build.
import {
  allocateStages,
  countStages,
  DEFAULT_MIX,
  findJargon,
  normalizeMix,
  recentMixLine,
  recentStageCounts,
  stageAssignmentBlock,
  stageMix,
  stageRulesBlock,
  withinDays,
} from '../lib/funnel/stages.ts'
import { validateBatch } from '../lib/choose/batch.ts'

let failed = 0
function check(name, passed, detail = '') {
  if (passed) {
    console.log(`ok: ${name}`)
  } else {
    failed++
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const none = { tofu: 0, mofu: 0, bofu: 0 }
const shape = (stages) => {
  const c = countStages(stages)
  return `${c.tofu}/${c.mofu}/${c.bofu}`
}

// ── allocator ────────────────────────────────────────────────────────────────
check('10 with an empty window gives 6/3/1', shape(allocateStages(10, DEFAULT_MIX, none)) === '6/3/1', shape(allocateStages(10, DEFAULT_MIX, none)))
check('3 with an empty window gives 2/1/0', shape(allocateStages(3, DEFAULT_MIX, none)) === '2/1/0', shape(allocateStages(3, DEFAULT_MIX, none)))
check(
  'a window of 5 bofu gives a batch with no bofu',
  countStages(allocateStages(3, DEFAULT_MIX, { tofu: 0, mofu: 0, bofu: 5 })).bofu === 0,
  shape(allocateStages(3, DEFAULT_MIX, { tofu: 0, mofu: 0, bofu: 5 })),
)
check(
  'a window of 5 tofu shifts the batch off tofu',
  countStages(allocateStages(3, DEFAULT_MIX, { tofu: 5, mofu: 0, bofu: 0 })).tofu === 0,
  shape(allocateStages(3, DEFAULT_MIX, { tofu: 5, mofu: 0, bofu: 0 })),
)
check(
  'never more than 1 bofu per 5 posts',
  [none, { tofu: 3, mofu: 2, bofu: 0 }, { tofu: 5, mofu: 0, bofu: 0 }, { tofu: 2, mofu: 1, bofu: 1 }].every(
    (window) => countStages(allocateStages(5, DEFAULT_MIX, window)).bofu <= 1,
  ),
)
check(
  'always returns n valid stages',
  [1, 2, 3, 5, 10, 17].every((n) => {
    const out = allocateStages(n, DEFAULT_MIX, { tofu: 2, mofu: 1, bofu: 0 })
    return out.length === n && out.every((s) => s === 'tofu' || s === 'mofu' || s === 'bofu')
  }),
)
check('n of 0 returns nothing', allocateStages(0, DEFAULT_MIX, none).length === 0)
check(
  'the same inputs give the same output',
  allocateStages(7, DEFAULT_MIX, { tofu: 1, mofu: 2, bofu: 0 }).join() ===
    allocateStages(7, DEFAULT_MIX, { tofu: 1, mofu: 2, bofu: 0 }).join(),
)
check(
  'an overserved window still returns n stages',
  allocateStages(3, DEFAULT_MIX, { tofu: 50, mofu: 50, bofu: 50 }).length === 3,
)

// ── jargon ───────────────────────────────────────────────────────────────────
const TECHNICAL =
  'We wired the API to an MCP server, tuned the LLM with RAG and embeddings, stored them in a vector database, and the whole pipeline runs on LangChain with n8n webhooks.'
const flagged = findJargon(TECHNICAL, 'tofu')
for (const term of ['API', 'MCP', 'LLM', 'RAG', 'embeddings', 'vector database', 'pipeline', 'LangChain', 'n8n', 'webhooks']) {
  check(`flags "${term}" in a tofu post`, flagged.some((f) => f.toLowerCase() === term.toLowerCase()), flagged.join(', '))
}

const PLAIN =
  'I asked ChatGPT to clean up my inbox, gave Claude a prompt for my weekly plan, and let an AI agent handle the follow-ups. The automation saved my Monday.'
check('a plain tofu post is clean', findJargon(PLAIN, 'tofu').length === 0, findJargon(PLAIN, 'tofu').join(', '))
check(
  'product names and everyday words are never flagged',
  findJargon('ChatGPT, Claude, AI agents, prompts, automation, workflow, chatbot, spreadsheet', 'tofu').length === 0,
)
check(
  'acronyms inside ordinary words are not flagged',
  findJargon('Rapid capability growth in therapy practices and a jsonesque habit.', 'tofu').length === 0,
  findJargon('Rapid capability growth in therapy practices and a jsonesque habit.', 'tofu').join(', '),
)
check('"leasing pipeline" is allowed', findJargon('Our leasing pipeline finally moves.', 'tofu').length === 0)
check('a bare "pipeline" is flagged', findJargon('The pipeline finally moves.', 'tofu').length === 1)
check('mofu is checked like tofu', findJargon(TECHNICAL, 'mofu').length > 0)
check('bofu is exempt', findJargon(TECHNICAL, 'bofu').length === 0)
check(
  'terms come back as written, deduped, in order',
  findJargon('The API matters. The API and the webhook matter.', 'tofu').join('|') === 'API|webhook',
  findJargon('The API matters. The API and the webhook matter.', 'tofu').join('|'),
)

// ── mix ──────────────────────────────────────────────────────────────────────
const posts = [
  { funnel_stage: 'tofu', created_at: new Date().toISOString() },
  { funnel_stage: null, created_at: new Date().toISOString() },
  { funnel_stage: 'mofu', created_at: new Date().toISOString() },
  { funnel_stage: 'tofu', created_at: new Date(Date.now() - 30 * 86_400_000).toISOString() },
]
const recent = withinDays(posts, 7)
check('withinDays drops older posts', recent.length === 3)
const mix = stageMix(recent)
check('stageMix counts only classified posts', mix.total === 2 && mix.counts.tofu === 1 && mix.counts.mofu === 1)
check('stageMix shares are 0 when nothing is classified', stageMix([{ funnel_stage: null }]).shares.tofu === 0)
check('recentStageCounts honours its limit', recentStageCounts(posts, { limit: 1 }).tofu === 1)
check('normalizeMix falls back on garbage', normalizeMix({ tofu: 'x' }) === DEFAULT_MIX && normalizeMix(null) === DEFAULT_MIX)
check(
  'normalizeMix accepts 6/3/1 and rescales',
  Math.abs(normalizeMix({ tofu: 6, mofu: 3, bofu: 1 }).tofu - 0.6) < 1e-9,
)

// ── prompt fragments ─────────────────────────────────────────────────────────
const assignment = stageAssignmentBlock(['tofu', 'tofu', 'mofu'])
check('the assignment lists one line per angle in order', assignment.includes('Angle 1: tofu') && assignment.includes('Angle 3: mofu'))
const rules = stageRulesBlock()
check('the rules name all three stages', ['TOFU', 'MOFU', 'BOFU'].every((s) => rules.includes(s)))
check('the rules carry the plain-words rule', rules.includes('PLAIN WORDS') && rules.includes('ChatGPT'))
check('the mix line reads empty when nothing is classified', recentMixLine(none, DEFAULT_MIX).includes('no classified posts yet'))
check('the mix line reports what the window holds', recentMixLine({ tofu: 4, mofu: 1, bofu: 0 }, DEFAULT_MIX).includes('tofu 4'))

// ── batch validation ─────────────────────────────────────────────────────────
const URL_A = 'https://example.com/research-a'
const allowed = new Set([URL_A])
const angle = (stage) => ({
  tribe: 'Owners of small accounting firms',
  archetype: 'Resonance',
  hook: "It's 9pm on the 3rd and the bank feed is wrong again.",
  tension: 'The job built to give freedom became the one nobody else can do.',
  why_now: 'Month-end close season.',
  funnel_stage: stage,
  provenance: 'sourced',
  sources: [URL_A],
  story_prompt: null,
})

const asked = ['tofu', 'tofu', 'mofu']
const good = validateBatch({ angles: [angle('tofu'), angle('tofu'), angle('mofu')] }, allowed, asked)
check('a batch matching the assignment is accepted', good.ok, good.ok ? '' : good.reason)
check(
  'the accepted angles keep their stage',
  good.ok && good.angles.map((a) => a.funnel_stage).join() === 'tofu,tofu,mofu',
  good.ok ? good.angles.map((a) => a.funnel_stage).join() : '',
)

const wrongStage = validateBatch({ angles: [angle('tofu'), angle('tofu'), angle('bofu')] }, allowed, asked)
check('a batch returning an unassigned stage is rejected', !wrongStage.ok, wrongStage.ok ? 'was accepted' : wrongStage.reason)

const wrongCounts = validateBatch({ angles: [angle('tofu'), angle('mofu'), angle('mofu')] }, allowed, asked)
check('the right stages in the wrong numbers are rejected', !wrongCounts.ok, wrongCounts.ok ? 'was accepted' : wrongCounts.reason)

const missing = validateBatch(
  { angles: [angle('tofu'), angle('tofu'), { ...angle('mofu'), funnel_stage: undefined }] },
  allowed,
  asked,
)
check('a missing stage is rejected', !missing.ok, missing.ok ? 'was accepted' : missing.reason)
check(
  'the rejection names the expected stages',
  !missing.ok && missing.reason.includes('tofu'),
  missing.ok ? '' : missing.reason,
)

process.exit(failed ? 1 : 0)
