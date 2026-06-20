'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export interface PostCard {
  id: string
  hook: string
}

export interface ProposalCard {
  id: string
  slug: string
  path: string
  rationale: string
}

export interface ResearchCard {
  id: string
  source: string
  title: string | null
  url: string
  summary: string | null
  topic: string | null
  key_points?: string[]
}

export interface IdeaCard {
  id: string
  topic: string
  angle: string | null
  hook: string | null
  structure: string | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  body: string
  createdAt: number
  /** Accumulated reasoning tokens (display-only). */
  reasoning?: string
  /** Transient "working…" status during the tool-execution gap. */
  activity?: string
  /** Posts the agent saved during this turn (rendered as inline cards). */
  posts?: PostCard[]
  /** Skill-overwrite proposals raised this turn (rendered as approval cards). */
  proposals?: ProposalCard[]
  /** Research items surfaced this turn (rendered as inline cards). */
  research?: ResearchCard[]
  /** Post ideas surfaced this turn (rendered as inline cards). */
  ideas?: IdeaCard[]
}

export interface InitialMessage {
  role: 'user' | 'agent'
  body: string
  reasoning?: string | null
  createdAt?: number
}

/** Friendly status for each tool while it runs. */
function activityFor(tool: string): string {
  switch (tool) {
    case 'list_skills':
    case 'read_skill':
    case 'read_skill_file':
      return 'Reading the skill…'
    case 'append_skill_file':
    case 'create_skill_file':
    case 'create_skill':
      return 'Updating the skill…'
    case 'propose_skill_overwrite':
      return 'Proposing a skill change…'
    case 'save_post':
      return 'Saving the post…'
    case 'list_posts':
    case 'get_post':
      return 'Reviewing past posts…'
    case 'update_post_metrics':
      return 'Logging results…'
    case 'get_tag_performance':
      return 'Checking what works…'
    case 'list_research':
      return 'Reviewing research…'
    case 'search_news':
      return 'Searching the news…'
    case 'list_competitor_insights':
      return 'Studying competitors…'
    case 'list_ideas':
      return 'Gathering ideas…'
    case 'learn_writing_style':
      return 'Learning the writing style…'
    default:
      return 'Working on it…'
  }
}

/**
 * Drives the chat surface against POST /api/agent, consuming its SSE stream.
 * Persists conversations server-side: the route returns a {conv} id, which we
 * adopt (updating the URL + refreshing the sidebar) so the chat behaves like
 * ChatGPT history.
 */
export function useAgentChat({
  conversationId: initialConversationId,
  initialMessages = [],
}: {
  conversationId?: string | null
  initialMessages?: InitialMessage[]
} = {}) {
  const router = useRouter()
  const counter = useRef(0)
  const nextId = () => `m${++counter.current}`

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialMessages.map((m) => ({
      id: nextId(),
      role: m.role,
      body: m.body,
      reasoning: m.reasoning ?? undefined,
      createdAt: m.createdAt ?? Date.now(),
    })),
  )
  const [isStreaming, setIsStreaming] = useState(false)
  const conversationRef = useRef<string | null>(initialConversationId ?? null)
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim()
      if (!clean) return

      const agentId = nextId()
      setMessages((m) => [
        ...m,
        { id: nextId(), role: 'user', body: clean, createdAt: Date.now() },
        { id: agentId, role: 'agent', body: '', createdAt: Date.now() },
      ])
      setIsStreaming(true)

      const patch = (fn: (x: ChatMessage) => ChatMessage) =>
        setMessages((m) => m.map((x) => (x.id === agentId ? fn(x) : x)))

      const controller = new AbortController()
      abortRef.current = controller
      try {
        const res = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: clean,
            conversationId: conversationRef.current,
          }),
          signal: controller.signal,
        })
        if (!res.ok || !res.body) throw new Error(`agent ${res.status}`)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split('\n\n')
          buffer = events.pop() ?? ''
          for (const evt of events) {
            const dataLine = evt.split('\n').find((l) => l.startsWith('data: '))
            if (!dataLine) continue
            let payload: {
              conv?: string
              t?: string
              r?: string
              tool?: string
              post?: PostCard
              proposal?: ProposalCard
              researchItems?: ResearchCard[]
              ideaItems?: IdeaCard[]
              skillUpdate?: { slug: string; path: string; kind: string }
              done?: boolean
              error?: string
            }
            try {
              payload = JSON.parse(dataLine.slice(6))
            } catch {
              continue
            }

            if (payload.conv) {
              if (!conversationRef.current) {
                conversationRef.current = payload.conv
                // Reflect the new conversation in the URL without a full nav.
                window.history.replaceState(null, '', `/app?c=${payload.conv}`)
              }
            } else if (payload.r) {
              patch((x) => ({
                ...x,
                reasoning: (x.reasoning ?? '') + payload.r,
                activity: undefined,
              }))
            } else if (payload.t) {
              patch((x) => ({ ...x, body: x.body + payload.t, activity: undefined }))
            } else if (payload.tool) {
              patch((x) => ({ ...x, activity: activityFor(payload.tool!) }))
            } else if (payload.post) {
              patch((x) => ({ ...x, posts: [...(x.posts ?? []), payload.post!] }))
            } else if (payload.proposal) {
              patch((x) => ({
                ...x,
                proposals: [...(x.proposals ?? []), payload.proposal!],
              }))
            } else if (payload.researchItems) {
              patch((x) => ({
                ...x,
                research: [...(x.research ?? []), ...payload.researchItems!],
                activity: undefined,
              }))
            } else if (payload.ideaItems) {
              patch((x) => ({
                ...x,
                ideas: [...(x.ideas ?? []), ...payload.ideaItems!],
                activity: undefined,
              }))
            } else if (payload.error) {
              patch((x) => ({
                ...x,
                body:
                  x.body ||
                  'Something went wrong reaching the model. Give it another try in a moment.',
                activity: undefined,
              }))
            }
          }
        }
      } catch {
        if (controller.signal.aborted) {
          setMessages((m) =>
            m.filter((x) => !(x.id === agentId && !x.body && !x.posts && !x.proposals)),
          )
        } else {
          patch((x) =>
            x.body
              ? x
              : {
                  ...x,
                  body: 'Something went wrong reaching the model. Give it another try in a moment.',
                },
          )
        }
      } finally {
        if (abortRef.current === controller) {
          setIsStreaming(false)
          abortRef.current = null
          // Refresh server components (sidebar history, badges) once settled.
          router.refresh()
        }
      }
    },
    [router],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
  }, [])

  return { messages, isStreaming, send, stop }
}
