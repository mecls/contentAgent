'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ChevronRight, History, Pencil, RotateCcw } from 'lucide-react'
import { rollbackVersionAction, updateSkillFileAction } from '@/app/actions/skills'
import { cn, formatDateTime } from '@/lib/utils'

export interface FileVersionLite {
  id: string
  version: number
  change_type: string
  author: string
  created_at: string
}

export function SkillFileRow({
  slug,
  path,
  version,
  content,
  versions,
}: {
  slug: string
  path: string
  version: number
  content: string
  versions: FileVersionLite[]
}) {
  const [open, setOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(content)
  const [pending, startTransition] = useTransition()

  const startEdit = () => {
    setDraft(content)
    setEditing(true)
    setOpen(true)
  }

  const save = () => {
    startTransition(async () => {
      await updateSkillFileAction(slug, path, draft)
      setEditing(false)
    })
  }

  const rollback = (versionId: string) => {
    if (!confirm('Roll the file back to this version?')) return
    startTransition(async () => {
      await rollbackVersionAction(versionId)
    })
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
          )}
          <span className="truncate font-mono text-xs text-neutral-700">{path}</span>
        </button>
        <span className="text-[11px] text-neutral-400">v{version}</span>
        {!editing ? (
          <button
            onClick={startEdit}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
          >
            <Pencil className="h-3 w-3" aria-hidden />
            Edit
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="border-t border-neutral-100 px-3 py-2">
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={Math.min(24, Math.max(8, draft.split('\n').length + 1))}
                className="resize-y rounded-md border border-neutral-200 bg-white p-2.5 font-mono text-xs leading-relaxed outline-none focus:border-[var(--brand-accent)]"
              />
              <div className="flex gap-2">
                <button
                  onClick={save}
                  disabled={pending}
                  className="rounded-lg bg-[var(--brand-accent)] px-3 py-1.5 text-xs font-medium text-[var(--brand-accent-foreground)] disabled:opacity-50"
                >
                  {pending ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditing(false)
                    setDraft(content)
                  }}
                  disabled={pending}
                  className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600"
                >
                  Cancel
                </button>
                <span className="self-center text-[11px] text-neutral-400">
                  Saving creates a new version you can roll back to.
                </span>
              </div>
            </div>
          ) : (
            <pre className="max-h-72 overflow-auto rounded-md bg-neutral-50 p-2.5 text-xs whitespace-pre-wrap text-neutral-700">
              {content}
            </pre>
          )}

          {!editing ? (
            <button
              onClick={() => setShowHistory((s) => !s)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700"
            >
              <History className="h-3.5 w-3.5" aria-hidden />
              {showHistory ? 'Hide history' : `History (${versions.length})`}
            </button>
          ) : null}

          {showHistory && !editing ? (
            <ul className="mt-2 flex flex-col gap-1">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center gap-2 rounded-md bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600"
                >
                  <span className="font-medium">v{v.version}</span>
                  <span className="text-neutral-400">{v.change_type}</span>
                  <span className="text-neutral-400">· {v.author}</span>
                  <span className="ml-auto text-neutral-400">
                    {formatDateTime(v.created_at)}
                  </span>
                  <button
                    onClick={() => rollback(v.id)}
                    disabled={pending}
                    className={cn(
                      'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/10 disabled:opacity-50',
                    )}
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden />
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
