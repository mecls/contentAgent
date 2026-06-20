'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowUp,
  FileText,
  Lightbulb,
  Newspaper,
  PenLine,
  Sparkles,
  Square,
  TrendingUp,
} from 'lucide-react'
import {
  useAgentChat,
  type ChatMessage,
  type IdeaCard,
  type InitialMessage,
  type ResearchCard,
} from './use-agent-chat'
import { MarkdownLite } from './markdown-lite'
import { ThinkingTrace } from './thinking-trace'
import { ProposalCard } from '@/components/skills/proposal-card'

const SUGGESTIONS = [
  'Draft a LinkedIn post about AI replacing junior engineers',
  'What archetype should I use this week?',
  'Critique this hook: “Most founders are about to…”',
  'Plan my content for next week',
]

/** Composer quick actions. `send: true` fires immediately; otherwise it prefills. */
const QUICK_ACTIONS = [
  {
    label: "This week's research",
    icon: Newspaper,
    prompt:
      "Show me this week's research — list the most relevant items I could post about.",
    send: true,
  },
  {
    label: 'Post ideas',
    icon: Lightbulb,
    prompt: 'Show me my current post ideas.',
    send: true,
  },
  {
    label: "What's working",
    icon: TrendingUp,
    prompt:
      'Which of my tags and archetypes get the best engagement? Base it on my post performance.',
    send: true,
  },
  { label: 'Draft a post', icon: PenLine, prompt: 'Draft a LinkedIn post about ', send: false },
] as const

const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

