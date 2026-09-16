/**
 * The funnel: which stage of the buyer's journey a post serves, and the rules that
 * follow from it.
 *
 * This is a PRODUCT rule, not part of the skill. Miraside sells done-for-you AI agents
 * to business owners, founders and managers who are not technical, so most posts have
 * to be broad and jargon-free; the technical material that convinces someone already
 * close to deciding is a small share. SKILL.md stays the creator's own file and the
 * authority on voice, archetypes, constraints and honesty — a funnel written into the
 * skill is what drifted last time (private/tasks/prd-skill-recovery.md).
 *
 * Pure (no imports) so scripts/check-funnel.mjs runs it without a build.
 */

export type FunnelStage = 'tofu' | 'mofu' | 'bofu'

export const FUNNEL_STAGES: readonly FunnelStage[] = ['tofu', 'mofu', 'bofu']

export function isFunnelStage(value: unknown): value is FunnelStage {
  return value === 'tofu' || value === 'mofu' || value === 'bofu'
}

/** Short pill labels. The full names live in STAGE_LABELS_LONG for tooltips/headers. */
export const STAGE_LABELS: Record<FunnelStage, string> = {
  tofu: 'Top',
  mofu: 'Middle',
  bofu: 'Bottom',
}

export const STAGE_LABELS_LONG: Record<FunnelStage, string> = {
  tofu: 'Top of funnel',
  mofu: 'Middle of funnel',
  bofu: 'Bottom of funnel',
}

/** Pill tones. Teal/violet/brand don't collide with the status, stat or provenance pills. */
export const STAGE_TONES: Record<FunnelStage, string> = {
  tofu: 'bg-teal-100 text-teal-800',
  mofu: 'bg-violet-100 text-violet-800',
  bofu: 'bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]',
}

export type StageMixTarget = Record<FunnelStage, number>
export type StageCounts = Record<FunnelStage, number>

/** 6 posts in 10 reach new people, 3 prove it works for people like them, 1 asks for the call. */
export const DEFAULT_MIX: StageMixTarget = { tofu: 0.6, mofu: 0.3, bofu: 0.1 }

/** `config` key holding a per-account override of DEFAULT_MIX. */
export const FUNNEL_MIX_KEY = 'funnel_mix'

/** How many recent posts the allocator balances the next batch against. */
export const MIX_WINDOW_POSTS = 5

/** The window the Posts page counts, matching the app's other 7-day windows. */
export const MIX_WINDOW_DAYS = 7

const DAY_MS = 86_400_000
/** Floats: two shares computed differently can differ in the last bits and aren't a real tie. */
const EPSILON = 1e-9

const zeroCounts = (): StageCounts => ({ tofu: 0, mofu: 0, bofu: 0 })

/**
 * Read a stored mix. Takes shares (0.6) or posts per ten (6) and rescales to sum 1.
 * Anything missing, negative or unparseable falls back to DEFAULT_MIX, so a bad config
 * row can never stop a batch.
 */
export function normalizeMix(raw: unknown): StageMixTarget {
  if (!raw || typeof raw !== 'object') return DEFAULT_MIX
  const source = raw as Record<string, unknown>
  const values = zeroCounts()
  let total = 0
  for (const stage of FUNNEL_STAGES) {
    const value = Number(source[stage])
    if (!Number.isFinite(value) || value < 0) return DEFAULT_MIX
    values[stage] = value
    total += value
  }
  if (total <= 0) return DEFAULT_MIX
  return { tofu: values.tofu / total, mofu: values.mofu / total, bofu: values.bofu / total }
}

export function countStages(stages: readonly FunnelStage[]): StageCounts {
  const counts = zeroCounts()
  for (const stage of stages) counts[stage] += 1
  return counts
}

/**
 * The stages of the newest `limit` classified posts, newest first. Unclassified posts
 * are skipped rather than taking a slot: they were written before the funnel existed
 * and say nothing about the current balance.
 */
export function recentStageCounts(
  posts: readonly { funnel_stage?: string | null }[],
  opts: { limit?: number } = {},
): StageCounts {
  const limit = opts.limit ?? MIX_WINDOW_POSTS
  const counts = zeroCounts()
  let taken = 0
  for (const post of posts) {
    if (taken >= limit) break
    if (!isFunnelStage(post.funnel_stage)) continue
    counts[post.funnel_stage] += 1
    taken += 1
  }
  return counts
}

