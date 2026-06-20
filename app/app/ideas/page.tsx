import { Lightbulb } from 'lucide-react'
import { requireAccountId } from '@/lib/auth/session'
import { listIdeas } from '@/lib/db/ideas'
import { IdeaCard } from '@/components/ideas/idea-card'
import { GenerateIdeasButton } from '@/components/ideas/generate-button'

export default async function IdeasPage() {
  const { accountId } = await requireAccountId()
  // Standalone ideas only — ideas tied to a weekly plan live on the Plan page.
  const pending = (await listIdeas(accountId, 'pending')).filter((i) => !i.plan_id)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Ideas</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Post ideas generated from your topics, fresh research, and competitor patterns. Pick one
              and the agent drafts it using your skill.
            </p>
          </div>
          <GenerateIdeasButton />
        </header>

        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">
              <Lightbulb className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="text-sm font-medium text-neutral-900">No ideas yet</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
              Ideas are generated twice a day. Click “Generate ideas now” to create a batch — it works
              best once you’ve run some research and added a few competitors.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={{
                  id: idea.id,
                  topic: idea.topic,
                  angle: idea.angle,
                  structure: idea.structure,
                  hook: idea.hook,
                  rationale: idea.rationale,
                  sources: idea.sources ?? [],
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
