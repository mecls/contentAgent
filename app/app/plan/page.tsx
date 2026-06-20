import { CalendarRange } from 'lucide-react'
import { requireAccountId } from '@/lib/auth/session'
import { getLatestPlan } from '@/lib/db/plans'
import { listIdeasByPlan } from '@/lib/db/ideas'
import { analyzeFormatTrends } from '@/lib/integrations/analyze-formats'
import { DEFAULT_PLATFORM, formatLabel } from '@/lib/formats/catalog'
import { FormatTrendsPanel } from '@/components/plan/format-trends-panel'
import { PlanItemCard } from '@/components/plan/plan-item-card'
import { GeneratePlanButton } from '@/components/plan/generate-plan-button'

function dayLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default async function PlanPage() {
  const { accountId } = await requireAccountId()
  const platform = DEFAULT_PLATFORM

  const [plan, trends] = await Promise.all([
    getLatestPlan(accountId),
    analyzeFormatTrends(accountId, platform).catch(() => []),
  ])
  const allItems = plan ? await listIdeasByPlan(accountId, plan.id) : []
  const items = allItems.filter((i) => i.status !== 'dismissed')

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Weekly plan</h1>
            <p className="mt-1 text-sm text-neutral-500">
              A balanced mix of posts for the week — each assigned a format and a day, leaning into the
              formats that are trending and the ones you personally win at. Pick one and the agent drafts
              it using your skill.
            </p>
          </div>
          <GeneratePlanButton />
        </header>

        <div className="mb-6">
          <FormatTrendsPanel trends={trends} />
        </div>

        {!plan || items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">
              <CalendarRange className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="text-sm font-medium text-neutral-900">No plan yet</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
              A plan is built weekly from your trending formats and research. Click “Generate plan now”
              to create one — it works best once you’ve added a few competitors and run some research.
            </p>
          </div>
        ) : (
          <>
            {plan.summary ? (
              <p className="mb-4 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                {plan.summary}
              </p>
            ) : null}
            <div className="flex flex-col gap-3">
              {items.map((i) => (
                <PlanItemCard
                  key={i.id}
                  item={{
                    id: i.id,
                    topic: i.topic,
                    angle: i.angle,
                    hook: i.hook,
                    rationale: i.rationale,
                    formatLabel: formatLabel(i.platform ?? platform, i.format),
                    day: dayLabel(i.planned_for),
                    written: i.status === 'written',
                    sources: i.sources ?? [],
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
