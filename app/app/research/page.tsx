import { Newspaper } from 'lucide-react'
import { requireAccountId } from '@/lib/auth/session'
import { listResearchItems } from '@/lib/db/research'
import { ensureResearchFocus } from '@/lib/integrations/research-focus'
import { RunResearchButton } from '@/components/research/run-research-button'
import { ResearchBrowser } from '@/components/research/research-browser'
import { ResearchFocusPanel } from '@/components/research/research-focus-panel'

export default async function ResearchPage() {
  const { accountId } = await requireAccountId()
  const [items, focus] = await Promise.all([
    listResearchItems(accountId, { limit: 60 }),
    ensureResearchFocus(accountId),
  ])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Research</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Fresh signal on your topics — web/blogs, Hacker News, and LinkedIn — gathered daily.
              Filter, scan, and send any item to chat to draft a post from it.
            </p>
          </div>
          <RunResearchButton />
        </header>

        <ResearchFocusPanel
          focus={{ topics: focus.topics, exclusions: focus.exclusions, source: focus.source }}
        />

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">
              <Newspaper className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="text-sm font-medium text-neutral-900">No research yet</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
              Click “Run research now” to pull the latest on your topics.
            </p>
          </div>
        ) : (
          <ResearchBrowser items={items} />
        )}
      </div>
    </div>
  )
}
