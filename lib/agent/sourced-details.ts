// save_post's check that a post's concrete details have a real source.
//
// A detail is a number, amount or percentage ("46%", "$250M"), a duration ("three
// weeks"), a clock time ("7 AM") or a weekday. It is sourced when the same detail
// appears in the evidence: what the agent loaded this run from the skill, research,
// search and analytics tools, plus the creator's own messages.
//
// Deliberately narrow: it catches invented specifics that carry a number, time or
// day — the kind drafts kept inventing ("said Tuesday and it's now Thursday", "a
// client you haven't called in six weeks") — not invented objects without one.
// Pure (no imports) so scripts/check-sourced-details.mjs runs it without a build.

/** Tools whose results count as real sources. Posts and competitor posts don't: saved drafts may hold invented details, and competitors' claims aren't the creator's. */
export const EVIDENCE_TOOLS = new Set([
  'read_skill',
  'list_research',
  'search_news',
  'get_tag_performance',
  'get_format_performance',
  'analyze_format_trends',
  'reconcile_analytics',
])

const NUMBER_WORDS: Record<string, string> = {
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8',
  nine: '9', ten: '10', eleven: '11', twelve: '12', fifteen: '15', twenty: '20',
  thirty: '30', forty: '40', fifty: '50', sixty: '60', ninety: '90', hundred: '100',
}
const WEEKDAYS = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])

const NUM = '\\d[\\d,]*(?:\\.\\d+)?'
// An optional range start ("2-3 weeks") is part of the duration, so a range only
// sources the same range: a "2-3 weeks" cadence rule in a skill must not source an
// invented "three weeks ago".
const DURATION = new RegExp(
  `\\b(?:(${NUM})\\s?-\\s?)?(${NUM}|${Object.keys(NUMBER_WORDS).join('|')})[\\s-]+(minute|hour|day|week|month|year|quarter)s?\\b`,
  'g',
)
const CLOCK = /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\b/g
const AMOUNT = new RegExp(`([$€£])?(${NUM})(\\s?%|\\s?(?:k|m|bn|b|million|billion)\\b)?`, 'g')

interface Evidence {
  numbers: Set<string>
  durations: Set<string>
  clocks: Set<string>
  weekdayPairs: Set<string>
}

// Lowercase, and fold the dash, quote and space variants writers emit, so
// "time‑consuming" (U+2011) and "5-day" compare equal.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[  ]/g, ' ')
}

const numberKey = (raw: string) => NUMBER_WORDS[raw] ?? raw.replace(/,/g, '')
const durationKey = (m: RegExpMatchArray) => `${m[1] ? `${numberKey(m[1])}-` : ''}${numberKey(m[2])} ${m[3]}`
const trimPunctuation = (s: string) => s.trim().replace(/[,.]+$/, '')

