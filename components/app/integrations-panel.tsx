'use client'

import { useState, useTransition } from 'react'
import { Plug, RefreshCw } from 'lucide-react'
import {
  connectApifyAction,
  runScrapeNowAction,
  type ActionResult,
} from '@/app/actions/integrations'
import { cn, formatDateTime } from '@/lib/utils'

export interface IntegrationPanelData {
  connected: boolean
  profileUrl: string
  status: string
  lastScrapedAt: string | null
  scrapedCount: number
}

export function IntegrationsPanel({ data }: { data: IntegrationPanelData }) {
  const [url, setUrl] = useState(data.profileUrl)
  const [result, setResult] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  const connect = () => {
    startTransition(async () => {
      setResult(await connectApifyAction(url))
    })
  }

  const runNow = () => {
    startTransition(async () => {
      setResult(await runScrapeNowAction())
    })
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0a66c2]/10 text-[#0a66c2]">
          <Plug className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-900">LinkedIn profile posts</p>
          <p className="text-xs text-neutral-400">
            Scrapes your posts weekly (reactions, comments, reposts) and feeds them into your skill.
            {data.connected ? (
              <span
                className={cn(
                  'ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium',
                  data.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-neutral-100 text-neutral-500',
                )}
              >
                {data.status}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <label className="block text-xs font-medium text-neutral-500">
        Your LinkedIn profile URL
      </label>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.linkedin.com/in/your-handle"
          className="h-10 flex-1 rounded-lg border border-neutral-200 px-3 text-sm outline-none focus:border-[var(--brand-accent)]"
        />
        <button
          onClick={connect}
          disabled={pending}
          className="h-10 shrink-0 rounded-lg bg-[var(--brand-accent)] px-4 text-sm font-medium text-[var(--brand-accent-foreground)] disabled:opacity-50"
        >
          {data.connected ? 'Update' : 'Connect'}
        </button>
      </div>

      {data.connected ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-neutral-100 pt-4 text-xs text-neutral-500">
          <span>
            Last scraped:{' '}
            <span className="text-neutral-700">
              {data.lastScrapedAt ? `${formatDateTime(data.lastScrapedAt)} UTC` : 'never'}
            </span>
          </span>
          <span>
            Scraped posts: <span className="text-neutral-700">{data.scrapedCount}</span>
          </span>
          <button
            onClick={runNow}
            disabled={pending}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)] disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', pending && 'animate-spin')} aria-hidden />
            {pending ? 'Running…' : 'Run now'}
          </button>
        </div>
      ) : null}

      {result ? (
        <p
          className={cn(
            'mt-3 rounded-lg px-3 py-2 text-xs',
            result.ok
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-red-50 text-red-700',
          )}
        >
          {result.message}
        </p>
      ) : null}
    </div>
  )
}
