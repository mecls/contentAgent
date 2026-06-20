'use client'

import { useState, useTransition } from 'react'
import { Check, ChevronDown, ChevronRight, Pencil, Tag, Trash2, X } from 'lucide-react'
import {
  updatePostAction,
  togglePostedAction,
  deletePostAction,
  updateTagsAction,
} from '@/app/actions/posts'
import { cn, formatDate } from '@/lib/utils'

interface Metrics {
  impressions?: number
  reactions?: number
  comments?: number
  reposts?: number
  engagement_rate?: number
}

export interface PostCardData {
  id: string
  hook: string | null
  body: string
  archetype: string | null
  status: 'draft' | 'approved' | 'posted'
  linkedinUrl: string | null
  imageUrl: string | null
  metrics: Metrics
  tags: string[]
  createdAt: string
}

export const statusStyles: Record<string, string> = {
  draft: 'bg-neutral-100 text-neutral-600',
  approved: 'bg-[var(--brand-accent)]/10 text-[var(--brand-accent)]',
  posted: 'bg-emerald-100 text-emerald-700',
}

export function PostCard({
  post,
  highlighted = false,
}: {
  post: PostCardData
  highlighted?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [body, setBody] = useState(post.body)
  const [hook, setHook] = useState(post.hook ?? '')
  const [archetype, setArchetype] = useState(post.archetype ?? '')
  const [linkedinUrl, setLinkedinUrl] = useState(post.linkedinUrl ?? '')
  const [imageUrl, setImageUrl] = useState(post.imageUrl ?? '')
  const [pending, startTransition] = useTransition()

  const saveEdits = () => {
    startTransition(async () => {
      await updatePostAction(post.id, {
        hook,
        body,
        archetype,
        linkedin_url: linkedinUrl.trim() || null,
        image_url: imageUrl.trim() || null,
      })
      setEditing(false)
    })
  }

  const togglePosted = () => {
    startTransition(async () => {
      await togglePostedAction(post.id, post.status !== 'posted')
    })
  }

  const remove = () => {
    if (!confirm('Delete this post?')) return
    startTransition(async () => {
      await deletePostAction(post.id)
    })
  }

  return (
    <div
      className={cn(
        'rounded-2xl border bg-white p-4 transition-colors',
        highlighted
          ? 'border-[var(--brand-accent)] ring-2 ring-[var(--brand-accent)]/40'
          : 'border-neutral-200',
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
            statusStyles[post.status],
          )}
        >
          {post.status}
        </span>
        {post.archetype ? (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
            {post.archetype}
          </span>
        ) : null}
        <span className="ml-auto text-xs text-neutral-400">
          {formatDate(post.createdAt)}
        </span>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <input
            value={hook}
            onChange={(e) => setHook(e.target.value)}
            placeholder="Hook"
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[var(--brand-accent)]"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="resize-y rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[var(--brand-accent)]"
          />
          <input
            value={archetype}
            onChange={(e) => setArchetype(e.target.value)}
            placeholder="Archetype"
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[var(--brand-accent)]"
          />
          <input
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="LinkedIn URL (paste after publishing — lets weekly scrapes track this post)"
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[var(--brand-accent)]"
          />
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Image URL (the creative shown with the post)"
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[var(--brand-accent)]"
          />
          <div className="flex gap-2">
            <button
              onClick={saveEdits}
              disabled={pending}
              className="rounded-lg bg-[var(--brand-accent)] px-3 py-1.5 text-xs font-medium text-[var(--brand-accent-foreground)] disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          {post.imageUrl ? (
            <a
              href={post.imageUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0"
              title="Open full image"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.imageUrl}
                alt=""
                className="h-16 w-16 rounded-lg border border-neutral-200 object-cover"
              />
            </a>
          ) : null}
          <div className="min-w-0 flex-1">
            {!expanded ? (
              <button
                onClick={() => setExpanded(true)}
                className="flex w-full items-start gap-2 text-left"
              >
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                <span className="line-clamp-2 text-sm text-neutral-800 [overflow-wrap:anywhere]">
                  {post.body}
                </span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => setExpanded(false)}
                  className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700"
                >
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                  Collapse
                </button>
                <p className="text-sm whitespace-pre-wrap text-neutral-800 [overflow-wrap:anywhere]">
                  {post.body}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {!editing ? <MetricSummary metrics={post.metrics} /> : null}

      {!editing ? <TagEditor postId={post.id} initial={post.tags} /> : null}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2 border-t border-neutral-100 pt-3">
        <button
          onClick={togglePosted}
          disabled={pending}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50',
            post.status === 'posted'
              ? 'border border-neutral-200 text-neutral-600'
              : 'bg-emerald-600 text-white',
          )}
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
          {post.status === 'posted' ? 'Mark as draft' : 'Mark as posted'}
        </button>
        {!editing ? (
          <button
            onClick={() => {
              setExpanded(true)
              setEditing(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Edit
          </button>
        ) : null}
        <button
          onClick={remove}
          disabled={pending}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-400 hover:text-red-500 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  )
}

/** Editable keyword tags. Saves on add/remove; normalization is server-side. */
function TagEditor({ postId, initial }: { postId: string; initial: string[] }) {
  const [tags, setTags] = useState<string[]>(initial)
  const [draft, setDraft] = useState('')
  const [pending, startTransition] = useTransition()

  const commit = (next: string[]) => {
    setTags(next)
    startTransition(async () => {
      const saved = await updateTagsAction(postId, next)
      setTags(saved)
    })
  }
  const add = () => {
    const t = draft.trim().toLowerCase()
    setDraft('')
    if (t && !tags.includes(t)) commit([...tags, t])
  }
  const remove = (t: string) => commit(tags.filter((x) => x !== t))

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <Tag className="h-3.5 w-3.5 text-neutral-300" aria-hidden />
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
        >
          {t}
          <button
            onClick={() => remove(t)}
            disabled={pending}
            aria-label={`Remove ${t}`}
            className="text-neutral-400 hover:text-red-500 disabled:opacity-50"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add()
          }
        }}
        onBlur={add}
        placeholder="add tag"
        className="w-24 rounded-full border border-dashed border-neutral-200 px-2 py-0.5 text-xs outline-none focus:border-[var(--brand-accent)]"
      />
    </div>
  )
}

/** Compact, read-only one-liner. Full metric editing lives in the table above. */
function MetricSummary({ metrics }: { metrics: Metrics }) {
  const parts: string[] = []
  if (metrics.impressions != null)
    parts.push(`${metrics.impressions.toLocaleString()} impressions`)
  if (metrics.reactions != null)
    parts.push(`${metrics.reactions.toLocaleString()} reactions`)
  if (metrics.comments != null)
    parts.push(`${metrics.comments.toLocaleString()} comments`)
  if (metrics.reposts != null)
    parts.push(`${metrics.reposts.toLocaleString()} reposts`)
  if (metrics.engagement_rate != null)
    parts.push(`${metrics.engagement_rate}% eng.`)

  return parts.length === 0 ? (
    <p className="mt-3 text-xs text-neutral-400">
      No metrics yet — add them in the table above.
    </p>
  ) : (
    <p className="mt-3 text-xs text-neutral-500">{parts.join(' · ')}</p>
  )
}
