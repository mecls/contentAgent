import {
  listPosts,
  createPost,
  updatePostMetrics,
  updatePost,
  type PostMetrics,
} from '@/lib/db/posts'
import type { ScrapedItem } from '@/lib/integrations/apify'
import { activityId, applyScrapedMetrics } from '@/lib/integrations/reconcile'

/**
 * Bring scraped LinkedIn posts into the Posts library (content_posts) so they're
 * visible and feed the improvement loop:
 *   - if a saved post already matches (by LinkedIn activity id), refresh its
 *     public metrics (and backfill its linkedin_url if missing);
 *   - otherwise import the scraped post as a published post (source 'user',
 *     status 'posted') carrying its real engagement and post date.
 *
 * Idempotent: the imported row stores linkedin_url, so next week it matches and
 * is updated in place rather than duplicated.
 */

export interface SyncedPost {
  postId: string
  hook: string | null
  metrics: PostMetrics
}

export interface SyncResult {
  created: SyncedPost[]
  updated: SyncedPost[]
}

/** First non-empty line of the post, capped — used as the hook/title. */
function deriveHook(content: string | null): string | null {
  if (!content) return null
  const line = content.split('\n').map((l) => l.trim()).find((l) => l.length > 0)
  if (!line) return null
  return line.length > 120 ? `${line.slice(0, 117)}…` : line
}

export async function syncScrapedToPosts(
  accountId: string,
  items: ScrapedItem[],
): Promise<SyncResult> {
  const posts = await listPosts(accountId)

  // Index existing posts by activity id of their linkedin_url.
  const byId = new Map<string, (typeof posts)[number]>()
  for (const p of posts) {
    const id = activityId(p.linkedin_url)
    if (id) byId.set(id, p)
  }

  const created: SyncedPost[] = []
  const updated: SyncedPost[] = []
  const handled = new Set<string>() // guard against duplicate items in one batch

  for (const item of items) {
    const scrapedMetrics = {
      reactions: item.reactions,
      comments: item.comments,
      reposts: item.reposts,
    }
    const id = activityId(item.source_url)
    if (id && handled.has(id)) continue
    if (id) handled.add(id)
    const existing = id ? byId.get(id) : undefined

    if (existing) {
      const after = applyScrapedMetrics(existing.metrics ?? {}, scrapedMetrics)
      await updatePostMetrics(accountId, existing.id, after)
      // Backfill the URL / creative if the saved post is missing either.
      const patch: { linkedin_url?: string; image_url?: string } = {}
      if (!existing.linkedin_url && item.source_url) patch.linkedin_url = item.source_url
      if (!existing.image_url && item.image_url) patch.image_url = item.image_url
      if (Object.keys(patch).length > 0) {
        await updatePost(accountId, existing.id, patch)
      }
      updated.push({ postId: existing.id, hook: existing.hook, metrics: after })
      continue
    }

    // New post — only import ones with real text (body is NOT NULL; an empty
    // image-only post isn't useful for the improvement loop).
    if (!item.content || item.content.trim().length === 0) continue

    const metrics = applyScrapedMetrics({}, scrapedMetrics)
    const postId = await createPost(accountId, {
      body: item.content,
      hook: deriveHook(item.content),
      status: 'posted',
      source: 'user',
      linkedin_url: item.source_url,
      image_url: item.image_url,
      metrics,
      posted_at: item.posted_at,
      created_at: item.posted_at, // so the library sorts by real publish date
    })
    created.push({ postId, hook: deriveHook(item.content), metrics })
  }

  return { created, updated }
}
