'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ExternalLink, X } from 'lucide-react'
import { pickAngleAction, rejectAngleAction, setAngleStageAction } from '@/app/actions/choose'
import type { ChooseAngle } from '@/lib/choose/batch'
import {
  FUNNEL_STAGES,
  STAGE_LABELS,
  STAGE_LABELS_LONG,
  STAGE_TONES,
  type FunnelStage,
} from '@/lib/funnel/stages'
import { cn } from '@/lib/utils'

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function AngleCard({ batchId, angle }: { batchId: string; angle: ChooseAngle }) {
  const router = useRouter()
  const [rejecting, setRejecting] = useState(false)
  const [choosingStage, setChoosingStage] = useState(false)
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const rejected = angle.status === 'rejected'
  const picked = angle.status === 'picked'

  const draft = () => {
    setMessage(null)
    startTransition(async () => {
      const res = await pickAngleAction(batchId, angle.id)
      if (res.ok && res.href) router.push(res.href)
      else setMessage(res.message ?? 'Something went wrong.')
    })
  }

  const setStage = (stage: FunnelStage) => {
    setMessage(null)
    startTransition(async () => {
      const res = await setAngleStageAction(batchId, angle.id, stage)
      if (res.ok) {
        setChoosingStage(false)
        router.refresh()
      } else {
        setMessage(res.message ?? 'Something went wrong.')
      }
    })
  }

  const reject = () => {
    setMessage(null)
    startTransition(async () => {
      const res = await rejectAngleAction(batchId, angle.id, reason)
      if (res.ok) {
        setRejecting(false)
        setReason('')
        router.refresh()
      } else {
        setMessage(res.message ?? 'Something went wrong.')
      }
    })
  }

  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4',
        rejected && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {choosingStage ? (
          FUNNEL_STAGES.map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={() => setStage(stage)}
              disabled={pending}
              title={STAGE_LABELS_LONG[stage]}
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-medium disabled:opacity-50',
                stage === angle.funnel_stage
                  ? STAGE_TONES[stage]
                  : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200',
              )}
            >
              {STAGE_LABELS[stage]}
            </button>
          ))
        ) : (
          <button
            type="button"
            onClick={() => setChoosingStage(true)}
            disabled={pending}
            title={
              angle.funnel_stage
                ? `${STAGE_LABELS_LONG[angle.funnel_stage]} — click to change`
                : 'No stage yet — click to set one'
            }
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-medium disabled:opacity-50',
              angle.funnel_stage
                ? STAGE_TONES[angle.funnel_stage]
                : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200',
            )}
          >
            {angle.funnel_stage ? STAGE_LABELS[angle.funnel_stage] : 'No stage'}
          </button>
        )}
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
          {angle.archetype}
        </span>
        {angle.provenance === 'sourced' ? (
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700">
            Sourced
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
            Needs your story
          </span>
        )}
      </div>

      <p className="text-xs text-neutral-500">{angle.tribe}</p>
      <h2 className="text-base leading-snug font-semibold text-neutral-900">{angle.hook}</h2>

      <div className="flex flex-col gap-2 text-sm text-neutral-600">
        <p>
          <span className="font-medium text-neutral-800">Tension: </span>
          {angle.tension}
        </p>
        <p>
          <span className="font-medium text-neutral-800">Why now: </span>
          {angle.why_now}
        </p>
        {angle.provenance === 'sourced' ? (
          <ul className="flex flex-col gap-1">
            {angle.sources.map((source) => (
              <li key={source}>
                <a
                  href={source}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-sky-700 hover:underline"
                >
                  {hostOf(source)}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{angle.story_prompt}</p>
        )}
      </div>

      {rejected ? <p className="text-xs text-neutral-500">Rejected: {angle.reject_reason}</p> : null}
      {picked ? <p className="text-xs font-medium text-emerald-700">Picked — drafting in chat</p> : null}
      {message ? <p className="text-xs text-red-600">{message}</p> : null}

      {rejecting ? (
        <div className="mt-auto flex flex-col gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder="Why not this one?"
            className="h-9 rounded-lg border border-neutral-200 px-3 text-sm outline-none focus:border-[var(--brand-accent)]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reject}
              disabled={pending || !reason.trim()}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => {
                setRejecting(false)
                setReason('')
              }}
              disabled={pending}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-auto flex gap-2">
          <button
            type="button"
            onClick={draft}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-accent)] px-3 py-1.5 text-xs font-medium text-[var(--brand-accent-foreground)] disabled:opacity-50"
          >
            Draft this
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
          {!rejected ? (
            <button
              type="button"
              onClick={() => setRejecting(true)}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:border-neutral-300"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Reject
            </button>
          ) : null}
        </div>
      )}
    </article>
  )
}
