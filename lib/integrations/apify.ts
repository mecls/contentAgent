import { env } from '@/lib/env'

/**
 * Apify integration: run the `harvestapi/linkedin-profile-posts` actor for a
 * profile URL and return normalized post items.
 *
 * Pure call layer — no DB writes (mirrors how lib/skills/store.ts is the sole DB
 * module). The caller persists results via lib/db/scraped-posts.ts.
 *
 * IMPORTANT: this actor returns only PUBLIC engagement (likes/reactions,
 * comments, reposts). It does NOT return impressions/views — those are private
 * to the post author and can't be scraped. Impressions stay a manual value the
 * user enters; engagement_rate is computed only when impressions are present.
 */

const ACTOR = 'harvestapi~linkedin-profile-posts'
const RUN_SYNC_URL = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items`

export interface ScrapeOptions {
  profileUrl: string
  /** Max posts to pull per run. Bounds volume; keep well under the 300s sync cap. */
  maxPosts?: number
  /**
   * Optional time-window filter ('24h' | 'week' | 'month'). Leave UNSET to pull
   * the latest `maxPosts` regardless of age — important because a post keeps
   * gaining engagement for weeks, and the creator may post less than weekly.
   */
  postedLimit?: string
}

export interface ScrapedItem {
  source_url: string
  author: string | null
  content: string | null
  image_url: string | null
  reactions: number
  comments: number
  reposts: number
  posted_at: string | null
}

/**
 * Shape of the relevant fields the actor returns per post (loosely typed).
 * Engagement counts are NESTED under `engagement`; `postedAt` is an object.
 * Top-level fallbacks are kept in case the actor version flattens them.
 */
interface ActorEngagement {
  likes?: number
  comments?: number
  shares?: number
  reactions?: unknown[]
}
interface ActorPost {
  type?: string
  linkedinUrl?: string
  url?: string
  content?: string
  text?: string
  postedAt?: { timestamp?: number; date?: string } | string
  engagement?: ActorEngagement
  // media — the actor's field name varies by version, so we check several shapes.
  images?: Array<string | { url?: string; src?: string }>
  image?: string | { url?: string; src?: string }
  media?: Array<{ url?: string; src?: string; image?: { url?: string }; type?: string }>
  thumbnail?: string | { url?: string }
  // top-level fallbacks
  likes?: number
  comments?: number
  shares?: number
  reactions?: unknown[]
  author?: { name?: string }
}

function toCount(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** Pull an http(s) URL out of a string or a {url|src|image:{url}} object. */
function toUrl(v: unknown): string | null {
  if (typeof v === 'string') return v.startsWith('http') ? v : null
  if (v && typeof v === 'object') {
    const o = v as { url?: unknown; src?: unknown; image?: { url?: unknown } }
    if (typeof o.url === 'string' && o.url.startsWith('http')) return o.url
    if (typeof o.src === 'string' && o.src.startsWith('http')) return o.src
    if (o.image && typeof o.image.url === 'string' && o.image.url.startsWith('http')) {
      return o.image.url
    }
  }
  return null
}

/** First usable image URL from whichever media field the actor populated. */
function extractImage(item: ActorPost): string | null {
  if (Array.isArray(item.images)) {
    for (const x of item.images) {
      const u = toUrl(x)
      if (u) return u
    }
  }
  const single = toUrl(item.image)
  if (single) return single
  if (Array.isArray(item.media)) {
    for (const x of item.media) {
      const u = toUrl(x)
      if (u) return u
    }
  }
  return toUrl(item.thumbnail)
}

/** Normalize the actor's `postedAt` (object or string) to an ISO/date string. */
function toPostedAt(raw: ActorPost['postedAt']): string | null {
  if (!raw) return null
  if (typeof raw === 'string') return raw
  if (raw.date) return raw.date
  if (typeof raw.timestamp === 'number') return new Date(raw.timestamp).toISOString()
  return null
}

/**
 * Run the actor synchronously and return its dataset items, normalized. Posts
 * without a resolvable URL are skipped (a URL is required to dedupe and to match
 * against a saved post).
 */
export async function scrapeProfilePosts({
  profileUrl,
  maxPosts = 50,
  postedLimit,
}: ScrapeOptions): Promise<ScrapedItem[]> {
  const token = env.apifyToken()
  if (!token) {
    throw new Error('APIFY_TOKEN is not configured — cannot scrape LinkedIn.')
  }

  // scrapeReactions/scrapeComments are OFF: enabling them emits one dataset item
  // per reactor/commenter (80+ junk rows for a handful of posts) and costs more.
  // The aggregate counts we need already live on each post's `engagement` object.
  // includeReposts OFF so the table holds the creator's own posts, not reshares.
  const res = await fetch(RUN_SYNC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      targetUrls: [profileUrl],
      maxPosts,
      ...(postedLimit ? { postedLimit } : {}),
      includeReposts: false,
      scrapeReactions: false,
      scrapeComments: false,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`apify scrape failed: ${res.status} ${text.slice(0, 300)}`)
  }

  const items = (await res.json()) as ActorPost[]
  if (!Array.isArray(items)) return []

  const normalized: ScrapedItem[] = []
  for (const item of items) {
    // The dataset can mix in non-post records (reactions/comments) — keep posts.
    if (item.type && item.type !== 'post') continue
    const source_url = item.linkedinUrl ?? item.url ?? null
    if (!source_url) continue // can't dedupe or match without a URL
    // Engagement is nested under `engagement`; fall back to top-level fields.
    const eng = item.engagement ?? item
    const reactionsArr = Array.isArray(eng.reactions) ? eng.reactions : undefined
    normalized.push({
      source_url,
      author: item.author?.name ?? null,
      content: item.content ?? item.text ?? null,
      image_url: extractImage(item),
      // Prefer the aggregate `likes` count; fall back to the (sampled) reactions
      // array length only if the scalar is absent.
      reactions: toCount(eng.likes) || (reactionsArr ? reactionsArr.length : 0),
      comments: toCount(eng.comments),
      reposts: toCount(eng.shares),
      posted_at: toPostedAt(item.postedAt),
    })
  }
  return normalized
}
