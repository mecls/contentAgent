import { FileText } from 'lucide-react'
import { requireAccountId } from '@/lib/auth/session'
import { listPosts } from '@/lib/db/posts'
import { PostsView } from '@/components/posts/posts-view'

export default async function PostsPage() {
  const { accountId } = await requireAccountId()
  const posts = await listPosts(accountId)

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
