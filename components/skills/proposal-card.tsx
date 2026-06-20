'use client'

import { useState, useTransition } from 'react'
import { Check, GitPullRequest, X } from 'lucide-react'
import { approveProposalAction, rejectProposalAction } from '@/app/actions/skills'
import { cn } from '@/lib/utils'

/**
 * Approval card for a pending skill-overwrite proposal. The agent raises these
 * instead of silently rewriting existing skill guidance; the human approves or
 * rejects here (in chat inline, or on the Skills page). `proposedContent` is
 * optional — the chat-inline variant shows just the rationale.
 */
export function ProposalCard({
  id,
  slug,
  path,
  rationale,
  proposedContent,
  className,
}: {
  id: string
  slug: string
  path: string
  rationale: string
  proposedContent?: string
  className?: string
}) {
  const [resolved, setResolved] = useState<'approved' | 'rejected' | null>(null)
  const [pending, startTransition] = useTransition()

  const act = (kind: 'approved' | 'rejected') => {
    startTransition(async () => {
      if (kind === 'approved') await approveProposalAction(id)
      else await rejectProposalAction(id)
      setResolved(kind)
    })
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-amber-200 bg-amber-50/60 p-3.5',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
        <GitPullRequest className="h-4 w-4" aria-hidden />
        Skill change proposed
      </div>
      <p className="mt-1 text-xs text-amber-800/80">
        <span className="font-mono">{slug}/{path}</span>
      </p>
      <p className="mt-2 text-sm text-neutral-700">{rationale}</p>

      {proposedContent ? (
        <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-amber-200 bg-white p-2.5 text-xs whitespace-pre-wrap text-neutral-700">
          {proposedContent}
        </pre>
      ) : null}

      {resolved ? (
        <p
          className={cn(
            'mt-3 text-sm font-medium',
            resolved === 'approved' ? 'text-emerald-700' : 'text-neutral-500',
          )}
        >
          {resolved === 'approved' ? 'Approved — the skill was updated.' : 'Rejected.'}
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => act('approved')}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-accent)] px-3 py-1.5 text-xs font-medium text-[var(--brand-accent-foreground)] disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            Approve
          </button>
          <button
            onClick={() => act('rejected')}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Reject
          </button>
        </div>
      )}
    </div>
  )
}