/** Posts created within `days` of `now`. `created_at` is the ISO string the database returns. */
export function withinDays<T extends { created_at?: string | null }>(
  posts: readonly T[],
  days: number = MIX_WINDOW_DAYS,
  now: number = Date.now(),
): T[] {
  const since = now - days * DAY_MS
  return posts.filter((post) => {
    const at = post.created_at ? Date.parse(post.created_at) : Number.NaN
    return Number.isFinite(at) && at >= since
  })
}

/**
 * Counts and shares over classified posts only. `total` is how many carried a stage, so
 * the caller can say "nothing classified yet" instead of rendering three zeroes.
 */
export function stageMix(posts: readonly { funnel_stage?: string | null }[]): {
  counts: StageCounts
  total: number
  shares: StageMixTarget
} {
  const counts = zeroCounts()
  let total = 0
  for (const post of posts) {
    if (!isFunnelStage(post.funnel_stage)) continue
    counts[post.funnel_stage] += 1
    total += 1
  }
  const shares = zeroCounts()
  for (const stage of FUNNEL_STAGES) shares[stage] = total > 0 ? counts[stage] / total : 0
  return { counts, total, shares }
}

/**
 * Which stage each of the next `n` posts should serve.
 *
 * Balances across the window rather than inside one batch: over `recent + n` posts each
 * stage has an ideal count, minus what the window already holds, and the n slots go to
 * the biggest debts — largest remainder first, ties to the stage the window has least
 * of. An empty window with n=10 gives exactly 6 tofu, 3 mofu, 1 bofu; a window full of
 * bofu gives none back.
 */
export function allocateStages(
  n: number,
  mix: StageMixTarget,
  recentCounts: StageCounts,
): FunnelStage[] {
  if (n <= 0) return []
  const recent: StageCounts = { ...zeroCounts(), ...recentCounts }
  const windowSize = FUNNEL_STAGES.reduce((sum, stage) => sum + (recent[stage] || 0), 0)
  const total = windowSize + n

  // What each stage is still owed over the whole window.
  const owed = zeroCounts()
  let owedTotal = 0
  for (const stage of FUNNEL_STAGES) {
    owed[stage] = Math.max(0, mix[stage] * total - (recent[stage] || 0))
    owedTotal += owed[stage]
  }
  // Every stage already overserved (a hand-edited window, or a mix that shrank): fall
  // back to the plain target so we still return n stages.
  if (owedTotal <= 0) {
    for (const stage of FUNNEL_STAGES) {
      owed[stage] = mix[stage]
      owedTotal += mix[stage]
    }
  }
  if (owedTotal <= 0) return Array.from({ length: n }, () => 'tofu' as FunnelStage)

  const exact = zeroCounts()
  const counts = zeroCounts()
  let assigned = 0
  for (const stage of FUNNEL_STAGES) {
    exact[stage] = (n * owed[stage]) / owedTotal
    counts[stage] = Math.floor(exact[stage])
    assigned += counts[stage]
  }

  // At most two slots are left over for three stages, so each gets at most one more.
  const byRemainder = [...FUNNEL_STAGES].sort((a, b) => {
    const remainder = exact[b] - counts[b] - (exact[a] - counts[a])
    if (Math.abs(remainder) > EPSILON) return remainder
    const starved = (recent[a] || 0) - (recent[b] || 0)
    if (starved !== 0) return starved
    return FUNNEL_STAGES.indexOf(a) - FUNNEL_STAGES.indexOf(b)
  })
  let i = 0
  while (assigned < n) {
    counts[byRemainder[i % byRemainder.length]] += 1
    assigned += 1
    i += 1
  }

  const out: FunnelStage[] = []
  for (const stage of FUNNEL_STAGES) {
    for (let k = 0; k < counts[stage]; k++) out.push(stage)
  }
  return out
}

// ── plain words ──────────────────────────────────────────────────────────────
// save_post's check that a tofu/mofu post reads like something a business owner would
// read. Deliberately a word list, not a model call: it is free, it runs the same way
// every time, and the terms it catches are the ones that make a post unreadable to a
// non-buyer. Bofu is exempt — that is where technical depth belongs.

