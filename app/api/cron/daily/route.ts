import { type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { listOnboardedAccountIds } from '@/lib/db/profile'
import { runResearchForAccount } from '@/lib/integrations/run-research'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Daily research pipeline: for each onboarded account, gather fresh research once
 * a day. The manual "Run research now" button lets the user trigger extra runs on
 * demand.
 *
 * Guarded by CRON_SECRET (Vercel Cron auto-attaches it as a Bearer header). One
 * account failing never aborts the rest.
 */
export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${env.cronSecret()}`) {
    return new Response('unauthorized', { status: 401 })
  }

  let accountIds: string[]
  try {
    accountIds = await listOnboardedAccountIds()
  } catch (e) {
    console.error('[cron/daily] account lookup failed', e)
    return new Response('lookup failed', { status: 500 })
  }

  const ran: Array<Record<string, unknown>> = []
  for (const accountId of accountIds) {
    const entry: Record<string, unknown> = { accountId }
    try {
      entry.research = await runResearchForAccount(accountId)
    } catch (e) {
      console.error(`[cron/daily] research failed for ${accountId}`, e)
      entry.researchError = e instanceof Error ? e.message : 'error'
    }
    ran.push(entry)
  }
  return Response.json({ ran })
}
