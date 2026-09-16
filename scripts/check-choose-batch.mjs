// Free contract check for lib/choose/batch.ts — no model call, no network.
// Run: node --experimental-strip-types scripts/check-choose-batch.mjs
import { validateBatch, buildDraftPrompt } from '../lib/choose/batch.ts'

const URL_A = 'https://example.com/research-a'
const URL_B = 'https://example.com/research-b'
const allowed = new Set([URL_A, URL_B])

// The stages the app assigned for this batch; validateBatch checks the angles against it.
const STAGES = ['tofu', 'tofu', 'mofu']

const sourced = (sources) => ({
  tribe: 'Owners of small accounting firms',
  archetype: 'Resonance',
  hook: "It's 9pm on the 3rd and the bank feed is wrong again.",
  tension: 'The job built to give freedom became the one nobody else can do.',
  why_now: 'Month-end close season.',
  funnel_stage: 'tofu',
  provenance: 'sourced',
  sources,
  story_prompt: null,
})

const yourStory = (storyPrompt) => ({
  tribe: 'Operators of multi-site service businesses',
  archetype: 'Builder Learnings',
  hook: 'The automation that saved nobody an hour.',
  tension: 'Tools do not fix work nobody has defined.',
  why_now: 'Everyone is buying agents this quarter.',
  funnel_stage: 'mofu',
  provenance: 'your-story',
  sources: [],
  story_prompt: storyPrompt,
})

const STORY = 'When did an automation you built fail on its first day?'
const valid = () => ({ angles: [sourced([URL_A]), sourced([URL_A, URL_B]), yourStory(STORY)] })

let failed = 0
function check(name, passed, detail = '') {
  if (passed) {
    console.log(`ok: ${name}`)
  } else {
    failed++
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}
function rejects(name, raw, expected) {
  const result = validateBatch(raw, allowed, STAGES)
  check(name, !result.ok && result.reason.includes(expected), result.ok ? 'was accepted' : result.reason)
}

const accepted = validateBatch(valid(), allowed, STAGES)
check('valid batch (2 sourced + 1 your-story) accepted', accepted.ok, accepted.ok ? '' : accepted.reason)

rejects('2 angles rejected', { angles: valid().angles.slice(0, 2) }, 'expected 3 angles')
rejects(
  'unknown source URL rejected',
  { angles: [sourced(['https://example.com/made-up']), ...valid().angles.slice(1)] },
  'source not in research',
)
rejects(
  'story_prompt without ? rejected',
  { angles: [...valid().angles.slice(0, 2), yourStory('Tell me about an automation that failed')] },
  'story_prompt must be a question',
)
rejects(
  '3 sources rejected',
  { angles: [sourced([URL_A, URL_B, URL_A]), ...valid().angles.slice(1)] },
  'needs 1-2 sources',
)
const longHook = valid()
longHook.angles[0].hook = 'x'.repeat(281)
rejects('281-character hook rejected', longHook, 'hook must be 1-280 characters')

const storyPrompt = buildDraftPrompt(yourStory(STORY))
check(
  'your-story prompt asks first and forbids inventing',
  storyPrompt.includes(STORY) && storyPrompt.includes('do not invent the moment'),
)
const sourcedPrompt = buildDraftPrompt(sourced([URL_A, URL_B]))
check(
  'sourced prompt carries both URLs',
  sourcedPrompt.includes(URL_A) && sourcedPrompt.includes(URL_B) && !sourcedPrompt.includes('do not invent'),
)

process.exit(failed ? 1 : 0)