// Word pairs that contain a weekday: "sunday morning" in the evidence sources
// "a Sunday morning" in a post, but a bare "Tuesday" elsewhere doesn't.
function weekdayPairs(text: string): { day: string; pairs: string[] }[] {
  const words = text.match(/[a-z0-9']+/g) ?? []
  const out: { day: string; pairs: string[] }[] = []
  words.forEach((w, i) => {
    if (!WEEKDAYS.has(w)) return
    const pairs: string[] = []
    if (i > 0) pairs.push(`${words[i - 1]} ${w}`)
    if (i < words.length - 1) pairs.push(`${w} ${words[i + 1]}`)
    out.push({ day: w, pairs })
  })
  return out
}

function indexEvidence(texts: string[]): Evidence {
  const ev: Evidence = { numbers: new Set(), durations: new Set(), clocks: new Set(), weekdayPairs: new Set() }
  for (const raw of texts) {
    const text = normalize(raw)
    for (const m of text.matchAll(DURATION)) ev.durations.add(durationKey(m))
    for (const m of text.matchAll(CLOCK)) ev.clocks.add(`${m[1]}:${m[2] ?? '00'}${m[3]}`)
    for (const m of text.matchAll(AMOUNT)) ev.numbers.add(numberKey(m[2]))
    for (const { pairs } of weekdayPairs(text)) pairs.forEach((p) => ev.weekdayPairs.add(p))
  }
  return ev
}

/**
 * The details in `body` that appear nowhere in `evidence`, as lowercase snippets in
 * the order they occur (deduplicated). Empty means every detail has a source.
 */
export function findUnsourcedDetails(body: string, evidence: string[]): string[] {
  const ev = indexEvidence(evidence)
  const text = normalize(body)
  const found: { at: number; snippet: string }[] = []
  const taken: [number, number][] = []

  for (const m of text.matchAll(DURATION)) {
    taken.push([m.index, m.index + m[0].length])
    if (!ev.durations.has(durationKey(m))) found.push({ at: m.index, snippet: m[0] })
  }
  for (const m of text.matchAll(CLOCK)) {
    taken.push([m.index, m.index + m[0].length])
    if (!ev.clocks.has(`${m[1]}:${m[2] ?? '00'}${m[3]}`)) found.push({ at: m.index, snippet: m[0] })
  }
  for (const m of text.matchAll(AMOUNT)) {
    // A number inside a duration or clock time was already judged as part of it.
    if (taken.some(([start, end]) => m.index >= start && m.index < end)) continue
    if (!ev.numbers.has(numberKey(m[2]))) found.push({ at: m.index, snippet: trimPunctuation(m[0]) })
  }
  let cursor = 0
  for (const { day, pairs } of weekdayPairs(text)) {
    const at = text.indexOf(day, cursor)
    cursor = at + day.length
    if (!pairs.some((p) => ev.weekdayPairs.has(p))) found.push({ at, snippet: day })
  }

  const seen = new Set<string>()
  return found
    .sort((a, b) => a.at - b.at)
    .map((f) => f.snippet)
    .filter((s) => (seen.has(s) ? false : (seen.add(s), true)))
}

// ── model review ─────────────────────────────────────────────────────────────
// The pattern check can't see invented scenes with no number or day ("the call you
// took last winter"), so save_post also asks the writer model which concrete
// details the evidence doesn't support. These are the pure parts (prompt and
// parsing); lib/agent/review-details.ts makes the call.

export const MAX_REVIEW_EVIDENCE_CHARS = 150_000
const MAX_UNSUPPORTED = 12

export interface UnsupportedDetail {
  quote: string
  reason: string
}
export type DetailReview = { ok: true; unsupported: UnsupportedDetail[] } | { ok: false }

export const REVIEW_SYSTEM = `You check a social media post for invented details before it is saved. The creator publishes only real stories and facts.

Find every concrete detail in the POST: a specific scene, situation, incident, event, story, conversation, quote, person, customer, company, product, place, time, season, count or number — including situations written to the reader as "you" (for example "the call you took last winter", "the review scheduled between two meetings and a fire drill", "You have three").

A detail is SUPPORTED when the EVIDENCE states it or plainly describes the same thing: a figure a source reports, a line or object the skill records, or something the creator said. The wording may differ.

Do not list:
- general statements and opinions with no specific scene ("reporting drags into the night", "coordination eats the day");
- the creator's own framing, positioning and questions ("this is the problem I work on", "which one sounds like you?");
- ordinary terms of the trade (invoices, tickets, pipeline).

List only the unsupported concrete details. Quote each one exactly as it appears in the post (a short phrase of at most 12 words) and give a short reason.

Return only JSON: {"unsupported": [{"quote": "...", "reason": "..."}]}. Return {"unsupported": []} when every concrete detail is supported.`

/** The review's user message: the deduplicated evidence (capped), then the post. */
export function buildReviewUser(body: string, evidence: string[]): string {
  let sources = [...new Set(evidence.map((e) => e.trim()).filter(Boolean))].join('\n\n')
  if (sources.length > MAX_REVIEW_EVIDENCE_CHARS) sources = sources.slice(0, MAX_REVIEW_EVIDENCE_CHARS)
  return ['EVIDENCE (the only real sources):', '<<<', sources, '>>>', '', 'POST:', '<<<', body, '>>>'].join('\n')
}

const foldQuote = (s: string) =>
  normalize(s)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["']+|["'.,;:!?]+$/g, '')

/**
 * Validates the review model's JSON. `{ ok: false }` when it isn't the expected
 * shape. Quotes that don't occur in the post are dropped: the agent can't rewrite a
 * line that isn't there, and keeping them would loop the save.
 */
export function parseReview(raw: unknown, body: string): DetailReview {
  const list = raw && typeof raw === 'object' ? (raw as { unsupported?: unknown }).unsupported : undefined
  if (!Array.isArray(list)) return { ok: false }
  const post = normalize(body).replace(/\s+/g, ' ')
  const seen = new Set<string>()
  const unsupported: UnsupportedDetail[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const { quote, reason } = item as { quote?: unknown; reason?: unknown }
    if (typeof quote !== 'string') continue
    const folded = foldQuote(quote)
    if (!folded || !post.includes(folded) || seen.has(folded)) continue
    seen.add(folded)
    unsupported.push({ quote: quote.trim(), reason: typeof reason === 'string' ? reason.trim() : '' })
    if (unsupported.length === MAX_UNSUPPORTED) break
  }
  return { ok: true, unsupported }
}

/** Appends every string and number inside a tool result to `out` (walks arrays and objects). */
export function collectText(value: unknown, out: string[]): void {
  if (typeof value === 'string') out.push(value)
  else if (typeof value === 'number') out.push(String(value))
  else if (Array.isArray(value)) value.forEach((v) => collectText(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectText(v, out))
}
