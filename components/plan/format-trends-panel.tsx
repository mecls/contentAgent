import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import type { FormatTrend } from '@/lib/integrations/analyze-formats'
import { cn } from '@/lib/utils'

const DIRECTION = {
  rising: { icon: TrendingUp, cls: 'text-emerald-600', label: 'rising' },
  falling: { icon: TrendingDown, cls: 'text-red-500', label: 'falling' },
  steady: { icon: Minus, cls: 'text-neutral-400', label: 'steady' },
} as const

/** Read-only ranking of which structural formats are working now (competitor signal). */
export function FormatTrendsPanel({ trends }: { trends: FormatTrend[] }) {
  if (trends.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-5 py-6 text-sm text-neutral-500">
        No format trends yet. Add competitors on the Integrations page and run the weekly competitor
        analysis — trending formats are aggregated from their posts and ranked by recent engagement.
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">Trending formats</h2>
      <p className="mt-0.5 text-xs text-neutral-500">
        What’s working now, from competitor posts — ranked by recent engagement.
      </p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {trends.slice(0, 8).map((t) => {
          const d = DIRECTION[t.direction]
          const Icon = d.icon
          return (
            <li
              key={t.formatKey}
              className="flex items-center gap-3 rounded-lg bg-neutral-50 px-3 py-2"
            >
              <span className="flex-1 truncate text-sm font-medium text-neutral-800">{t.label}</span>
              <span className="hidden text-xs text-neutral-400 sm:inline">{t.share}% of recent</span>
              <span className="w-16 text-right text-xs text-neutral-500">
                {t.recentAvg != null ? `${Math.round(t.recentAvg)} eng` : '—'}
              </span>
              <span className={cn('inline-flex w-16 items-center gap-1 text-xs', d.cls)}>
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {d.label}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
