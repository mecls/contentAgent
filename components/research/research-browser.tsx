'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ExternalLink, Search } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export interface ResearchItem {
  id: string
  source: string
  topic: string | null
  title: string | null
  url: string
  summary: string | null
  key_points: string[]
  author: string | null
  score: number | null
  fetched_at: string
}

const sourceStyles: Record<string, string> = {
  web: 'bg-sky-100 text-sky-700',
  hackernews: 'bg-orange-100 text-orange-700',
  linkedin: 'bg-blue-100 text-blue-700',
}

const sourceLabels: Record<string, string> = {
  web: 'Web',
  hackernews: 'Hacker News',
  linkedin: 'LinkedIn',
}

const sourceLabel = (s: string): string => sourceLabels[s] ?? s

const SOURCES = ['web', 'hackernews', 'linkedin'] as const

/** Build the chat prompt that drafts a post grounded in one research item. */
export function draftPromptFor(r: ResearchItem): string {
  return [
    'Draft a LinkedIn post based on this research item. First open the relevant skill (read_skill → read_skill_file for its constraints and archetypes), follow my voice and constraints exactly, ground the post in this item, then save_post when done.',
    '',
    `Title: ${r.title ?? r.url}`,
    `Source: ${r.source}`,
    `URL: ${r.url}`,
    r.summary ? `Summary: ${r.summary}` : '',
    r.key_points?.length ? `Key points:\n- ${r.key_points.join('\n- ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function ResearchBrowser({ items }: { items: ResearchItem[] }) {
  const router = useRouter()
  const [source, setSource] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of items) c[r.source] = (c[r.source] ?? 0) + 1
    return c
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((r) => {
      if (source && r.source !== source) return false
      if (!q) return true
      return (
        (r.title ?? '').toLowerCase().includes(q) ||
        (r.summary ?? '').toLowerCase().includes(q) ||
        (r.topic ?? '').toLowerCase().includes(q)
      )
    })
  }, [items, source, query])

  const draftInChat = (r: ResearchItem) => {
    router.push(`/app?prompt=${encodeURIComponent(draftPromptFor(r))}`)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={source === null} onClick={() => setSource(null)}>
          All ({items.length})
        </Chip>
        {SOURCES.filter((s) => counts[s]).map((s) => (
          <Chip key={s} active={source === s} onClick={() => setSource(s)}>
            {sourceLabel(s)} ({counts[s]})
          </Chip>
        ))}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, summary, topic…"
            className="w-56 rounded-lg border border-neutral-200 bg-white py-1.5 pr-3 pl-8 text-sm outline-none focus:border-[var(--brand-accent)]"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500">
          No items match this filter.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((r) => (
            <li key={r.id} className="rounded-xl border border-neutral-200 bg-white p-3.5">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${sourceStyles[r.source] ?? 'bg-neutral-100 text-neutral-600'}`}
                >
                  {sourceLabel(r.source)}
                </span>
                {r.topic ? (
                  <span className="truncate text-[11px] text-neutral-400">{r.topic}</span>
                ) : null}
                {r.author ? (
                  <span className="truncate text-[11px] text-neutral-400">· {r.author}</span>
                ) : null}
                <span className="ml-auto text-[11px] text-neutral-400">{formatDate(r.fetched_at)}</span>
              </div>

              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-start gap-1 text-sm font-medium text-neutral-900 hover:text-[var(--brand-accent)]"
              >
                {r.title ?? r.url}
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-neutral-400" aria-hidden />
              </a>

              {r.summary ? (
                <p className="mt-1 text-xs text-neutral-500">{r.summary}</p>
              ) : null}

              {r.key_points?.length ? (
                <ul className="mt-2 flex flex-col gap-0.5">
                  {r.key_points.slice(0, 4).map((k, i) => (
                    <li key={i} className="flex gap-1.5 text-xs text-neutral-600">
                      <span className="text-neutral-300">•</span>
                      <span className="min-w-0">{k}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-2.5">
                <button
                  onClick={() => draftInChat(r)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-accent)] px-3 py-1.5 text-xs font-medium text-[var(--brand-accent-foreground)] hover:opacity-90"
                >
                  Draft post in chat
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'rounded-full bg-[var(--brand-accent)] px-3 py-1 text-xs font-medium text-[var(--brand-accent-foreground)]'
          : 'rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 hover:border-[var(--brand-accent)]'
      }
    >
      {children}
    </button>
  )
}
