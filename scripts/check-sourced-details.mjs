// Free contract check for lib/agent/sourced-details.ts — no model call, no network.
// Run: node --experimental-strip-types scripts/check-sourced-details.mjs
import {
  findUnsourcedDetails,
  collectText,
  parseReview,
  buildReviewUser,
  decideAfterReview,
  tagsWithNeedsCheck,
  quoteList,
  NEEDS_CHECK_TAG,
  REVIEW_SYSTEM,
  MAX_REVIEW_EVIDENCE_CHARS,
} from '../lib/agent/sourced-details.ts'

let failed = 0
function check(name, passed, detail = '') {
  if (passed) {
    console.log(`ok: ${name}`)
  } else {
    failed++
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}
function expect(name, body, evidence, want) {
  const got = findUnsourcedDetails(body, evidence)
  check(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

// Made-up skill text: weekdays appear, but only as posting guidance.
const SKILL = [
  'Best window: Tuesday or Wednesday, 1:00 PM.',
  'Thursday 1 PM is acceptable.',
  'Tribal objects: the overflowing inbox on a Sunday morning.',
  'Not a $30k retainer from someone who has never shipped one.',
  'Top post: 12,300 impressions, 48 comments. Once per 2-3 weeks maximum.',
]
const RESEARCH = [
  'Handling client requests is the top time sink for managers at 38%.',
  'Startup Acme raises $120M at $1.5B valuation',
]

// ── pattern check ──
expect(
  'invented days and durations are caught',
  "Chasing a supplier who said they'd deliver Tuesday and it's now Thursday\nAnswering a client you haven't called in six weeks",
  [...SKILL, ...RESEARCH],
  ['tuesday', 'thursday', 'six weeks'],
)
expect(
  'details from the skill and research pass',
  "38% of managers say client requests are the most time‑consuming part of the job.\nAcme just raised $120M at a $1.5B valuation.\nClearing the overflowing inbox on a Sunday morning.\nNot a $30k retainer from someone who's never done the work.",
  [...SKILL, ...RESEARCH],
  [],
)
expect(
  "the creator's own words source a detail",
  'Explaining why a request from three weeks ago is still open',
  ['It was 3 weeks ago, a real one from my call with a client'],
  [],
)
expect('clock times match across formats', 'Posted at 1 PM, drafted at 11 PM.', SKILL, ['11 pm'])
expect('a number must match, commas ignored', '12300 impressions, then 16,000 impressions.', SKILL, ['16,000'])
expect('a duration needs its unit, not just the number', 'Reply within 48 hours.', SKILL, ['48 hours'])
expect('dash variants fold together', 'A 5‑day rollout.', ['a 5-day rollout'], [])
expect(
  'a range in the evidence does not source a single duration',
  'Explaining why a request from three weeks ago is still open.',
  SKILL,
  ['three weeks'],
)
expect('the same range is sourced', 'One provocative post per 2–3 weeks.', SKILL, [])
expect('invented amounts are caught', 'Not a $60k hire. Room 3B.', SKILL, ['$60k'])

const out = []
collectText({ skill_md: 'a', items: [{ summary: 'b', score: 7 }, null], n: 3 }, out)
check('collectText walks nested strings and numbers', JSON.stringify(out) === JSON.stringify(['a', 'b', '7', '3']))

// ── model review parsing ──
const POST = 'The call you took last winter.\nReporting drags into the night.\nNot another dashboard. You have three.'
const review = parseReview(
  {
    unsupported: [
      { quote: 'the call you took last winter', reason: 'not in the sources' },
      { quote: '“You have three.”', reason: 'invented count' },
      { quote: 'a line the model made up', reason: 'not in the post' },
      { quote: 'The call you took last winter', reason: 'duplicate' },
    ],
  },
  POST,
)
check(
  'review keeps quotes found in the post, drops made-up and duplicate ones',
  review.ok && JSON.stringify(review.unsupported.map((u) => u.quote)) === JSON.stringify(['the call you took last winter', '“You have three.”']),
  JSON.stringify(review),
)
const clean = parseReview({ unsupported: [] }, POST)
check('a review with nothing unsupported passes', clean.ok && clean.unsupported.length === 0)
check(
  'an unusable review response fails closed',
  !parseReview(null, POST).ok && !parseReview({ verdict: 'fine' }, POST).ok && !parseReview('{"unsupported":[]}', POST).ok,
)
const dashed = parseReview({ unsupported: [{ quote: 'a 5-day rollout', reason: '' }] }, 'A 5‑day rollout.')
check('review quotes match across dash variants', dashed.ok && dashed.unsupported.length === 1)

// ── what save_post does after the review ──
const flaggedReview = { ok: true, unsupported: [{ quote: 'the call you took last winter', reason: '' }] }
check('a clean review saves', decideAfterReview({ ok: true, unsupported: [] }, 0) === 'save')
check(
  'a flagged review refuses once, then saves tagged',
  decideAfterReview(flaggedReview, 0) === 'refuse' && decideAfterReview(flaggedReview, 1) === 'save-flagged',
)
check(
  'a failed review refuses once, then saves tagged',
  decideAfterReview({ ok: false }, 0) === 'refuse' && decideAfterReview({ ok: false }, 1) === 'save-flagged',
)
check(
  'the needs-fact-check tag is added once',
  JSON.stringify(tagsWithNeedsCheck(['ai', NEEDS_CHECK_TAG])) === JSON.stringify(['ai', NEEDS_CHECK_TAG]) &&
    JSON.stringify(tagsWithNeedsCheck(undefined)) === JSON.stringify([NEEDS_CHECK_TAG]),
)
check('flagged lines are quoted for the agent', quoteList([{ quote: 'a', reason: '' }, { quote: 'b', reason: '' }]) === '"a"; "b"')
check(
  'the review prompt keeps kinds of work and evidence terms out of scope',
  REVIEW_SYSTEM.includes('kinds of work') && REVIEW_SYSTEM.includes('appears in the EVIDENCE') && REVIEW_SYSTEM.includes('When in doubt, do not list it'),
)

const user = buildReviewUser('POST BODY', ['same', 'same', 'x'.repeat(MAX_REVIEW_EVIDENCE_CHARS + 500)])
check(
  'review prompt dedupes and caps the evidence, then includes the post',
  user.split('same').length === 2 && user.endsWith('POST BODY\n>>>') && user.length < MAX_REVIEW_EVIDENCE_CHARS + 200,
  `length ${user.length}`,
)

process.exit(failed ? 1 : 0)
