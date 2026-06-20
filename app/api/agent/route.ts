import { type NextRequest } from 'next/server'
import type OpenAI from 'openai'
import { requireAccountId } from '@/lib/auth/session'
import { runAgentLoop } from '@/lib/agent/agent-loop'
import { buildSkillsIndexNote } from '@/lib/skills/store'
import { buildProfileNote } from '@/lib/db/profile'
import { buildTagsNote } from '@/lib/db/posts'
import {
  createConversation,
  getConversation,
  listMessages,
  addMessage,
} from '@/lib/db/conversations'

// Node runtime (service-role SDK). Generous duration for the multi-turn loop.
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Streams the content agent as Server-Sent Events. The account id is re-derived
 * from the verified session — never taken from the client — so every tool call
 * is scoped to the caller's own data. Persists the conversation + messages so the
 * chat has ChatGPT-style history.
 *
 * Event shapes: {conv}, {t}, {r}, {tool}, {post}, {proposal}, {skillUpdate},
 * {researchItems}, {ideaItems}, {research}, {ideas}, {done}, {error}.
 */
export async function POST(req: NextRequest) {
  let accountId: string
  try {
    ;({ accountId } = await requireAccountId())
  } catch {
    return new Response('unauthorized', { status: 401 })
  }

  let body: { prompt?: string; conversationId?: string }
  try {
    body = (await req.json()) as { prompt?: string; conversationId?: string }
  } catch {
    return new Response('bad request', { status: 400 })
  }
  const prompt = (body.prompt ?? '').trim()
  if (!prompt) return new Response('empty prompt', { status: 400 })

  // Resolve (or create) the conversation, then load prior turns as history
  // BEFORE persisting the new user message (so the loop doesn't see it twice).
  let conversationId = body.conversationId ?? null
  if (conversationId) {
    const conv = await getConversation(accountId, conversationId)
    if (!conv) conversationId = null
  }
  if (!conversationId) {
    conversationId = await createConversation(accountId, prompt)
  }

  const prior = await listMessages(accountId, conversationId)
  const history: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = prior
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }))

  await addMessage(accountId, conversationId, { role: 'user', content: prompt })

  let skillsNote = ''
  try {
    skillsNote = await buildSkillsIndexNote(accountId)
  } catch {
    skillsNote = ''
  }

  // The onboarding profile (who Miguel is, audience, voice, constraints) as
  // background context — captured at onboarding but otherwise never seen by the
  // model unless it happens to live in a skill file.
  let profileNote = ''
  try {
    profileNote = await buildProfileNote(accountId)
  } catch {
    profileNote = ''
  }

  // The tags already in use, so the agent reuses keywords instead of inventing
  // near-duplicates (which would fragment the per-tag engagement comparison).
  let tagsNote = ''
  try {
    tagsNote = await buildTagsNote(accountId)
  } catch {
    tagsNote = ''
  }

  const encoder = new TextEncoder()
  let closed = false
  const convId = conversationId
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
        } catch {
          closed = true
        }
      }

      // Tell the client which conversation this is (so a brand-new chat adopts it).
      send({ conv: convId })

      let answer = ''
      let reasoning = ''
      try {
        answer = await runAgentLoop({
          prompt,
          accountId,
          conversationId: convId,
          systemNotes: [skillsNote, profileNote, tagsNote].filter(Boolean),
          history,
          emit: (text) => send({ t: text }),
          emitReasoning: (text) => {
            reasoning += text
            send({ r: text })
          },
          emitTool: (name) => send({ tool: name }),
          emitEvent: (event) => send(event),
          signal: req.signal,
        })
        // Persist the assistant turn for history.
        try {
          await addMessage(accountId, convId, {
            role: 'assistant',
            content: answer,
            reasoning: reasoning || null,
          })
        } catch (e) {
          console.error('[agent] persist assistant failed', e)
        }
        send({ done: true })
      } catch (e) {
        if (!req.signal.aborted) console.error('[agent] loop failed', e)
        send({ error: 'agent_error' })
      } finally {
        if (!closed) {
          closed = true
          try {
            controller.close()
          } catch {
            // already closed by the client
          }
        }
      }
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
