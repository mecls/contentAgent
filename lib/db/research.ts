import { supabaseService } from '@/lib/supabase/service'
import type { ResearchItem } from '@/lib/integrations/exa'
import { RESEARCH_WINDOW, pickResearchWindow } from '@/lib/integrations/research-window'

/**
 * Account-scoped storage for daily research items. Mirrors lib/db/scraped-posts.ts
 * (service-role client; account_id always server-derived and re-checked).
 */

export interface ResearchRow {
  id: string
  source: string
  topic: string | null
  title: string | null
  url: string
  summary: string | null
  key_points: string[]
  author: string | null
  score: number | null
  published_at: string | null
  fetched_at: string
}

/** 'daily' = the research run, which follows the research focus; 'chat' = search_news while drafting. */
export type ResearchOrigin = 'daily' | 'chat'

/**
 * Upsert on (account_id, url), no dupes. A daily run refreshes an article it sees
 * again and claims it as daily. A chat search only adds URLs that are new: it must
 * not move an existing item to the top or relabel it.
 */
export async function upsertResearchItems(
  accountId: string,
  items: ResearchItem[],
  origin: ResearchOrigin,
): Promise<number> {
  if (items.length === 0) return 0
  // De-dupe within the batch (same url across sources/queries) — keep first.
  const seen = new Set<string>()
  const rows = items
    .filter((it) => it.url && !seen.has(it.url) && seen.add(it.url))
    .map((it) => ({
      account_id: accountId,
      source: it.source,
      topic: it.topic,
      title: it.title,
      url: it.url,
      summary: it.summary,
      author: it.author,
      score: it.score,
      published_at: it.published_at,
      fetched_at: new Date().toISOString(),
      origin,
    }))
  if (rows.length === 0) return 0
  const { error } = await supabaseService()
    .from('content_research_items')
    .upsert(rows, { onConflict: 'account_id,url', ignoreDuplicates: origin === 'chat' })
  if (error) throw new Error(`upsertResearchItems failed: ${error.message}`)
  return rows.length
}

/** Timestamp of the most recent research item, or null if none. */
export async function lastResearchAt(accountId: string): Promise<string | null> {
  const { data, error } = await supabaseService()
    .from('content_research_items')
    .select('fetched_at')
    .eq('account_id', accountId)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`lastResearchAt failed: ${error.message}`)
  return (data?.fetched_at as string | undefined) ?? null
}

export async function listResearchItems(
  accountId: string,
  opts: { limit?: number; sinceDays?: number; origin?: ResearchOrigin } = {},
): Promise<ResearchRow[]> {
  let q = supabaseService()
    .from('content_research_items')
    .select('id, source, topic, title, url, summary, key_points, author, score, published_at, fetched_at')
    .eq('account_id', accountId)
    .order('fetched_at', { ascending: false })
    .limit(opts.limit ?? 50)
  if (opts.sinceDays) {
    const since = new Date(Date.now() - opts.sinceDays * 86_400_000).toISOString()
    q = q.gte('fetched_at', since)
  }
  if (opts.origin) q = q.eq('origin', opts.origin)
  const { data, error } = await q
  if (error) throw new Error(`listResearchItems failed: ${error.message}`)
  return (data ?? []) as ResearchRow[]
}

/**
 * What Choose and the chat's list_research draw from: daily-run items from the last
 * 7 days, newest first, at most 3 per search. Chat searches stay out — they follow
 * the post being drafted, not the research focus.
 */
export async function listDailyResearch(accountId: string): Promise<ResearchRow[]> {
  const rows = await listResearchItems(accountId, {
    origin: 'daily',
    sinceDays: RESEARCH_WINDOW.sinceDays,
    // Enough to still fill the window after the per-search cap.
    limit: 200,
  })
  return pickResearchWindow(rows, RESEARCH_WINDOW)
}
