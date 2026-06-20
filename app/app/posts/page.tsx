import { FileText } from 'lucide-react'
import { requireAccountId } from '@/lib/auth/session'
import { listPosts } from '@/lib/db/posts'
import { PostsView } from '@/components/posts/posts-view'
import { cn } from '@/lib/utils'

export default async function PostsPage() {
  const { accountId } = await requireAccountId()
  const posts = await listPosts(accountId)

  const posted = posts.filter((p) => p.status === 'posted').length
  const approved = posts.filter((p) => p.status === 'approved').length
  const drafts = posts.filter((p) => p.status === 'draft').length

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900">Posts</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Drafts the agent generated and posts pulled from your LinkedIn — with
            their real engagement. Edit, log results, and mark what you publish;
            results feed the skill&rsquo;s improvement loop.
          </p>
          {posts.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Stat label="Posted" value={posted} tone="posted" />
              {approved > 0 ? <Stat label="Approved" value={approved} tone="approved" /> : null}
              <Stat label="Drafts" value={drafts} tone="draft" />
              <span className="text-xs text-neutral-400">{posts.length} total</span>
            </div>
          ) : null}
        </header>

        {posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">
              <FileText className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="text-sm font-medium text-neutral-900">No posts yet</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
              Head to the chat and ask the agent to draft a post — it&rsquo;ll show
              up here automatically.
            </p>
          </div>
        ) : (
          <PostsView
            posts={posts.map((p) => ({
              id: p.id,
              hook: p.hook,
              body: p.body,
              archetype: p.archetype,
              status: p.status,
              linkedinUrl: p.linkedin_url,
              imageUrl: p.image_url,
              metrics: p.metrics ?? {},
              tags: p.tags ?? [],
              createdAt: p.created_at,
            }))}
          />
        )}
      </div>
    </div>
  )
}

const STAT_TONES: Record<'posted' | 'approved' | 'draft', string> = {
  posted: 'bg-emerald-50 text-emerald-700',
  approved: 'bg-blue-50 text-blue-700',
  draft: 'bg-neutral-100 text-neutral-600',
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'posted' | 'approved' | 'draft'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        STAT_TONES[tone],
      )}
    >
      <span className="tabular-nums">{value}</span>
      <span className="font-normal opacity-80">{label}</span>
    </span>
  )
}
