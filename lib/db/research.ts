import { supabaseService } from '@/lib/supabase/service'
import type { ResearchItem } from '@/lib/integrations/exa'

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

/** Upsert on (account_id, url) so re-seeing an article refreshes it, no dupes. */
export async function upsertResearchItems(
  accountId: string,
  items: ResearchItem[],
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
    }))
  if (rows.length === 0) return 0
  const { error } = await supabaseService()
    .from('content_research_items')
    .upsert(rows, { onConflict: 'account_id,url' })
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
  opts: { limit?: number; sinceDays?: number } = {},
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
  const { data, error } = await q
  if (error) throw new Error(`listResearchItems failed: ${error.message}`)
  return (data ?? []) as ResearchRow[]
}
