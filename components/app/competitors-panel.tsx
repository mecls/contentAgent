'use client'

import { useState, useTransition } from 'react'
import { Users, RefreshCw, Trash2 } from 'lucide-react'
import {
  addCompetitorAction,
  removeCompetitorAction,
  runCompetitorsNowAction,
} from '@/app/actions/competitors'
import { cn } from '@/lib/utils'

export interface CompetitorLite {
  id: string
  profile_url: string
  name: string | null
}

export function CompetitorsPanel({
  competitors,
  postCount,
}: {
  competitors: CompetitorLite[]
  postCount: number
}) {
  const [url, setUrl] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const add = () =>
    startTransition(async () => {
      const r = await addCompetitorAction(url)
      setMsg({ ok: r.ok, text: r.message })
      if (r.ok) setUrl('')
    })
  const remove = (id: string) => startTransition(() => removeCompetitorAction(id))
  const runNow = () =>
    startTransition(async () => {
      const r = await runCompetitorsNowAction()
      setMsg({ ok: r.ok, text: r.message })
    })

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
          <Users className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-900">Competitor profiles</p>
          <p className="text-xs text-neutral-400">
            ~10 LinkedIn creators to study. Weekly, we scrape their latest posts and extract what makes
            them work — to inform your ideas (never to copy their voice).
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.linkedin.com/in/their-handle"
          className="h-10 flex-1 rounded-lg border border-neutral-200 px-3 text-sm outline-none focus:border-[var(--brand-accent)]"
        />
        <button
          onClick={add}
          disabled={pending}
          className="h-10 shrink-0 rounded-lg bg-[var(--brand-accent)] px-4 text-sm font-medium text-[var(--brand-accent-foreground)] disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {competitors.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1">
          {competitors.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-lg border border-neutral-100 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">
                {c.name ?? c.profile_url.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '@').replace(/\/$/, '')}
              </span>
              <button
                onClick={() => remove(c.id)}
                disabled={pending}
                aria-label="Remove competitor"
                className="rounded p-1 text-neutral-300 hover:text-red-500 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-neutral-100 pt-4 text-xs text-neutral-500">
        <span>
          Analyzed posts: <span className="text-neutral-700">{postCount}</span>
        </span>
        <button
          onClick={runNow}
          disabled={pending || competitors.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)] disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', pending && 'animate-spin')} aria-hidden />
          {pending ? 'Running…' : 'Analyze now'}
        </button>
      </div>

      {msg ? (
        <p className={cn('mt-3 rounded-lg px-3 py-2 text-xs', msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
          {msg.text}
        </p>
      ) : null}
    </div>
  )
}
