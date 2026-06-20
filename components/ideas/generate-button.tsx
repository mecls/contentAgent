'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { generateIdeasNowAction } from '@/app/actions/ideas'

export function GenerateIdeasButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() =>
          startTransition(async () => {
            setMsg((await generateIdeasNowAction()).message)
            router.refresh()
          })
        }
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)] disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        {pending ? 'Generating…' : 'Generate ideas now'}
      </button>
      {msg ? <span className="text-xs text-neutral-500">{msg}</span> : null}
    </div>
  )
}
