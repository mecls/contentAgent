import { type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { listAccountIdsWithCompetitors } from '@/lib/db/competitors'
import { runCompetitorAnalysisForAccount } from '@/lib/integrations/run-competitors'
import { suggestPostMixForAccount } from '@/lib/integrations/suggest-mix'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Weekly competitor-analysis cron. Guarded by CRON_SECRET. Loops accounts that
 * have at least one active competitor; one failure never aborts the rest.
 */
export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${env.cronSecret()}`) {
    return new Response('unauthorized', { status: 401 })
  }

  let accountIds: string[]
  try {
    accountIds = await listAccountIdsWithCompetitors()
  } catch (e) {
    console.error('[cron/competitors] account lookup failed', e)
    return new Response('lookup failed', { status: 500 })
  }

  const ran: Array<Record<string, unknown>> = []
  for (const accountId of accountIds) {
    const entry: Record<string, unknown> = { accountId }
    // Competitor extraction first so format-trend analysis reads the freshest posts…
    try {
      entry.competitors = await runCompetitorAnalysisForAccount(accountId)
    } catch (e) {
      console.error(`[cron/competitors] account ${accountId} failed`, e)
      entry.competitorsError = e instanceof Error ? e.message : 'error'
    }
    // …then build the weekly content plan from the refreshed format trends.
    try {
      const plan = await suggestPostMixForAccount(accountId)
      entry.plan = { planId: plan.planId, created: plan.created }
    } catch (e) {
      console.error(`[cron/competitors] plan failed for ${accountId}`, e)
      entry.planError = e instanceof Error ? e.message : 'error'
    }
    ran.push(entry)
  }
  return Response.json({ ran })
}
