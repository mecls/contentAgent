'use client'

import { useMemo, useState, useTransition } from 'react'
import { ChevronDown, ChevronUp, Image as ImageIcon, X } from 'lucide-react'
import { updateMetricsAction } from '@/app/actions/posts'
import { PostCard, statusStyles, type PostCardData } from '@/components/posts/post-card'
import { cn, formatDate } from '@/lib/utils'

type Metrics = PostCardData['metrics']
type MetricKey = 'impressions' | 'reactions' | 'comments' | 'reposts' | 'engagement_rate'
type SortKey = 'post' | 'date' | 'status' | MetricKey

const METRIC_COLS: { key: MetricKey; label: string; step?: string }[] = [
  { key: 'impressions', label: 'Impressions' },
  { key: 'reactions', label: 'Reactions' },
  { key: 'comments', label: 'Comments' },
  { key: 'reposts', label: 'Reposts' },
  { key: 'engagement_rate', label: 'Eng. %', step: '0.01' },
]

const statusOrder: Record<string, number> = { draft: 0, approved: 1, posted: 2 }

function titleOf(p: PostCardData): string {
  return (p.hook?.trim() || p.body.trim().split('\n')[0] || '').trim() || '(untitled)'
}
function numOrUndef(v: number | undefined): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}
/** Engagement rate: explicit value, else derived from impressions. */
function engOf(m: Metrics): number | undefined {
  if (typeof m.engagement_rate === 'number') return m.engagement_rate
  if (m.impressions && m.impressions > 0) {
    return (((m.reactions ?? 0) + (m.comments ?? 0)) / m.impressions) * 100
  }
  return undefined
}
function avg(xs: number[]): number | null {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null
}
function fmtAvg(n: number | null, digits = 0): string {
  return n == null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: digits })
}

