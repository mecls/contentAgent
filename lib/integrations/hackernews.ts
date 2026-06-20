import type { ResearchItem } from '@/lib/integrations/exa'

/**
 * Hacker News research via the Algolia HN Search API — fully free, no auth, no
 * key. Replaces the paid Apify Reddit/X actors as our "what's the community
 * talking about" signal. Link posts come back without body text, so their
 * summary is left null for the jina enricher (lib/integrations/jina.ts) to fill
 * from the linked article. Pure call layer — no DB writes.
 */

const HN_SEARCH = 'https://hn.algolia.com/api/v1/search'
const RECENCY_DAYS = 14

interface HnHit {
  objectID: string
  title?: string | null
  url?: string | null
  author?: string | null
  points?: number | null
  story_text?: string | null
  created_at?: string | null
}

/** Strip the light HTML Algolia returns inside story_text (Ask/Show HN posts). */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/\s+/g, ' ')
    .trim()
}

async function searchOne(query: string, hitsPerPage: number, sinceTs: number): Promise<ResearchItem[]> {
  const params = new URLSearchParams({
    query,
    tags: 'story',
    hitsPerPage: String(hitsPerPage),
    // Recent stories only, ranked by Algolia relevance (which factors in points).
    numericFilters: `created_at_i>${sinceTs}`,
  })
  const res = await fetch(`${HN_SEARCH}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`hacker news search failed: ${res.status}`)
  const data = (await res.json()) as { hits?: HnHit[] }
  const hits = Array.isArray(data.hits) ? data.hits : []
  const out: ResearchItem[] = []
  for (const h of hits) {
    // Link posts carry an external url; text posts (Ask/Show HN) only have the HN permalink.
    const url = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`
    const text = h.story_text ? stripHtml(h.story_text) : ''
    out.push({
      source: 'hackernews',
      topic: query,
      title: h.title ?? null,
      url,
      summary: text || null,
      author: h.author ?? null,
      score: typeof h.points === 'number' ? h.points : null,
      published_at: h.created_at ?? null,
    })
  }
  return out
}

/** Search Hacker News for each keyword, returning recent, relevant stories. */
export async function hackerNewsSearch(queries: string[], perQuery = 5): Promise<ResearchItem[]> {
  if (queries.length === 0) return []
  const sinceTs = Math.floor((Date.now() - RECENCY_DAYS * 86_400_000) / 1000)
  const results = await Promise.allSettled(
    queries.slice(0, 6).map((q) => searchOne(q, perQuery, sinceTs)),
  )
  const out: ResearchItem[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') out.push(...r.value)
    else console.error('[hackernews] query failed', r.reason)
  }
  return out
}