/** Matched case-sensitively, so "rapid", "capability" and "therapy" stay clean. */
const JARGON_ACRONYMS = [
  'API', 'APIs', 'MCP', 'MCPs', 'LLM', 'LLMs', 'RAG', 'SDK', 'JSON', 'YAML', 'GPU', 'CRUD',
]

/** Matched case-insensitively, word-bounded. */
const JARGON_PHRASES = [
  'embedding', 'embeddings', 'vector database', 'vector databases', 'vector db', 'vector store',
  'fine-tune', 'fine-tuned', 'fine-tuning', 'langchain', 'llamaindex', 'crewai', 'autogen', 'n8n',
  'webhook', 'webhooks', 'endpoint', 'endpoints', 'inference', 'context window', 'token limit',
  'tokens', 'orchestration', 'latency', 'throughput', 'architecture', 'pipeline', 'backend',
  'infrastructure', 'codebase', 'repo', 'repository', 'function calling', 'multi-agent',
  'agentic', 'model weights', 'chunking', 'microservice', 'microservices',
]

/**
 * Never flagged. Masked out before the scan, so an allowed phrase also shields a banned
 * word inside it: the skill's own vocabulary says "leasing pipeline agent"
 * (SKILL.md's translation table), while a bare "pipeline" is still jargon.
 */
const ALLOWED_PHRASES = [
  'chatgpt', 'claude', 'gemini', 'copilot', 'ai agent', 'ai agents', 'agent', 'agents',
  'prompt', 'prompts', 'automation', 'automations', 'workflow', 'workflows', 'chatbot',
  'chatbots', 'spreadsheet', 'spreadsheets', 'inbox', 'sales pipeline', 'leasing pipeline',
  'deal pipeline', 'investor pipeline', 'hiring pipeline', 'recruitment pipeline',
]

const escapeRegex = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const wordBounded = (terms: readonly string[], flags: string) =>
  new RegExp(`\\b(?:${terms.map(escapeRegex).join('|')})\\b`, flags)

// Longest first, so "vector database" masks before "vector" could match something shorter.
const byLengthDesc = (terms: readonly string[]) => [...terms].sort((a, b) => b.length - a.length)

const ALLOWED_RE = wordBounded(byLengthDesc(ALLOWED_PHRASES), 'gi')
const ACRONYM_RE = wordBounded(byLengthDesc(JARGON_ACRONYMS), 'g')
const PHRASE_RE = wordBounded(byLengthDesc(JARGON_PHRASES), 'gi')

/**
 * The infrastructure terms in `body` that a non-technical reader won't parse, as they
 * are written, deduplicated, in the order they occur. Empty means the post is readable
 * — and always empty for bofu, which is allowed to be technical.
 */
export function findJargon(body: string, stage: FunnelStage): string[] {
  if (stage === 'bofu') return []
  // Blank out what's allowed, keeping offsets so matches still map back onto the body.
  const masked = body.replace(ALLOWED_RE, (match) => ' '.repeat(match.length))
  const found: { at: number; term: string }[] = []
  for (const match of masked.matchAll(ACRONYM_RE)) {
    found.push({ at: match.index, term: body.slice(match.index, match.index + match[0].length) })
  }
  for (const match of masked.toLowerCase().matchAll(PHRASE_RE)) {
    found.push({ at: match.index, term: body.slice(match.index, match.index + match[0].length) })
  }
  const seen = new Set<string>()
  return found
    .sort((a, b) => a.at - b.at)
    .map((f) => f.term)
    .filter((term) => {
      const key = term.toLowerCase()
      return seen.has(key) ? false : (seen.add(key), true)
    })
}

// ── prompt fragments ─────────────────────────────────────────────────────────
// Everything the prompts say about the funnel is built here, so scripts/check-funnel.mjs
// can assert the parts that change per batch without paying for a generation.

/** The one line that settles what the funnel decides and what the skill decides. */
export const FUNNEL_PRECEDENCE = `THE FUNNEL IS A PRODUCT RULE, NOT PART OF THE SKILL. SKILL.md stays the authority on audience, tribes, archetypes, voice, constraints and cadence; the stage definitions below come from the app and are not in SKILL.md. Where they meet: the assigned stage decides WHAT the post is for and how broad it has to be, and SKILL.md decides HOW it is written. Neither loosens the honesty rules — they agree: never invent clients, results, numbers or testimonials, and no engagement-bait CTAs.`