function researchDraftPrompt(r: ResearchCard): string {
  return [
    'Draft a LinkedIn post based on this research item. First open the relevant skill (read_skill → read_skill_file for its constraints and archetypes), follow my voice and constraints, ground the post in this item, then save_post.',
    '',
    `Title: ${r.title ?? r.url}`,
    `Source: ${r.source}`,
    `URL: ${r.url}`,
    r.summary ? `Summary: ${r.summary}` : '',
    r.key_points?.length ? `Key points:\n- ${r.key_points.join('\n- ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function ideaDraftPrompt(i: IdeaCard): string {
  return [
    'Draft a LinkedIn post from this idea. First open the relevant skill (read_skill → read_skill_file), follow my voice and constraints, then save_post.',
    '',
    `Topic: ${i.topic}`,
    i.angle ? `Angle: ${i.angle}` : '',
    i.hook ? `Hook idea: ${i.hook}` : '',
    i.structure ? `Suggested structure: ${i.structure}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function ChatPanel({
  conversationId,
  initialMessages = [],
  initialPrompt,
}: {
  conversationId?: string | null
  initialMessages?: InitialMessage[]
  initialPrompt?: string
}) {
  const { messages, isStreaming, send, stop } = useAgentChat({
    conversationId,
    initialMessages,
  })
  const [input, setInput] = useState(initialPrompt ?? '')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages])

  // Focus the composer on mount (so a prefilled prompt is ready to edit/send).
  useEffect(() => {
    inputRef.current?.focus()
    const el = inputRef.current
    if (el) el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  const submit = () => {
    const text = input.trim()
    if (!text) return
    if (isStreaming) stop()
    setInput('')
    void send(text)
  }

  const prefill = (text: string) => {
    setInput(text)
    inputRef.current?.focus()
  }

  const runQuick = (a: (typeof QUICK_ACTIONS)[number]) => {
    if (a.send) void send(a.prompt)
    else prefill(a.prompt)
  }

  const hasConversation = messages.length > 0
  const last = messages[messages.length - 1]

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Transcript */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5">
          {hasConversation ? (
            messages.map((m) => (
              <Bubble
                key={m.id}
                message={m}
                isStreaming={isStreaming}
                live={m === last}
                onPrefill={prefill}
              />
            ))
          ) : (
            <IntroHero onPrefill={prefill} />
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-neutral-200/70 bg-white/60 px-4 py-3">
        <div className="mx-auto w-full max-w-2xl">
          {/* Quick actions */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.label}
                onClick={() => runQuick(a)}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 transition-colors hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)]"
              >
                <a.icon className="h-3.5 w-3.5" aria-hidden />
                {a.label}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              rows={1}
              placeholder="Ask for a post, a critique, a plan…"
              className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-base outline-none focus:border-[var(--brand-accent)] sm:text-sm"
            />
            <button
              onClick={isStreaming ? stop : submit}
              disabled={!isStreaming && !input.trim()}
              aria-label={isStreaming ? 'Stop' : 'Send'}
              className="cta-shadow flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-accent)] text-[var(--brand-accent-foreground)] transition-opacity disabled:opacity-40"
            >
              {isStreaming ? (
                <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
              ) : (
                <ArrowUp className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── pieces ───────────────────────────────────────────────────────────────────

function Bubble({
  message,
  isStreaming,
  live,
  onPrefill,
}: {
  message: ChatMessage
  isStreaming: boolean
  live: boolean
  onPrefill: (text: string) => void
}) {
  const isUser = message.role === 'user'
  const time = timeFmt.format(message.createdAt)

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[var(--brand-accent)] px-4 py-2.5 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[var(--brand-accent-foreground)]">
          {message.body}
        </div>
        <span className="pr-1 text-[11px] text-neutral-400">{time}</span>
      </div>
    )
  }

  const streamingNow = isStreaming && live
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-accent)] text-[var(--brand-accent-foreground)]">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <div className="w-full rounded-2xl rounded-tl-sm border border-neutral-200/70 bg-neutral-50 px-4 py-3">
          {message.reasoning || message.activity || (streamingNow && !message.body) ? (
            <ThinkingTrace
              reasoning={message.reasoning ?? ''}
              answering={message.body.length > 0}
              streaming={streamingNow}
              activity={message.activity}
            />
          ) : null}
          <MarkdownLite text={message.body} streaming={streamingNow} />
        </div>

        {/* Research cards */}
        {message.research?.map((r) => (
          <div
            key={r.id}
            className="w-full rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-sm"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-sky-700">
                {r.source}
              </span>
              {r.topic ? (
                <span className="truncate text-[11px] text-sky-700/60">{r.topic}</span>
              ) : null}
            </div>
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-sky-900 hover:underline"
            >
              {r.title ?? r.url}
            </a>
            {r.summary ? (
              <p className="mt-1 line-clamp-2 text-xs text-sky-800/70">{r.summary}</p>
            ) : null}
            <button
              onClick={() => onPrefill(researchDraftPrompt(r))}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-accent)] px-2.5 py-1 text-xs font-medium text-[var(--brand-accent-foreground)] hover:opacity-90"
            >
              Draft post <ArrowRight className="h-3 w-3" aria-hidden />
            </button>
          </div>
        ))}

        {/* Idea cards */}
        {message.ideas?.map((i) => (
          <div
            key={i.id}
            className="w-full rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm"
          >
            <div className="flex items-center gap-1.5 text-amber-900">
              <Lightbulb className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="font-medium">{i.topic}</span>
            </div>
            {i.hook ? <p className="mt-1 text-xs text-amber-800/80">“{i.hook}”</p> : null}
            {i.angle ? <p className="mt-1 text-xs text-amber-800/70">{i.angle}</p> : null}
            <button
              onClick={() => onPrefill(ideaDraftPrompt(i))}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-accent)] px-2.5 py-1 text-xs font-medium text-[var(--brand-accent-foreground)] hover:opacity-90"
            >
              Draft this <ArrowRight className="h-3 w-3" aria-hidden />
            </button>
          </div>
        ))}

        {/* Saved-post cards */}
        {message.posts?.map((p) => (
          <Link
            key={p.id}
            href="/app/posts"
            className="flex w-full items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-2.5 text-sm text-emerald-900 transition-colors hover:border-emerald-300"
          >
            <FileText className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              Saved to Posts — “{p.hook}”
            </span>
            <span className="text-xs font-medium">View</span>
          </Link>
        ))}

        {/* Skill-overwrite approval cards */}
        {message.proposals?.map((pr) => (
          <ProposalCard
            key={pr.id}
            id={pr.id}
            slug={pr.slug}
            path={pr.path}
            rationale={pr.rationale}
            className="w-full"
          />
        ))}

        <span className="pl-1 text-[11px] text-neutral-400">{time}</span>
      </div>
    </div>
  )
}

function IntroHero({ onPrefill }: { onPrefill: (q: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-2 py-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-accent)] text-[var(--brand-accent-foreground)]">
        <Sparkles className="h-6 w-6" aria-hidden />
      </div>
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-lg font-semibold text-neutral-900">
          Your content strategist
        </h2>
        <p className="max-w-md text-sm text-neutral-500">
          I draft, critique, and plan LinkedIn content using your skill — and I
          get sharper every time you share results. Ask me anything, or start
          with one of these.
        </p>
      </div>
      <div className="grid w-full max-w-lg gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPrefill(s)}
            className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-left text-sm text-neutral-700 transition-colors hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
