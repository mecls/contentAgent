'use server'

import { revalidatePath } from 'next/cache'
import { requireAccountId } from '@/lib/auth/session'
import { getApifyIntegration, upsertApifyIntegration } from '@/lib/db/integrations'
import { runScrapeForAccount } from '@/lib/integrations/run-scrape'

export interface ActionResult {
  ok: boolean
  message: string
}

/** Connect (or update) the account's Apify LinkedIn integration. */
export async function connectApifyAction(profileUrl: string): Promise<ActionResult> {
  const { accountId } = await requireAccountId()
  const url = profileUrl.trim()
  if (!/^https?:\/\/(www\.)?linkedin\.com\/in\/.+/i.test(url)) {
    return { ok: false, message: 'Enter a LinkedIn profile URL like https://www.linkedin.com/in/your-handle' }
  }
  await upsertApifyIntegration(accountId, { profileUrl: url })
  revalidatePath('/app/integrations')
  return { ok: true, message: 'Connected. Scrapes run weekly — or click Run now.' }
}

/** Manually trigger a scrape + reconcile now (substitutes for cron in dev). */
export async function runScrapeNowAction(): Promise<ActionResult> {
  const { accountId } = await requireAccountId()
  const integration = await getApifyIntegration(accountId)
  if (!integration || !integration.config?.profileUrl) {
    return { ok: false, message: 'Connect a LinkedIn profile first.' }
  }
  try {
    const { scraped, sync } = await runScrapeForAccount(accountId, {
      id: integration.id,
      config: integration.config,
    })
    revalidatePath('/app/integrations')
    revalidatePath('/app/posts')
    return {
      ok: true,
      message: `Scraped ${scraped} post(s) — imported ${sync.created.length} new and refreshed ${sync.updated.length} in your Posts library.`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Scrape failed.' }
  }
}
