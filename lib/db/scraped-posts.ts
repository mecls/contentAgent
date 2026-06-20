import { supabaseService } from '@/lib/supabase/service'
import type { ScrapedItem } from '@/lib/integrations/apify'

/**
 * Account-scoped storage for posts scraped from LinkedIn. Mirrors lib/db/posts.ts
 * (service-role client; the account id is always server-derived and re-checked).
 */

export interface ScrapedPostMetrics {
  reactions?: number
  comments?: number
  reposts?: number
}

export interface ScrapedPostRow {
  id: string
  integration_id: string | null
  source_url: string | null
  author: string | null
  content: string | null
  metrics: ScrapedPostMetrics
  scraped_at: string
}

/**
 * Upsert scraped posts keyed on (account_id, source_url) — so a weekly re-scrape
 * refreshes counts on the existing row instead of duplicating it (the unique
 * index from migration 0002 backs the onConflict). Returns the number written.
 */
export async function upsertScrapedPosts(
  accountId: string,
  integrationId: string,
  items: ScrapedItem[],
): Promise<number> {
  if (items.length === 0) return 0
  const now = new Date().toISOString()
  const rows = items.map((it) => ({
    account_id: accountId,
    integration_id: integrationId,
    source_url: it.source_url,
    author: it.author,
    content: it.content,
    metrics: {
      reactions: it.reactions,
      comments: it.comments,
      reposts: it.reposts,
    },
    scraped_at: now,
  }))
  const { error } = await supabaseService()
    .from('content_scraped_posts')
    .upsert(rows, { onConflict: 'account_id,source_url' })
  if (error) throw new Error(`upsertScrapedPosts failed: ${error.message}`)
  return rows.length
}

export async function listScrapedPosts(
  accountId: string,
): Promise<ScrapedPostRow[]> {
  const { data, error } = await supabaseService()
    .from('content_scraped_posts')
    .select('id, integration_id, source_url, author, content, metrics, scraped_at')
    .eq('account_id', accountId)
    .order('scraped_at', { ascending: false })
  if (error) throw new Error(`listScrapedPosts failed: ${error.message}`)
  return (data ?? []) as ScrapedPostRow[]
}

/** Most recent scrape timestamp for an integration (for the UI), or null. */
export async function lastScrapedAt(
  accountId: string,
  integrationId: string,
): Promise<string | null> {
  const { data, error } = await supabaseService()
    .from('content_scraped_posts')
    .select('scraped_at')
    .eq('account_id', accountId)
    .eq('integration_id', integrationId)
    .order('scraped_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`lastScrapedAt failed: ${error.message}`)
  return (data?.scraped_at as string | undefined) ?? null
}

/** Count of scraped posts for an account (for the UI). */
export async function countScrapedPosts(accountId: string): Promise<number> {
  const { count, error } = await supabaseService()
    .from('content_scraped_posts')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId)
  if (error) throw new Error(`countScrapedPosts failed: ${error.message}`)
  return count ?? 0
}
