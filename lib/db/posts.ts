import { supabaseService } from '@/lib/supabase/service'

/** Generated posts. Account-scoped; the account id is always server-derived. */

export interface PostMetrics {
  impressions?: number
  reactions?: number
  comments?: number
  reposts?: number
  engagement_rate?: number
}

export interface PostRow {
  id: string
  conversation_id: string | null
  hook: string | null
  body: string
  archetype: string | null
  status: 'draft' | 'approved' | 'posted'
  skill_slug: string | null
  linkedin_url: string | null
  image_url: string | null
  metrics: PostMetrics
  tags: string[]
  source: 'agent' | 'user'
  created_at: string
  updated_at: string
  posted_at: string | null
}

/**
 * Normalize free-form tags into stable keywords so engagement can be compared
 * across posts: lowercase, trimmed, single-spaced, de-duplicated, capped. Keeping
 * them consistent is what makes the per-tag A/B numbers meaningful.
 */
export function normalizeTags(input: readonly string[] | null | undefined): string[] {
  if (!input) return []
  const out: string[] = []
  for (const raw of input) {
    const t = String(raw).trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40)
    if (t && !out.includes(t)) out.push(t)
    if (out.length >= 8) break
  }
  return out
}

export async function listPosts(accountId: string): Promise<PostRow[]> {
  const { data, error } = await supabaseService()
    .from('content_posts')
    .select(
      'id, conversation_id, hook, body, archetype, status, skill_slug, linkedin_url, image_url, metrics, tags, source, created_at, updated_at, posted_at',
    )
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`listPosts failed: ${error.message}`)
  return (data ?? []) as PostRow[]
}

export async function getPost(
  accountId: string,
  id: string,
): Promise<PostRow | null> {
  const { data, error } = await supabaseService()
    .from('content_posts')
    .select(
      'id, conversation_id, hook, body, archetype, status, skill_slug, linkedin_url, image_url, metrics, tags, source, created_at, updated_at, posted_at',
    )
    .eq('account_id', accountId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`getPost failed: ${error.message}`)
  return (data as PostRow | null) ?? null
}

export async function createPost(
  accountId: string,
  post: {
    hook?: string | null
    body: string
    archetype?: string | null
    status?: 'draft' | 'approved' | 'posted'
    skill_slug?: string | null
    conversation_id?: string | null
    source?: 'agent' | 'user'
    linkedin_url?: string | null
    image_url?: string | null
    metrics?: PostMetrics
    tags?: string[]
    posted_at?: string | null
    /** Override the row's created_at (e.g. backdate an imported published post). */
    created_at?: string | null
  },
): Promise<string> {
  const { data, error } = await supabaseService()
    .from('content_posts')
    .insert({
      account_id: accountId,
      hook: post.hook ?? null,
      body: post.body,
      archetype: post.archetype ?? null,
      status: post.status ?? 'draft',
      skill_slug: post.skill_slug ?? null,
      conversation_id: post.conversation_id ?? null,
      source: post.source ?? 'agent',
      linkedin_url: post.linkedin_url ?? null,
      image_url: post.image_url ?? null,
      tags: normalizeTags(post.tags),
      ...(post.metrics ? { metrics: post.metrics } : {}),
      ...(post.posted_at ? { posted_at: post.posted_at } : {}),
      ...(post.created_at ? { created_at: post.created_at } : {}),
    })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`createPost failed: ${error?.message ?? 'no data'}`)
  }
  return data.id as string
}

export async function updatePost(
  accountId: string,
  id: string,
  patch: Partial<{
    hook: string | null
    body: string
    archetype: string | null
    status: 'draft' | 'approved' | 'posted'
    linkedin_url: string | null
    image_url: string | null
  }>,
): Promise<void> {
  const { error } = await supabaseService()
    .from('content_posts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId)
  if (error) throw new Error(`updatePost failed: ${error.message}`)
}

export async function updatePostMetrics(
  accountId: string,
  id: string,
  metrics: PostMetrics,
): Promise<void> {
  const { error } = await supabaseService()
    .from('content_posts')
    .update({ metrics, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId)
  if (error) throw new Error(`updatePostMetrics failed: ${error.message}`)
}

export async function markPosted(
  accountId: string,
  id: string,
  posted: boolean,
): Promise<void> {
  const { error } = await supabaseService()
    .from('content_posts')
    .update({
      status: posted ? 'posted' : 'draft',
      posted_at: posted ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('account_id', accountId)
  if (error) throw new Error(`markPosted failed: ${error.message}`)
}

export async function deletePost(accountId: string, id: string): Promise<void> {
  const { error } = await supabaseService()
    .from('content_posts')
    .delete()
    .eq('id', id)
    .eq('account_id', accountId)
  if (error) throw new Error(`deletePost failed: ${error.message}`)
}

export async function updatePostTags(
  accountId: string,
  id: string,
  tags: string[],
): Promise<string[]> {
  const normalized = normalizeTags(tags)
  const { error } = await supabaseService()
    .from('content_posts')
    .update({ tags: normalized, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', accountId)
  if (error) throw new Error(`updatePostTags failed: ${error.message}`)
  return normalized
}

/** Engagement rate for a post: explicit value, else derived from impressions. */
function engagementRate(m: PostMetrics): number | undefined {
  if (typeof m.engagement_rate === 'number') return m.engagement_rate
  if (m.impressions && m.impressions > 0) {
    return (((m.reactions ?? 0) + (m.comments ?? 0)) / m.impressions) * 100
  }
  return undefined
}

export interface TagPerformance {
  tag: string
  posts: number
  avgReactions: number | null
  avgComments: number | null
  avgEngagementRate: number | null
}

/**
 * Aggregate engagement per tag — the A/B view of which content performs best.
 * Each average is taken only over posts where that metric is present.
 */
export async function tagPerformance(accountId: string): Promise<TagPerformance[]> {
  const all = await listPosts(accountId)
  const byTag = new Map<string, PostRow[]>()
  for (const p of all) {
    for (const t of p.tags ?? []) {
      const arr = byTag.get(t) ?? []
      arr.push(p)
      byTag.set(t, arr)
    }
  }
  const avg = (nums: number[]): number | null =>
    nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
  const present = (ps: PostRow[], pick: (m: PostMetrics) => number | undefined): number[] =>
    ps.map((p) => pick(p.metrics)).filter((n): n is number => typeof n === 'number')

  return [...byTag.entries()]
    .map(([tag, ps]) => ({
      tag,
      posts: ps.length,
      avgReactions: avg(present(ps, (m) => m.reactions)),
      avgComments: avg(present(ps, (m) => m.comments)),
      avgEngagementRate: avg(present(ps, engagementRate)),
    }))
    .sort((a, b) => (b.avgReactions ?? -1) - (a.avgReactions ?? -1))
}

/**
 * A compact note of the tags already in use, injected each turn so the agent
 * reuses existing keywords instead of inventing near-duplicates (which would
 * fragment the per-tag comparison). Returns '' when no post has tags yet.
 */
export async function buildTagsNote(accountId: string): Promise<string> {
  const all = await listPosts(accountId)
  const set = new Set<string>()
  for (const p of all) for (const t of p.tags ?? []) set.add(t)
  if (set.size === 0) return ''
  return `EXISTING POST TAGS (reuse these exact keywords when one fits, so engagement stays comparable across posts; only coin a new tag when none apply): ${[...set].sort().join(', ')}`
}
