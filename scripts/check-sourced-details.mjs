// Free contract check for lib/agent/sourced-details.ts — no model call, no network.
// Run: node --experimental-strip-types scripts/check-sourced-details.mjs
import { findUnsourcedDetails, collectText } from '../lib/agent/sourced-details.ts'

let failed = 0
function expect(name, body, evidence, want) {
  const got = findUnsourcedDetails(body, evidence)
  const passed = JSON.stringify(got) === JSON.stringify(want)
  if (passed) {
    console.log(`ok: ${name}`)
  } else {
    failed++
    console.log(`FAIL: ${name} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
  }
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
if (JSON.stringify(out) === JSON.stringify(['a', 'b', '7', '3'])) {
  console.log('ok: collectText walks nested strings and numbers')
} else {
  failed++
  console.log(`FAIL: collectText — got ${JSON.stringify(out)}`)
}

process.exit(failed ? 1 : 0)
