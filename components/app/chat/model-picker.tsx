'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Check, ChevronDown, Cpu } from 'lucide-react'
import {
  listChatModelsAction,
  setChatModelAction,
  type ChatModelsResult,
} from '@/app/actions/models'
import { cn } from '@/lib/utils'

function formatContext(n: number | null): string | null {
  if (!n) return null
  return n >= 1_000_000 ? `${Math.round(n / 1_000_000)}M` : `${Math.round(n / 1000)}K`
}

/**
 * Composer button to pick the chat's planning model from Ollama Cloud's models
 * that support tools. The list loads the first time it opens (never on page load)
 * and the choice is saved for the account.
 */
export function ModelPicker({
  initialModel,
  disabled,
}: {
  initialModel: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(initialModel)
  const [list, setList] = useState<ChatModelsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = async () => {
    const next = !open
    setOpen(next)
    setMessage(null)
    if (next && (!list || !list.ok) && !loading) {
      setLoading(true)
      const res = await listChatModelsAction()
      setList(res)
      setCurrent(res.current)
      if (!res.ok) setMessage(res.message ?? "Couldn't load the models.")
      setLoading(false)
    }
  }

  const choose = (id: string) => {
    if (id === current) {
      setOpen(false)
      return
    }
    startTransition(async () => {
      const res = await setChatModelAction(id)
      if (res.ok) {
        setCurrent(id)
        setOpen(false)
      } else {
        setMessage(res.message)
      }
    })
  }

  const defaultModel = list?.defaultModel

  return (
    <div ref={rootRef} className="relative ml-auto">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Planning model for this chat"
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 transition-colors hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)] disabled:opacity-50"
      >
        <Cpu className="h-3.5 w-3.5" aria-hidden />
        {current}
        <ChevronDown className="h-3 w-3" aria-hidden />
      </button>

      {open ? (
        <div className="absolute right-0 bottom-full z-20 mb-2 w-72 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 px-3 py-2">
            <p className="text-xs font-medium text-neutral-900">Planning model</p>
            <p className="text-[11px] text-neutral-500">
              Reads your skill and runs the chat. Post text is still written by the writer model.
              Applies from your next message.
            </p>
          </div>
          {loading ? <p className="px-3 py-3 text-xs text-neutral-500">Loading models…</p> : null}
          {message ? <p className="px-3 py-2 text-xs text-red-600">{message}</p> : null}
          {list?.models.length ? (
            <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
              {list.models.map((m) => {
                const selected = m.id === current
                const ctx = formatContext(m.contextLength)
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => choose(m.id)}
                      disabled={pending}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-60',
                        selected && 'font-medium text-[var(--brand-accent)]',
                      )}
                    >
                      <span className="flex w-3.5 shrink-0 justify-center">
                        {selected ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{m.id}</span>
                      {m.id === defaultModel ? (
                        <span className="text-[10px] text-neutral-400">default</span>
                      ) : null}
                      {ctx ? <span className="text-[10px] text-neutral-400">{ctx}</span> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
