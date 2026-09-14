'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Compass, RefreshCw } from 'lucide-react'
import { proposeBatchAction } from '@/app/actions/choose'
import type { ChooseBatch } from '@/lib/choose/batch'
import { AngleCard } from './angle-card'

const POLL_MS = 5_000
const POLL_LIMIT_MS = 130_000

export function ChooseView({
  batch,
  generating,
  hasSkill,
  researchCount,
}: {
  batch: ChooseBatch | null
  generating: boolean
  hasSkill: boolean
  researchCount: number
}) {
  const router = useRouter()
  const [focus, setFocus] = useState(batch?.focus ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // A generation already running when the page loaded (e.g. after a reload): keep
  // showing the loading state and re-read until it lands. Database reads only.
  useEffect(() => {
    if (!generating) return
    const startedAt = Date.now()
    const timer = setInterval(() => {
      if (Date.now() - startedAt > POLL_LIMIT_MS) {
        clearInterval(timer)
        return
      }
      router.refresh()
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [generating, router])

  const propose = () => {
    setMessage(null)
    startTransition(async () => {
      const res = await proposeBatchAction(focus)
      if (res.ok) router.refresh()
      else setMessage(res.message ?? 'Something went wrong.')
    })
  }

  const busy = pending || generating
  const label = busy ? 'Proposing…' : batch ? 'New batch' : 'Propose angles'

  return (
    <div className="flex flex-col gap-5">
      {researchCount === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-2.5 text-sm text-amber-900">
          No research from the last 7 days, so angles can&rsquo;t cite sources.{' '}
          <Link href="/app/research" className="font-medium underline">
            Open Research
          </Link>
        </p>
      ) : null}

      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        {!batch && !busy ? (
          <p className="mb-3 text-sm text-neutral-600">
            Get 3 angles for your next posts, built from your skill and this week&rsquo;s research.
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            maxLength={300}
            placeholder="Optional: what should this batch lean into?"
            disabled={busy || !hasSkill}
            className="h-10 flex-1 rounded-lg border border-neutral-200 px-3 text-sm outline-none focus:border-[var(--brand-accent)] disabled:bg-neutral-50"
          />
          <button
            type="button"
            onClick={propose}
            disabled={busy || !hasSkill}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--brand-accent)] px-4 text-sm font-medium text-[var(--brand-accent-foreground)] disabled:opacity-50"
          >
            {batch ? <RefreshCw className="h-4 w-4" aria-hidden /> : <Compass className="h-4 w-4" aria-hidden />}
            {label}
          </button>
        </div>
        {!hasSkill ? (
          <p className="mt-2 text-sm text-neutral-500">
            No skill yet — finish onboarding first.{' '}
            <Link href="/onboarding" className="font-medium text-[var(--brand-accent)]">
              Go to onboarding
            </Link>
          </p>
        ) : null}
        {message ? <p className="mt-2 text-sm text-red-600">{message}</p> : null}
      </div>

      {busy ? (
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-100/70"
            />
          ))}
        </div>
      ) : batch ? (
        <div className="grid gap-3 md:grid-cols-3">
          {batch.angles.map((angle) => (
            <AngleCard key={angle.id} batchId={batch.id} angle={angle} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
