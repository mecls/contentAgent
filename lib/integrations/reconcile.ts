import { listPosts, updatePostMetrics, type PostMetrics } from '@/lib/db/posts'
import { listScrapedPosts } from '@/lib/db/scraped-posts'

/**
 * Deterministic reconciliation: join scraped LinkedIn posts to saved posts by
 * EXACT url (scraped.source_url == posts.linkedin_url) and write the public
 * engagement (reactions, comments, reposts) onto each matched post.
 *
 * Impressions are NEVER set here — LinkedIn keeps them private, so they remain a
 * manual value the user enters. engagement_rate is (re)computed only when the
 * post already has impressions. Idempotent: re-running with higher weekly counts
 * simply updates the same post.
 *
 * Shared by the weekly cron and the `reconcile_analytics` agent tool.
 */

export interface ReconcileDiff {
  postId: string
  hook: string | null
  before: PostMetrics
  after: PostMetrics
}

export interface ReconcileResult {
  updated: ReconcileDiff[]
  /** Scraped post URLs with no matching saved post (need a linkedin_url attached). */
  unmatchedUrls: string[]
}

export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  // Strip query/hash and a trailing slash so cosmetic URL differences still match.
  const trimmed = url.trim().split(/[?#]/)[0].replace(/\/+$/, '')
  return trimmed.length > 0 ? trimmed.toLowerCase() : null
}

/**
 * Extract the LinkedIn activity id (the ~19-digit number) from any post URL
 * form: `.../posts/handle_slug-activity-7463...-sT3F` OR
 * `.../feed/update/urn:li:activity:7463...`. This is the stable match key, so
 * the URL the creator pastes matches the scraped URL regardless of format.
 */
export function activityId(url: string | null | undefined): string | null {
  if (!url) return null
  const m = url.match(/(\d{17,})/)
  return m ? m[1] : null
}

/**
 * Merge scraped public counts onto a post's existing metrics. Preserves
 * impressions (manual) and recomputes engagement_rate only when impressions
 * are present. Shared by reconcile and the scrape→posts importer.
 */
export function applyScrapedMetrics(
  before: PostMetrics,
  scraped: { reactions?: number; comments?: number; reposts?: number },
): PostMetrics {
  const after: PostMetrics = {
    ...before,
    ...(typeof scraped.reactions === 'number' ? { reactions: scraped.reactions } : {}),
    ...(typeof scraped.comments === 'number' ? { comments: scraped.comments } : {}),
    ...(typeof scraped.reposts === 'number' ? { reposts: scraped.reposts } : {}),
  }
  if (typeof after.impressions === 'number' && after.impressions > 0) {
    const r = after.reactions ?? 0
    const c = after.comments ?? 0
    after.engagement_rate = Number((((r + c) / after.impressions) * 100).toFixed(2))
  }
  return after
}

export async function reconcileScrapedMetrics(
  accountId: string,
): Promise<ReconcileResult> {
  const [scraped, posts] = await Promise.all([
    listScrapedPosts(accountId),
    listPosts(accountId),
  ])

  // Index saved posts by activity id (primary) and normalized URL (fallback).
  const byId = new Map<string, (typeof posts)[number]>()
  const byUrl = new Map<string, (typeof posts)[number]>()
  for (const p of posts) {
    const id = activityId(p.linkedin_url)
    const url = normalizeUrl(p.linkedin_url)
    if (id) byId.set(id, p)
    if (url) byUrl.set(url, p)
  }

  const updated: ReconcileDiff[] = []
  const unmatchedUrls: string[] = []

  for (const s of scraped) {
    const id = activityId(s.source_url)
    const url = normalizeUrl(s.source_url)
    const post = (id ? byId.get(id) : undefined) ?? (url ? byUrl.get(url) : undefined)
    if (!post) {
      if (s.source_url) unmatchedUrls.push(s.source_url)
      continue
    }

    const before = post.metrics ?? {}
    const after = applyScrapedMetrics(before, s.metrics ?? {})
    await updatePostMetrics(accountId, post.id, after)
    updated.push({ postId: post.id, hook: post.hook, before, after })
  }

  return { updated, unmatchedUrls }
}