const STAGE_BRIEFS: Record<FunnelStage, string> = {
  tofu: `TOFU — attention and familiarity (about 60% of posts).
  For: someone who has never heard of Miguel or Miraside and isn't shopping for AI.
  Write about: Miguel's own day-to-day with his agents, told as a story or a habit;
  founder lessons — decisions, mistakes, wins, what running a young company is like;
  general business and personal topics most professionals relate to; productivity;
  copy-paste prompts a reader can use in their own work tomorrow.
  Tone: human, relatable, specific, zero jargon, readable in 20 seconds.
  Test: would a non-technical business owner understand and enjoy this with no
  background at all? If it needs any technical background, it is not tofu.`,
  mofu: `MOFU — proof for people like them (about 30% of posts).
  For: an owner who knows Miguel, finds AI interesting, but doesn't yet see how it
  applies to their own business.
  Write about: results for a TYPE of client, industry playbooks ("how a tourism company
  could...", "3 things a law firm could automate this month"), a before/after of one
  process in business terms (time spent, errors, response speed), the problems that keep
  coming up in one industry and how they get solved.
  Tone: outcome first — hours saved, faster replies, more leads handled — with the
  mechanism second and simple.
  Test: does it name a type of business and an outcome that owner actually wants?
  HONESTY: a real client result may only appear if the creator gave you the real numbers
  in this chat. Otherwise write the playbook form — "here is how a tourism company could
  run this" — phrased so it never implies it already happened. Never invent a client, a
  testimonial or a result.`,
  bofu: `BOFU — convert (about 10% of posts, the smallest share).
  For: someone already weighing whether Miraside is the right partner.
  Write about: how a system was actually built, reliability, security, integrations, why
  it doesn't break; how working with Miraside works — process, timeline, how little the
  client has to do, the 30-day money-back guarantee; or a direct invitation ("if you run
  X and struggle with Y, send me a message").
  Tone: credible and precise. Technical detail is allowed HERE and only here — and the
  post must still OPEN with the business problem before any technical detail.
  Test: does it open with the business problem, and is every claim defensible?`,
}

export function stageBriefText(stage: FunnelStage): string {
  return STAGE_BRIEFS[stage]
}

/** The three definitions plus the plain-words rule, shared by every prompt. */
export function stageRulesBlock(): string {
  return [
    'THE THREE FUNNEL STAGES',
    FUNNEL_STAGES.map((stage) => STAGE_BRIEFS[stage]).join('\n\n'),
    `PLAIN WORDS (tofu and mofu): the reader is a non-technical business owner. Do not use infrastructure terms — API, MCP, LLM, RAG, embeddings, tokens, vector databases, fine-tuning, tool names like LangChain or n8n, or architecture/pipeline talk. Product names people actually use are fine: ChatGPT, Claude, "AI agent". Saving a tofu or mofu post containing those terms is refused automatically.`,
  ].join('\n\n')
}

/** The per-angle assignment for one batch, in the order the angles must come back. */
export function stageAssignmentBlock(stages: readonly FunnelStage[]): string {
  return [
    'ASSIGNED FUNNEL STAGES (copy these into "funnel_stage", in order):',
    ...stages.map((stage, i) => `- Angle ${i + 1}: ${stage}`),
  ].join('\n')
}

/** What the recent window holds, so the model can see why it was given these stages. */
export function recentMixLine(counts: StageCounts, mix: StageMixTarget): string {
  const total = FUNNEL_STAGES.reduce((sum, stage) => sum + counts[stage], 0)
  const held = FUNNEL_STAGES.map((stage) => `${stage} ${counts[stage]}`).join(', ')
  const target = FUNNEL_STAGES.map((stage) => Math.round(mix[stage] * 100)).join('/')
  return total === 0
    ? `RECENT MIX: no classified posts yet. Target ${target}. The stages above start the balance.`
    : `RECENT MIX (last ${total} classified post${total === 1 ? '' : 's'}): ${held}. Target ${target}. The stages above already correct it.`
}
