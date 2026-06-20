import { env } from '@/lib/env'
import type { ResearchItem } from '@/lib/integrations/exa'

/**
 * Apify-backed research source: LinkedIn top-content. (Reddit + X were dropped in
 * favour of the free Hacker News API + Jina Reader; this is the one research
 * source that still has no free equivalent.)
 *
 * The actor slug + input shape are declared as constants and easy to swap; the
 * output normalizer is intentionally defensive (tries many common field names)
 * because the actor's JSON shape can drift. Pure call layer — no DB writes.
 */

// Swappable actor slug (Apify "username~actor" form for the REST endpoint).
const LINKEDIN_TOPCONTENT_ACTOR = 'lexis-solutions~linkedin-top-content-scraper'

function runSyncUrl(actor: string): string {
  return `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items`
}

async function runApifyActor(actor: string, input: unknown): Promise<unknown[]> {
  const token = env.apifyToken()
  if (!token) throw new Error('APIFY_TOKEN is not configured — cannot run research.')
  const res = await fetch(runSyncUrl(actor), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`apify ${actor} failed: ${res.status} ${text.slice(0, 300)}`)
  }
  const data = await res.json()
  return Array.isArray(data) ? (data as unknown[]) : []
}

type Rec = Record<string, unknown>
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
/** Numbers, or count-like strings ("1,234", "5.2K reactions"). */
const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const m = v.replace(/,/g, '').match(/([\d.]+)\s*([kKmM]?)/)
    if (m) {
      const base = Number(m[1])
      if (Number.isFinite(base)) {
        const mult = m[2].toLowerCase() === 'k' ? 1e3 : m[2].toLowerCase() === 'm' ? 1e6 : 1
        return Math.round(base * mult)
      }
    }
  }
  return null
}

/** Defensive mapper from a heterogeneous actor item → ResearchItem. */
function normalize(
  item: Rec,
  source: ResearchItem['source'],
  topic: string | null,
): ResearchItem | null {
  const url =
    str(item.url) ?? str(item.postUrl) ?? str(item.link) ?? str(item.tweetUrl) ?? str(item.permalink)
  if (!url) return null
  // author may be a plain string (reddit username / linkedin name) or an object
  // ({ userName } on X, { name } elsewhere).
  const authorObj = (
    item.author && typeof item.author === 'object' ? item.author : item.user
  ) as Rec | undefined
  const author =
    str(item.author) ??
    str(item.username) ??
    str(item.authorName) ??
    str(authorObj?.userName) ??
    str(authorObj?.name)
  const summary =
    str(item.text) ??
    str(item.body) ??
    str(item.content) ??
    str(item.description) ??
    str(item.selftext) ??
    str(item.summary)
  const score =
    num(item.score) ??
    num(item.upVotes) ??
    num(item.ups) ??
    num(item.likeCount) ??
    num(item.numLikes) ??
    num(item.favoriteCount) ??
    num(item.reactions)
  const published =
    str(item.createdAt) ??
    str(item.created_at) ??
    str(item.postedAt) ??
    str(item.publishedAt) ??
    str(item.date)
  return {
    source,
    topic,
    title: str(item.title) ?? str(item.name),
    url,
    summary,
    author,
    score,
    published_at: published,
  }
}

function normalizeAll(items: unknown[], source: ResearchItem['source'], topic: string | null) {
  const out: ResearchItem[] = []
  for (const it of items) {
    if (it && typeof it === 'object') {
      const r = normalize(it as Rec, source, topic)
      if (r) out.push(r)
    }
  }
  return out
}

function topContentUrl(topic: string): string {
  const slug = topic.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `https://www.linkedin.com/top-content/${slug}/`
}

/** LinkedIn top-content for the given pillar topics. */
export async function linkedinTopContent(topics: string[], perTopic = 5): Promise<ResearchItem[]> {
  if (topics.length === 0) return []
  const items = await runApifyActor(LINKEDIN_TOPCONTENT_ACTOR, {
    urls: topics.map(topContentUrl),
    maxItems: topics.length * perTopic,
  })
  return normalizeAll(items, 'linkedin', topics.join(', '))
}
