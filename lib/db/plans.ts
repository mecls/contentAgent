import { supabaseService } from '@/lib/supabase/service'
import type { FormatTrend } from '@/lib/integrations/analyze-formats'

/**
 * Account-scoped storage for weekly content plans. A plan is the "combination"
 * grouping: one row holds the mix rationale + the format-trend snapshot it was
 * built from; the individual posts live as content_post_ideas rows linked via
 * plan_id (see lib/db/ideas.ts listIdeasByPlan). Service-role client; account_id
 * always re-checked.
 */

export interface PlanRow {
  id: string
  platform: string
  horizon_days: number | null
  summary: string | null
  trends: FormatTrend[]
  created_at: string
}

const PLAN_COLUMNS = 'id, platform, horizon_days, summary, trends, created_at'

export async function createPlan(
  accountId: string,
  plan: {
    platform: string
    horizonDays?: number | null
    summary?: string | null
    trends?: FormatTrend[]
  },
): Promise<string> {
  const { data, error } = await supabaseService()
    .from('content_content_plans')
    .insert({
      account_id: accountId,
      platform: plan.platform,
      horizon_days: plan.horizonDays ?? null,
      summary: plan.summary ?? null,
      trends: plan.trends ?? [],
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createPlan failed: ${error?.message ?? 'no data'}`)
  return data.id as string
}

export async function getLatestPlan(
  accountId: string,
  platform?: string,
): Promise<PlanRow | null> {
  let q = supabaseService()
    .from('content_content_plans')
    .select(PLAN_COLUMNS)
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (platform) q = q.eq('platform', platform)
  const { data, error } = await q.maybeSingle()
  if (error) throw new Error(`getLatestPlan failed: ${error.message}`)
  return (data as PlanRow | null) ?? null
}
