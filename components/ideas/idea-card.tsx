'use client'

import { useState, useTransition } from 'react'
import { PenLine, X } from 'lucide-react'
import { writeIdeaAction, dismissIdeaAction } from '@/app/actions/ideas'
import { cn } from '@/lib/utils'

export interface IdeaCardData {
  id: string
  topic: string
  angle: string | null
  structure: string | null
  hook: string | null
  rationale: string | null
  sources: string[]
}

export function IdeaCard({ idea }: { idea: IdeaCardData }) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)
  const [gone, setGone] = useState(false)

  const write = () => {
    startTransition(async () => {
      const r = await writeIdeaAction(idea.id)
      setResult(r.message)
      if (r.ok) setGone(true)
    })
  }
  const dismiss = () => {
    startTransition(async () => {
      await dismissIdeaAction(idea.id)
      setGone(true)
    })
  }

  if (gone && !result) return null

  return (
    <div className={cn('rounded-2xl border border-neutral-200 bg-white p-4', gone && 'opacity-60')}>
      <h3 className="text-sm font-semibold text-neutral-900 [overflow-wrap:anywhere]">
        {idea.topic}
      </h3>
      {idea.structure ? (
        <p className="mt-1.5 rounded-md bg-neutral-50 px-2 py-1 text-xs text-neutral-500 [overflow-wrap:anywhere]">
          {idea.structure}
        </p>
      ) : null}

      {idea.angle ? (
        <p className="mt-2 text-sm text-neutral-700 [overflow-wrap:anywhere]">{idea.angle}</p>
      ) : null}
      {idea.hook ? (
        <p className="mt-2 border-l-2 border-[var(--brand-accent)] pl-2 text-sm text-neutral-600 italic">
          “{idea.hook}”
        </p>
      ) : null}
      {idea.rationale ? (
        <p className="mt-2 text-xs text-neutral-500">Why now: {idea.rationale}</p>
      ) : null}

      {idea.sources.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {idea.sources.slice(0, 4).map((s, i) => {
            const isUrl = /^https?:\/\//i.test(s)
            return isUrl ? (
              <a
                key={i}
                href={s}
                target="_blank"
                rel="noreferrer"
                className="max-w-[12rem] truncate rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500 hover:text-[var(--brand-accent)]"
              >
                {s.replace(/^https?:\/\/(www\.)?/, '')}
              </a>
            ) : (
              <span key={i} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">
                {s}
              </span>
            )
          })}
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2 border-t border-neutral-100 pt-3">
        <button
          onClick={write}
          disabled={pending || gone}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-accent)] px-3 py-1.5 text-xs font-medium text-[var(--brand-accent-foreground)] disabled:opacity-50"
        >
          <PenLine className="h-3.5 w-3.5" aria-hidden />
          {pending ? 'Writing…' : 'Write this'}
        </button>
        <button
          onClick={dismiss}
          disabled={pending || gone}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-400 hover:text-red-500 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Dismiss
        </button>
      </div>

      {result ? <p className="mt-2 text-xs text-emerald-700">{result}</p> : null}
    </div>
  )
}
