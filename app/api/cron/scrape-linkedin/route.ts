import { type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { listActiveApifyIntegrations } from '@/lib/db/integrations'
import { runScrapeForAccount } from '@/lib/integrations/run-scrape'
import { runWeeklyReview } from '@/lib/integrations/weekly-review'

// Node runtime (service-role SDK). 300s ceiling = Apify's sync cap + the agent run.
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Weekly cron (configured in vercel.json). For each active Apify integration it:
 *   1. scrapes the profile and upserts content_scraped_posts,
 *   2. reconciles metrics onto saved posts deterministically (by linkedin_url),
 *   3. runs the agent headless to log lessons + write a summary conversation.
 *
 * No user session here, so it is guarded by CRON_SECRET. Vercel Cron auto-sends
 * `Authorization: Bearer $CRON_SECRET`; the manual "Run now" UI path uses the
 * per-account server action instead (app/actions/integrations.ts).
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${env.cronSecret()}`) {
    return new Response('unauthorized', { status: 401 })
  }

  let integrations: { id: string; account_id: string; config: { profileUrl?: string } }[]
  try {
    integrations = await listActiveApifyIntegrations()
  } catch (e) {
    console.error('[cron] list integrations failed', e)
    return new Response('integration lookup failed', { status: 500 })
  }

  const ran: Array<{
    accountId: string
    ok: boolean
    scraped?: number
    imported?: number
    refreshed?: number
    conversationId?: string
    error?: string
  }> = []

  // Sequential per-account so one slow/failed account doesn't abort the rest.
  for (const integration of integrations) {
    const { account_id: accountId } = integration
    try {
      if (!integration.config?.profileUrl) {
        ran.push({ accountId, ok: false, error: 'no profileUrl' })
        continue
      }
      const { scraped, sync } = await runScrapeForAccount(accountId, integration)
      const { conversationId } = await runWeeklyReview(accountId, sync)
      ran.push({
        accountId,
        ok: true,
        scraped,
        imported: sync.created.length,
        refreshed: sync.updated.length,
        conversationId,
      })
    } catch (e) {
      console.error(`[cron] account ${accountId} failed`, e)
      ran.push({ accountId, ok: false, error: e instanceof Error ? e.message : 'error' })
    }
  }

  return Response.json({ ran })
}
