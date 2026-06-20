import { scrapeProfilePosts } from '@/lib/integrations/apify'
import { upsertScrapedPosts } from '@/lib/db/scraped-posts'
import { syncScrapedToPosts, type SyncResult } from '@/lib/integrations/sync-posts'
import type { ApifyConfig } from '@/lib/db/integrations'

export interface ScrapeRunResult {
  /** Raw posts written to the scrape log. */
  scraped: number
  /** Posts imported into / updated in the library. */
  sync: SyncResult
}

/**
 * One account's scrape unit: run the actor for the configured profile, log the
 * raw results, and sync them into the Posts library (import new published posts,
 * refresh metrics on matched ones). Shared by the weekly cron and "Run now".
 */
export async function runScrapeForAccount(
  accountId: string,
  integration: { id: string; config: ApifyConfig },
): Promise<ScrapeRunResult> {
  const profileUrl = integration.config?.profileUrl
  if (!profileUrl) {
    throw new Error('integration has no profileUrl configured')
  }
  // postedLimit is intentionally omitted — we pull the latest maxPosts regardless
  // of age so older posts keep getting their engagement refreshed.
  const items = await scrapeProfilePosts({
    profileUrl,
    maxPosts: integration.config.maxPosts,
  })
  const scraped = await upsertScrapedPosts(accountId, integration.id, items)
  const sync = await syncScrapedToPosts(accountId, items)
  return { scraped, sync }
}
