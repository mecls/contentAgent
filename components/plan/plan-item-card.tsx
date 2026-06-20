'use client'

import { useState, useTransition } from 'react'
import { PenLine, X, LayoutTemplate, RefreshCw, Check } from 'lucide-react'
import {
  previewIdeaAction,
  saveIdeaDraftAction,
  dismissIdeaAction,
} from '@/app/actions/ideas'
import type { DraftPreview } from '@/lib/agent/draft-preview'
import { cn } from '@/lib/utils'

export interface PlanItemData {
  id: string
  topic: string
  angle: string | null
  hook: string | null
  rationale: string | null
  formatLabel: string
  day: string | null
  written: boolean
  sources: string[]
}

/**
 * A single post in a weekly plan. "Write this" GENERATES a draft for preview
 * (nothing is saved yet); the user reviews the real post text and then chooses to
 * save it to drafts, regenerate, or discard. Reuses the shared idea draft actions.
 */
export function PlanItemCard({ item }: { item: PlanItemData }) {
  const [pending, startTransition] = useTransition()
  const [draft, setDraft] = useState<DraftPreview | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [gone, setGone] = useState(false)

  const generate = () => {
    setResult(null)
    startTransition(async () => {
      const r = await previewIdeaAction(item.id)
      if (r.ok && r.draft) setDraft(r.draft)
      else setResult(r.message)
    })
  }
  const save = () => {
    if (!draft) return
    startTransition(async () => {
      const r = await saveIdeaDraftAction(item.id, draft)
      setResult(r.message)
      if (r.ok) {
        setDraft(null)
        setGone(true)
      }
    })
  }
  const dismiss = () => {
    startTransition(async () => {
      await dismissIdeaAction(item.id)
      setGone(true)
    })
  }

  if (gone && !result) return null
  const done = gone || item.written

  return (
    <div className={cn('rounded-2xl border border-neutral-200 bg-white p-4', done && 'opacity-60')}>
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-accent)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--brand-accent)]">
          <LayoutTemplate className="h-3 w-3" aria-hidden />
          {item.formatLabel}
        </span>
        {item.day ? <span className="text-[11px] text-neutral-400">{item.day}</span> : null}
        {item.written ? (
          <span className="ml-auto text-[11px] font-medium text-emerald-700">Drafted</span>
        ) : null}
      </div>

      <h3 className="text-sm font-semibold text-neutral-900 [overflow-wrap:anywhere]">{item.topic}</h3>
      {item.angle ? (
        <p className="mt-2 text-sm text-neutral-700 [overflow-wrap:anywhere]">{item.angle}</p>
      ) : null}
      {item.hook ? (
        <p className="mt-2 border-l-2 border-[var(--brand-accent)] pl-2 text-sm text-neutral-600 italic">
          “{item.hook}”
        </p>
      ) : null}
      {item.rationale ? (
        <p className="mt-2 text-xs text-neutral-500">Why this slot: {item.rationale}</p>
      ) : null}

      {item.sources.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.sources.slice(0, 4).map((s, i) => {
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

      {/* Preview of the generated post — shown before anything is saved. */}
      {draft ? (
        <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <p className="mb-1.5 text-[11px] font-medium tracking-wide text-neutral-400 uppercase">
            Preview
          </p>
          <p className="text-sm whitespace-pre-wrap text-neutral-800 [overflow-wrap:anywhere]">
            {draft.body}
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2 border-t border-neutral-100 pt-3">
        {draft ? (
          <>
            <button
              onClick={save}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-accent)] px-3 py-1.5 text-xs font-medium text-[var(--brand-accent-foreground)] disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              {pending ? 'Saving…' : 'Save to drafts'}
            </button>
            <button
              onClick={generate}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)] disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Regenerate
            </button>
            <button
              onClick={() => setDraft(null)}
              disabled={pending}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-400 hover:text-red-500 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Discard
            </button>
          </>
        ) : (
          <>
            <button
              onClick={generate}
              disabled={pending || done}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-accent)] px-3 py-1.5 text-xs font-medium text-[var(--brand-accent-foreground)] disabled:opacity-50"
            >
              <PenLine className="h-3.5 w-3.5" aria-hidden />
              {pending ? 'Writing…' : item.written ? 'Drafted' : 'Write this'}
            </button>
            <button
              onClick={dismiss}
              disabled={pending || done}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-400 hover:text-red-500 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Dismiss
            </button>
          </>
        )}
      </div>

      {result ? <p className="mt-2 text-xs text-emerald-700">{result}</p> : null}
    </div>
  )
}
