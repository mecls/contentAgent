'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { runResearchNowAction } from '@/app/actions/research'

export function RunResearchButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() =>
          startTransition(async () => {
            setMsg((await runResearchNowAction()).message)
            // revalidatePath alone doesn't repaint this SPA view — force a refetch.
            router.refresh()
          })
        }
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)] disabled:opacity-50"
      >
        <RefreshCw className={pending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
        {pending ? 'Researching…' : 'Run research now'}
      </button>
      {msg ? <span className="text-xs text-neutral-500">{msg}</span> : null}
    </div>
  )
}
