import { env } from '@/lib/env'

/**
 * Exa (exa.ai) web/blog research search. Returns LLM-ready results with AI
 * summaries so we don't have to fetch + summarize pages ourselves.
 *
 * Pure call layer — no DB writes (mirrors lib/integrations/apify.ts).
 */

const SEARCH_URL = 'https://api.exa.ai/search'

export interface ResearchItem {
  source: 'web' | 'hackernews' | 'linkedin'
  topic: string | null
  title: string | null
  url: string
  summary: string | null
  author: string | null
  score: number | null
  published_at: string | null
}

interface ExaResult {
  title?: string
  url?: string
  publishedDate?: string
  author?: string
  score?: number
  summary?: string
}

/**
 * Search the web for a query, returning summarized results. `category` can scope
 * Exa to e.g. 'news' or be omitted for general web. Throws on missing key / non-2xx.
 */
export async function exaSearch(opts: {
  query: string
  numResults?: number
  category?: string
  topic?: string
}): Promise<ResearchItem[]> {
  const key = env.exaApiKey()
  if (!key) throw new Error('EXA_API_KEY is not configured — cannot run web research.')

  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key },
    body: JSON.stringify({
      query: opts.query,
      numResults: opts.numResults ?? 6,
      type: 'auto',
      ...(opts.category ? { category: opts.category } : {}),
      // Ask Exa for an AI summary of each result's page content.
      contents: { summary: true },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`exa search failed: ${res.status} ${text.slice(0, 300)}`)
  }

  const data = (await res.json()) as { results?: ExaResult[] }
  const results = Array.isArray(data.results) ? data.results : []
  const out: ResearchItem[] = []
  for (const r of results) {
    if (!r.url) continue
    out.push({
      source: 'web',
      topic: opts.topic ?? opts.query,
      title: r.title ?? null,
      url: r.url,
      summary: r.summary ?? null,
      author: r.author ?? null,
      score: typeof r.score === 'number' ? r.score : null,
      published_at: r.publishedDate ?? null,
    })
  }
  return out
}
