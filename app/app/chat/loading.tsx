/** Chat fallback: same frame as ChatPanel (transcript over a composer) so nothing jumps when it lands. */
export default function Loading() {
  return (
    <div className="flex h-full min-h-0 flex-col" aria-busy="true">
      <div className="min-h-0 flex-1 px-4 py-6">
        <div className="mx-auto flex w-full max-w-2xl animate-pulse flex-col gap-5">
          <div className="ml-auto h-10 w-2/5 rounded-2xl rounded-tr-sm bg-neutral-200/80" />
          <div className="flex items-start gap-2.5">
            <div className="h-7 w-7 shrink-0 rounded-lg bg-neutral-200/80" />
            <div className="h-24 flex-1 rounded-2xl rounded-tl-sm border border-neutral-200/70 bg-neutral-50" />
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-neutral-200/70 bg-white/60 px-4 py-3">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-2 h-6" />
          <div className="flex items-end gap-2">
            <div className="h-11 flex-1 rounded-xl border border-neutral-200 bg-white" />
            <div className="h-11 w-11 shrink-0 rounded-xl bg-[var(--brand-accent)] opacity-40" />
          </div>
        </div>
      </div>
    </div>
  )
}
