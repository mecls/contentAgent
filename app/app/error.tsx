'use client'

import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

/**
 * Segment-level error boundary for the app pages. Because it lives beside the
 * layout (not above it), a crash in any page is contained here while the sidebar
 * keeps rendering — and we show the actual error instead of a blank screen.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app] page error', error)
  }, [error])

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 text-center">
        <h2 className="text-sm font-semibold text-neutral-900">
          Something went wrong on this page
        </h2>
        <p className="mt-2 break-words text-xs text-neutral-500">
          {error.message || 'Unexpected error.'}
        </p>
        <button
          onClick={reset}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-accent)] px-3.5 py-2 text-sm font-medium text-[var(--brand-accent-foreground)]"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Try again
        </button>
      </div>
    </div>
  )
}
