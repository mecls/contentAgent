'use client'

import { useState, useTransition } from 'react'
import { Target, RefreshCw, X, Plus } from 'lucide-react'
import {
  saveResearchFocusAction,
  regenerateResearchFocusAction,
} from '@/app/actions/research'
import { cn } from '@/lib/utils'

export interface ResearchFocusLite {
  topics: string[]
  exclusions: string[]
  source: 'auto' | 'user'
}

/** Small add/remove chip editor for one list (topics to keep, or themes to avoid). */
function ChipEditor({
  label,
  hint,
  tone,
  items,
  setItems,
  disabled,
}: {
  label: string
  hint: string
  tone: 'keep' | 'avoid'
  items: string[]
  setItems: (next: string[]) => void
  disabled: boolean
}) {
  const [draft, setDraft] = useState('')
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editVal, setEditVal] = useState('')

  const dedupe = (list: string[]): string[] => {
    const seen = new Set<string>()
    return list.filter((t) => {
      const k = t.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }
  const add = () => {
    const v = draft.trim()
    if (!v) return
    if (!items.some((t) => t.toLowerCase() === v.toLowerCase())) setItems([...items, v])
    setDraft('')
  }
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i))
  const startEdit = (i: number) => {
    setEditIdx(i)
    setEditVal(items[i])
  }
  const cancelEdit = () => {
    setEditIdx(null)
    setEditVal('')
  }
  const commitEdit = () => {
    if (editIdx === null) return
    const v = editVal.trim()
    const next = items.slice()
    if (!v) next.splice(editIdx, 1) // emptying a chip removes it
    else next[editIdx] = v
    setItems(dedupe(next))
    cancelEdit()
  }

  return (
    <div>
      <p className="text-xs font-medium text-neutral-700">{label}</p>
      <p className="mt-0.5 text-xs text-neutral-400">{hint}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <span className="text-xs text-neutral-400">None yet.</span>
        ) : (
          items.map((t, i) =>
            editIdx === i ? (
              <input
                key={`edit-${i}`}
                autoFocus
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitEdit()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    cancelEdit()
                  }
                }}
                onBlur={commitEdit}
                disabled={disabled}
                className="h-7 min-w-[14rem] flex-1 rounded-full border border-[var(--brand-accent)] bg-white px-3 text-xs outline-none"
              />
            ) : (
              <span
                key={`${t}-${i}`}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                  tone === 'avoid' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700',
                )}
              >
                <button
                  type="button"
                  onClick={() => startEdit(i)}
                  disabled={disabled}
                  title="Click to edit"
                  className="cursor-text text-left hover:underline disabled:no-underline"
                >
                  {t}
                </button>
                <button
                  onClick={() => remove(i)}
                  disabled={disabled}
                  aria-label={`Remove ${t}`}
                  className="opacity-60 hover:opacity-100 disabled:opacity-30"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            ),
          )
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder={tone === 'avoid' ? 'Add a theme to avoid…' : 'Add a topic…'}
          disabled={disabled}
          className="h-9 flex-1 rounded-lg border border-neutral-200 px-3 text-sm outline-none focus:border-[var(--brand-accent)] disabled:opacity-50"
        />
        <button
          onClick={add}
          disabled={disabled}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-neutral-200 px-3 text-sm font-medium text-neutral-700 hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)] disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add
        </button>
      </div>
    </div>
  )
}

export function ResearchFocusPanel({ focus }: { focus: ResearchFocusLite }) {
  const [topics, setTopics] = useState<string[]>(focus.topics)
  const [exclusions, setExclusions] = useState<string[]>(focus.exclusions)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const save = () =>
    startTransition(async () => {
      const r = await saveResearchFocusAction(topics, exclusions)
      setMsg({ ok: r.ok, text: r.message })
    })

  const regenerate = () =>
    startTransition(async () => {
      const r = await regenerateResearchFocusAction()
      setMsg({ ok: r.ok, text: r.message })
      // The action returns the freshly-derived lists — sync local state directly
      // (router data won't repaint this client component's useState).
      if (r.ok && r.topics) {
        setTopics(r.topics)
        setExclusions(r.exclusions ?? [])
      }
    })

  return (
    <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <Target className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-900">Research focus</p>
          <p className="text-xs text-neutral-400">
            What we research for you — auto-built from your profile and skill, editable anytime. Research
            targets these topics and drops anything off-niche before it reaches you.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <ChipEditor
          label="Topics to research"
          hint="Specific subjects you post about — click a chip to edit it. The more precise, the more relevant your feed."
          tone="keep"
          items={topics}
          setItems={setTopics}
          disabled={pending}
        />
        <ChipEditor
          label="Avoid (off-niche)"
          hint="Adjacent themes to keep out of your feed."
          tone="avoid"
          items={exclusions}
          setItems={setExclusions}
          disabled={pending}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-neutral-100 pt-4">
        <button
          onClick={save}
          disabled={pending}
          className="h-9 rounded-lg bg-[var(--brand-accent)] px-4 text-sm font-medium text-[var(--brand-accent-foreground)] disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={regenerate}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-sm font-medium text-neutral-700 hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)] disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', pending && 'animate-spin')} aria-hidden />
          Regenerate from profile
        </button>
        <span className="ml-auto text-xs text-neutral-400">
          {focus.source === 'user' ? 'Edited by you' : 'Auto-generated'}
        </span>
      </div>

      {msg ? (
        <p
          className={cn(
            'mt-3 rounded-lg px-3 py-2 text-xs',
            msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
          )}
        >
          {msg.text}
        </p>
      ) : null}
    </div>
  )
}
