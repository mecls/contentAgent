import { supabaseService } from '@/lib/supabase/service'

/**
 * Account-scoped storage for the user-curated competitor list and their scraped
 * posts + extracted features. Service-role client; account_id always re-checked.
 */

export interface CompetitorRow {
  id: string
  profile_url: string
  name: string | null
  active: boolean
  created_at: string
}

export interface CompetitorPostFeatures {
  hook?: string
  tone?: string
  structure?: string
  topic?: string
  lead_magnet?: string
  cta?: string
  voice?: string
  /** Free-text format label as the model described it. */
  format?: string
  /** Normalized format key from the platform catalog (lib/formats/catalog.ts). */
  format_key?: string
  length_words?: number
  why_it_worked?: string
}

export interface CompetitorPostRow {
  id: string
  competitor_id: string | null
  source_url: string
  content: string | null
  posted_at: string | null
  metrics: { reactions?: number; comments?: number; reposts?: number }
  features: CompetitorPostFeatures
  scraped_at: string
}

/**
 * Cross-account list of account ids that have at least one active competitor.
 * Used by the weekly competitor cron (no user session).
 */
export async function listAccountIdsWithCompetitors(): Promise<string[]> {
  const { data, error } = await supabaseService()
    .from('content_competitors')
    .select('account_id')
    .eq('active', true)
  if (error) throw new Error(`listAccountIdsWithCompetitors failed: ${error.message}`)
  return [...new Set((data ?? []).map((r) => r.account_id as string))]
}

export async function listCompetitors(accountId: string): Promise<CompetitorRow[]> {
  const { data, error } = await supabaseService()
    .from('content_competitors')
    .select('id, profile_url, name, active, created_at')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`listCompetitors failed: ${error.message}`)
  return (data ?? []) as CompetitorRow[]
}

export async function addCompetitor(
  accountId: string,
  profileUrl: string,
  name?: string | null,
): Promise<void> {
  const { error } = await supabaseService()
    .from('content_competitors')
    .upsert(
      { account_id: accountId, profile_url: profileUrl, name: name ?? null, active: true },
      { onConflict: 'account_id,profile_url' },
    )
  if (error) throw new Error(`addCompetitor failed: ${error.message}`)
}

export async function removeCompetitor(accountId: string, id: string): Promise<void> {
  const { error } = await supabaseService()
    .from('content_competitors')
    .delete()
    .eq('account_id', accountId)
    .eq('id', id)
  if (error) throw new Error(`removeCompetitor failed: ${error.message}`)
}

export interface CompetitorPostInput {
  source_url: string
  content: string | null
  posted_at: string | null
  metrics: { reactions?: number; comments?: number; reposts?: number }
  features: CompetitorPostFeatures
}

export async function upsertCompetitorPosts(
  accountId: string,
  competitorId: string,
  rows: CompetitorPostInput[],
): Promise<number> {
  if (rows.length === 0) return 0
  const payload = rows.map((r) => ({
    account_id: accountId,
    competitor_id: competitorId,
    source_url: r.source_url,
    content: r.content,
    posted_at: r.posted_at,
    metrics: r.metrics,
    features: r.features,
    scraped_at: new Date().toISOString(),
  }))
  const { error } = await supabaseService()
    .from('content_competitor_posts')
    .upsert(payload, { onConflict: 'account_id,source_url' })
  if (error) throw new Error(`upsertCompetitorPosts failed: ${error.message}`)
  return payload.length
}

export async function countCompetitorPosts(accountId: string): Promise<number> {
  const { count, error } = await supabaseService()
    .from('content_competitor_posts')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId)
  if (error) throw new Error(`countCompetitorPosts failed: ${error.message}`)
  return count ?? 0
}

export async function listCompetitorPosts(
  accountId: string,
  opts: { limit?: number } = {},
): Promise<CompetitorPostRow[]> {
  const { data, error } = await supabaseService()
    .from('content_competitor_posts')
    .select('id, competitor_id, source_url, content, posted_at, metrics, features, scraped_at')
    .eq('account_id', accountId)
    .order('scraped_at', { ascending: false })
    .limit(opts.limit ?? 60)
  if (error) throw new Error(`listCompetitorPosts failed: ${error.message}`)
  return (data ?? []) as CompetitorPostRow[]
}
