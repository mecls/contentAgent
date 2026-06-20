import { type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { listAccountIdsWithCompetitors } from '@/lib/db/competitors'
import { runCompetitorAnalysisForAccount } from '@/lib/integrations/run-competitors'

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
    try {
      const r = await runCompetitorAnalysisForAccount(accountId)
      ran.push({ accountId, ok: true, ...r })
    } catch (e) {
      console.error(`[cron/competitors] account ${accountId} failed`, e)
      ran.push({ accountId, ok: false, error: e instanceof Error ? e.message : 'error' })
    }
  }
  return Response.json({ ran })
}
