// Free check for lib/integrations/research-window.ts — no model call, no network.
// Run: node --experimental-strip-types scripts/check-research-window.mjs
import { RESEARCH_WINDOW, pickResearchWindow } from '../lib/integrations/research-window.ts'

let failed = 0
function check(name, passed, detail = '') {
  if (passed) {
    console.log(`ok: ${name}`)
  } else {
    failed++
    console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const rows = (topic, n) => Array.from({ length: n }, (_, i) => ({ topic, url: `${topic}-${i}` }))
const countBy = (list) => list.reduce((m, r) => m.set(r.topic, (m.get(r.topic) ?? 0) + 1), new Map())

// The shape that filled Choose with one subject: the same stories searched again
// and again, newest first, ahead of a balanced run.
const flooded = [
  ...rows('EliseAI $250M Series E', 12),
  ...rows('NAA AI adoption survey', 8),
  ...rows('senior engineers AI identity', 5),
  ...rows('multi-site service AI systems', 5),
  ...rows('operator AI efficiency case studies', 5),
  ...rows('AI identity, low-code vs custom (LinkedIn)', 27),
]
const picked = pickResearchWindow(flooded, RESEARCH_WINDOW)
const counts = countBy(picked)

check('no search gives more than 3 items', [...counts.values()].every((n) => n <= 3), JSON.stringify([...counts]))
check('every search is represented', counts.size === 6, `${counts.size} searches`)
check('18 items, not 20 of two stories', picked.length === 18, `${picked.length} items`)
check(
  'newest-first order is kept',
  picked.map((r) => r.url).join() === flooded.filter((r) => Number(r.url.split('-').at(-1)) < 3).map((r) => r.url).join(),
)

const many = Array.from({ length: 10 }, (_, i) => rows(`search ${i}`, 3)).flat()
check('stops at the limit', pickResearchWindow(many, RESEARCH_WINDOW).length === 20)
check('items without a topic count as one search', pickResearchWindow(rows(null, 5), RESEARCH_WINDOW).length === 3)
check('empty stays empty', pickResearchWindow([], RESEARCH_WINDOW).length === 0)

process.exit(failed ? 1 : 0)
