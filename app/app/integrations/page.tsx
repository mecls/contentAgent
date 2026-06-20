import { requireAccountId } from '@/lib/auth/session'
import { getApifyIntegration } from '@/lib/db/integrations'
import { lastScrapedAt, countScrapedPosts } from '@/lib/db/scraped-posts'
import { listCompetitors, countCompetitorPosts } from '@/lib/db/competitors'
import {
  IntegrationsPanel,
  type IntegrationPanelData,
} from '@/components/app/integrations-panel'
import { CompetitorsPanel } from '@/components/app/competitors-panel'

export default async function IntegrationsPage() {
  const { accountId } = await requireAccountId()
  const integration = await getApifyIntegration(accountId)

  const [scraped, scrapedCount, competitors, competitorPostCount] = await Promise.all([
    integration ? lastScrapedAt(accountId, integration.id) : Promise.resolve(null),
    countScrapedPosts(accountId),
    listCompetitors(accountId),
    countCompetitorPosts(accountId),
  ])

  const data: IntegrationPanelData = {
    connected: Boolean(integration),
    profileUrl: integration?.config?.profileUrl ?? '',
    status: integration?.status ?? 'inactive',
    lastScrapedAt: scraped,
    scrapedCount,
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900">Integrations</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Connect your LinkedIn profile so the agent sees your real post performance each
            week and folds it into your skill.
          </p>
        </header>

        <IntegrationsPanel data={data} />

        <p className="mt-4 text-xs text-neutral-400">
          Note: LinkedIn keeps impressions private, so the scrape brings in reactions, comments,
          and reposts. Add impressions yourself on a post to compute its engagement rate.
        </p>

        <div className="mt-8">
          <CompetitorsPanel
            competitors={competitors.map((c) => ({
              id: c.id,
              profile_url: c.profile_url,
              name: c.name,
            }))}
            postCount={competitorPostCount}
          />
        </div>
      </div>
    </div>
  )
}
