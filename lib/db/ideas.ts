import { supabaseService } from '@/lib/supabase/service'

/**
 * Account-scoped storage for AI-generated post ideas. Service-role client;
 * account_id always re-checked.
 */

export type IdeaStatus = 'pending' | 'written' | 'dismissed'

export interface IdeaRow {
  id: string
  topic: string
  angle: string | null
  structure: string | null
  hook: string | null
  rationale: string | null
  sources: string[]
  /** Structural format key (lib/formats/catalog.ts) — set on weekly-plan items. */
  format: string | null
  platform: string | null
  /** Suggested publish date (weekly-plan items). */
  planned_for: string | null
  /** Links the idea to the content plan it belongs to, if any. */
  plan_id: string | null
  status: IdeaStatus
  post_id: string | null
  created_at: string
}

export interface IdeaInput {
  topic: string
  angle?: string | null
  structure?: string | null
  hook?: string | null
  rationale?: string | null
  sources?: string[]
  format?: string | null
  platform?: string | null
  planned_for?: string | null
  plan_id?: string | null
}

const IDEA_COLUMNS =
  'id, topic, angle, structure, hook, rationale, sources, format, platform, planned_for, plan_id, status, post_id, created_at'

export async function createIdeas(accountId: string, ideas: IdeaInput[]): Promise<number> {
  const rows = ideas
    .filter((i) => i.topic && i.topic.trim().length > 0)
    .map((i) => ({
      account_id: accountId,
      topic: i.topic.trim(),
      angle: i.angle ?? null,
      structure: i.structure ?? null,
      hook: i.hook ?? null,
      rationale: i.rationale ?? null,
      sources: i.sources ?? [],
      format: i.format ?? null,
      platform: i.platform ?? null,
      planned_for: i.planned_for ?? null,
      plan_id: i.plan_id ?? null,
      status: 'pending' as const,
    }))
  if (rows.length === 0) return 0
  const { error } = await supabaseService().from('content_post_ideas').insert(rows)
  if (error) throw new Error(`createIdeas failed: ${error.message}`)
  return rows.length
}

export async function listIdeas(accountId: string, status?: IdeaStatus): Promise<IdeaRow[]> {
  let q = supabaseService()
    .from('content_post_ideas')
    .select(IDEA_COLUMNS)
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw new Error(`listIdeas failed: ${error.message}`)
  return (data ?? []) as IdeaRow[]
}

/** Ideas belonging to one content plan, ordered by their suggested publish date. */
export async function listIdeasByPlan(accountId: string, planId: string): Promise<IdeaRow[]> {
  const { data, error } = await supabaseService()
    .from('content_post_ideas')
    .select(IDEA_COLUMNS)
    .eq('account_id', accountId)
    .eq('plan_id', planId)
    .order('planned_for', { ascending: true })
  if (error) throw new Error(`listIdeasByPlan failed: ${error.message}`)
  return (data ?? []) as IdeaRow[]
}

export async function getIdea(accountId: string, id: string): Promise<IdeaRow | null> {
  const { data, error } = await supabaseService()
    .from('content_post_ideas')
    .select(IDEA_COLUMNS)
    .eq('account_id', accountId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`getIdea failed: ${error.message}`)
  return (data as IdeaRow | null) ?? null
}

export async function setIdeaStatus(
  accountId: string,
  id: string,
  status: IdeaStatus,
  postId?: string | null,
): Promise<void> {
  const patch: Record<string, unknown> = { status }
  if (postId !== undefined) patch.post_id = postId
  const { error } = await supabaseService()
    .from('content_post_ideas')
    .update(patch)
    .eq('account_id', accountId)
    .eq('id', id)
  if (error) throw new Error(`setIdeaStatus failed: ${error.message}`)
}

export async function countPendingIdeas(accountId: string): Promise<number> {
  // Standalone ideas only — plan-linked items are surfaced on the Plan page.
  const { count, error } = await supabaseService()
    .from('content_post_ideas')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .eq('status', 'pending')
    .is('plan_id', null)
  if (error) throw new Error(`countPendingIdeas failed: ${error.message}`)
  return count ?? 0
}