export function PostsView({ posts }: { posts: PostCardData[] }) {
  // Local copy of metrics so table edits feel instant and survive re-sorts.
  const [metricsById, setMetricsById] = useState<Record<string, Metrics>>(() =>
    Object.fromEntries(posts.map((p) => [p.id, { ...p.metrics }])),
  )
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const getM = (p: PostCardData): Metrics => metricsById[p.id] ?? p.metrics ?? {}

  // Average engagement per tag — the A/B view of what performs best.
  const tagPerf = useMemo(() => {
    const byTag = new Map<string, PostCardData[]>()
    for (const p of posts) {
      for (const t of p.tags) {
        const a = byTag.get(t) ?? []
        a.push(p)
        byTag.set(t, a)
      }
    }
    const numbers = (ps: PostCardData[], pick: (m: Metrics) => number | undefined) =>
      ps.map((p) => pick(getM(p))).filter((n): n is number => typeof n === 'number')
    return [...byTag.entries()]
      .map(([tag, ps]) => ({
        tag,
        count: ps.length,
        avgReactions: avg(numbers(ps, (m) => m.reactions)),
        avgComments: avg(numbers(ps, (m) => m.comments)),
        avgEng: avg(numbers(ps, engOf)),
      }))
      .sort((a, b) => (b.avgReactions ?? -1) - (a.avgReactions ?? -1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, metricsById])

  const visible = useMemo(
    () => (activeTag ? posts.filter((p) => p.tags.includes(activeTag)) : posts),
    [posts, activeTag],
  )

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...visible].sort((a, b) => {
      let av: number | string
      let bv: number | string
      if (sortKey === 'post') {
        av = titleOf(a).toLowerCase()
        bv = titleOf(b).toLowerCase()
      } else if (sortKey === 'date') {
        av = a.createdAt
        bv = b.createdAt
      } else if (sortKey === 'status') {
        av = statusOrder[a.status] ?? 0
        bv = statusOrder[b.status] ?? 0
      } else {
        av = numOrUndef(getM(a)[sortKey]) ?? -Infinity
        bv = numOrUndef(getM(b)[sortKey]) ?? -Infinity
      }
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sortKey, sortDir, metricsById])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'post' ? 'asc' : 'desc')
  }

  const setMetric = (id: string, key: MetricKey, v: number | undefined) =>
    setMetricsById((m) => ({ ...m, [id]: { ...(m[id] ?? {}), [key]: v } }))

  const saveRow = (id: string) => {
    const m = metricsById[id] ?? {}
    setSavingId(id)
    startTransition(async () => {
      await updateMetricsAction(id, {
        impressions: numOrUndef(m.impressions),
        reactions: numOrUndef(m.reactions),
        comments: numOrUndef(m.comments),
        reposts: numOrUndef(m.reposts),
        engagement_rate: numOrUndef(m.engagement_rate),
      })
      setSavingId((s) => (s === id ? null : s))
    })
  }

  const focusPost = (id: string) => {
    setHighlightId(id)
    if (typeof document !== 'undefined') {
      document
        .getElementById(`post-${id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    setTimeout(() => setHighlightId((h) => (h === id ? null : h)), 2200)
  }

  const toggleTagFilter = (tag: string) =>
    setActiveTag((t) => (t === tag ? null : tag))

  return (
    <div className="flex flex-col gap-6">
      {/* Performance by tag — which topics/styles get the best engagement */}
      {tagPerf.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-100 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-neutral-900">Performance by tag</h2>
            <p className="text-xs text-neutral-500">
              Averages over posts that have each metric. Click a tag to filter below.
            </p>
          </div>
          <div className="max-h-[40vh] overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-neutral-50 text-xs text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Tag</th>
                  <th className="px-3 py-2 text-right font-medium">Posts</th>
                  <th className="px-3 py-2 text-right font-medium">Avg reactions</th>
                  <th className="px-3 py-2 text-right font-medium">Avg comments</th>
                  <th className="px-3 py-2 text-right font-medium">Avg eng. %</th>
                </tr>
              </thead>
              <tbody>
                {tagPerf.map((r) => (
                  <tr
                    key={r.tag}
                    onClick={() => toggleTagFilter(r.tag)}
                    className={cn(
                      'cursor-pointer border-t border-neutral-100 hover:bg-neutral-50',
                      activeTag === r.tag && 'bg-[var(--brand-accent)]/5',
                    )}
                  >
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          activeTag === r.tag
                            ? 'bg-[var(--brand-accent)]/15 text-[var(--brand-accent)]'
                            : 'bg-neutral-100 text-neutral-600',
                        )}
                      >
                        {r.tag}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-500">{r.count}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-800">{fmtAvg(r.avgReactions)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-800">{fmtAvg(r.avgComments)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-800">{fmtAvg(r.avgEng, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Active filter indicator */}
      {activeTag ? (
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <span>
            Showing <span className="font-medium">{visible.length}</span> post
            {visible.length === 1 ? '' : 's'} tagged
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--brand-accent)]">
            {activeTag}
            <button onClick={() => setActiveTag(null)} aria-label="Clear filter">
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        </div>
      ) : null}

      {/* Analytics overview — all posts, all metrics, at a glance */}
      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="max-h-[52vh] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-neutral-50">
              <tr>
                <Th label="Post" align="left" active={sortKey === 'post'} dir={sortDir} onClick={() => toggleSort('post')} />
                <Th label="Date" active={sortKey === 'date'} dir={sortDir} onClick={() => toggleSort('date')} />
                {METRIC_COLS.map((c) => (
                  <Th key={c.key} label={c.label} active={sortKey === c.key} dir={sortDir} onClick={() => toggleSort(c.key)} />
                ))}
                <Th label="Status" align="left" active={sortKey === 'status'} dir={sortDir} onClick={() => toggleSort('status')} />
                <th className="bg-neutral-50 px-3 py-2 text-left text-xs font-medium text-neutral-500">Tags</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const m = getM(p)
                const computedEng =
                  m.impressions && m.impressions > 0
                    ? (((numOrUndef(m.reactions) ?? 0) + (numOrUndef(m.comments) ?? 0)) / m.impressions) * 100
                    : undefined
                return (
                  <tr key={p.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                    <td className="px-3 py-1.5">
                      <button
                        onClick={() => focusPost(p.id)}
                        title={titleOf(p)}
                        className="flex max-w-[260px] items-center gap-2 text-left font-medium text-neutral-800 hover:text-[var(--brand-accent)]"
                      >
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.imageUrl}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-neutral-100 text-neutral-300">
                            <ImageIcon className="h-4 w-4" aria-hidden />
                          </span>
                        )}
                        <span className="truncate">{titleOf(p)}</span>
                      </button>
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-neutral-500">
                      {formatDate(p.createdAt)}
                    </td>
                    {METRIC_COLS.map((c) => {
                      const val = m[c.key]
                      const placeholder =
                        c.key === 'engagement_rate' && val == null && computedEng != null
                          ? computedEng.toFixed(2)
                          : '—'
                      return (
                        <td key={c.key} className="px-2 py-1">
                          <input
                            type="number"
                            step={c.step}
                            value={val ?? ''}
                            placeholder={placeholder}
                            onChange={(e) =>
                              setMetric(
                                p.id,
                                c.key,
                                e.target.value === '' ? undefined : Number(e.target.value),
                              )
                            }
                            onBlur={() => saveRow(p.id)}
                            className={cn(
                              'w-20 rounded-md border px-2 py-1 text-right tabular-nums outline-none focus:border-[var(--brand-accent)]',
                              val == null
                                ? 'border-amber-200 bg-amber-50/40 placeholder:text-amber-500'
                                : 'border-neutral-200',
                            )}
                          />
                        </td>
                      )
                    })}
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          statusStyles[p.status],
                        )}
                      >
                        {p.status}
                      </span>
                      {savingId === p.id ? (
                        <span className="ml-1.5 text-[10px] text-neutral-400">saving…</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {p.tags.length === 0 ? (
                          <span className="text-xs text-neutral-300">—</span>
                        ) : (
                          p.tags.map((t) => (
                            <button
                              key={t}
                              onClick={() => toggleTagFilter(t)}
                              className={cn(
                                'rounded-full px-2 py-0.5 text-xs',
                                activeTag === t
                                  ? 'bg-[var(--brand-accent)]/15 text-[var(--brand-accent)]'
                                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
                              )}
                            >
                              {t}
                            </button>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Full posts below — collapsed by default, click a table row to jump here */}
      <div className="flex flex-col gap-3">
        {sorted.map((p) => (
          <div key={p.id} id={`post-${p.id}`} className="scroll-mt-4">
            <PostCard post={p} highlighted={highlightId === p.id} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Th({
  label,
  active,
  dir,
  onClick,
  align = 'right',
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={cn(
        'bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-500',
        align === 'left' ? 'text-left' : 'text-right',
      )}
    >
      <button
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 hover:text-neutral-800',
          align === 'right' && 'flex-row-reverse',
          active && 'text-neutral-900',
        )}
      >
        {label}
        {active ? (
          dir === 'asc' ? (
            <ChevronUp className="h-3 w-3" aria-hidden />
          ) : (
            <ChevronDown className="h-3 w-3" aria-hidden />
          )
        ) : null}
      </button>
    </th>
  )
}
