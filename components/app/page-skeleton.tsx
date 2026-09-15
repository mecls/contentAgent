import { cn } from '@/lib/utils'

const WIDTHS = { '3xl': 'max-w-3xl', '5xl': 'max-w-5xl' } as const

/**
 * The fallback each app route's loading.tsx renders. Every app page is dynamic, and
 * without a loading.tsx Next can't prefetch anything for it, so a click waits for
 * the whole server render. With one, the shell is prefetched and the page swaps in
 * at once — real title, placeholder content — while the data loads.
 */
export function PageSkeleton({
  title,
  width = '3xl',
  cards = 3,
}: {
  title: string
  width?: keyof typeof WIDTHS
  cards?: number
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto" aria-busy="true">
      <div className={cn('mx-auto w-full px-6 py-8', WIDTHS[width])}>
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
          <div className="mt-2.5 h-3 w-2/3 animate-pulse rounded bg-neutral-200/80" />
        </header>
        <div className="flex flex-col gap-4">
          {Array.from({ length: cards }, (_, i) => (
            <div
              key={i}
              className="flex animate-pulse flex-col gap-2.5 rounded-2xl border border-neutral-200 bg-white p-4"
            >
              <div className="h-3.5 w-1/3 rounded bg-neutral-200/80" />
              <div className="h-3 w-full rounded bg-neutral-100" />
              <div className="h-3 w-5/6 rounded bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
