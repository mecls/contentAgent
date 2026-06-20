import { type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { listOnboardedAccountIds } from '@/lib/db/profile'
import { runResearchForAccount } from '@/lib/integrations/run-research'
import { generateIdeasForAccount } from '@/lib/integrations/run-ideas'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Daily pipeline: research THEN ideation, in one run, once a day. For each
 * onboarded account it gathers fresh research and then generates post ideas from
 * it (so the ideas always reflect that morning's research — no timing gap). The
 * manual "Run research now" / "Generate ideas now" buttons let the user trigger
 * extra runs on demand.
 *
 * Guarded by CRON_SECRET (Vercel Cron auto-attaches it as a Bearer header). One
 * account failing never aborts the rest, and a research failure still lets
 * ideation run from the prior days' research window.
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
    // Research first so ideation reads the freshest items.
    try {
      entry.research = await runResearchForAccount(accountId)
    } catch (e) {
      console.error(`[cron/daily] research failed for ${accountId}`, e)
      entry.researchError = e instanceof Error ? e.message : 'error'
    }
    try {
      entry.ideas = await generateIdeasForAccount(accountId, 4)
    } catch (e) {
      console.error(`[cron/daily] ideas failed for ${accountId}`, e)
      entry.ideasError = e instanceof Error ? e.message : 'error'
    }
    ran.push(entry)
  }
  return Response.json({ ran })
}
