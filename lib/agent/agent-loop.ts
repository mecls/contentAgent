import type OpenAI from 'openai'
import { openai, llmModel, llmMaxTokens } from './llm'
import { SYSTEM_PROMPT } from './system-prompt'
import { CONTENT_TOOLS } from './tools'
import { runScopedTool, type ToolContext } from './run-scoped-tool'

const MAX_ITERS = 10

export interface AgentLoopArgs {
  prompt: string
  accountId: string
  conversationId?: string | null
  /** Called with each text delta as the model produces it (SSE). */
  emit?: (text: string) => void
  /** Called with each reasoning delta (display-only; never fed back to the model). */
  emitReasoning?: (text: string) => void
  /** Called with a tool's name when it starts executing — UI shows a status. */
  emitTool?: (name: string) => void
  /** UI side-channel for structured events from tools (saved post, proposal). */
  emitEvent?: (event: Record<string, unknown>) => void
  /** Extra system notes injected ahead of history (e.g. the skills index). */
  systemNotes?: string[]
  /** Prior turns, for multi-message chat. */
  history?: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  /** Aborts the in-flight LLM calls when the client disconnects. */
  signal?: AbortSignal
}

interface AccumulatedToolCall {
  id: string
  name: string
  args: string
}

/**
 * Multi-turn tool loop over an OpenAI-compatible endpoint (Ollama Cloud).
 * Streams each turn — emitting text deltas and accumulating tool-call fragments
 * by index — then, while the model requests tools, executes them (account-scoped)
 * and feeds JSON-encoded results back as untrusted data. Stops when a turn
 * produces no tool calls, or after MAX_ITERS. Returns the full assistant text.
 */
export async function runAgentLoop({
  prompt,
  accountId,
  conversationId,
  emit,
  emitReasoning,
  emitTool,
  emitEvent,
  systemNotes = [],
  history = [],
  signal,
}: AgentLoopArgs): Promise<string> {
  const client = openai()
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...systemNotes.map((content) => ({ role: 'system' as const, content })),
    ...history,
    { role: 'user', content: prompt },
  ]
  const toolCtx: ToolContext = { accountId, conversationId, emit: emitEvent }
  let finalText = ''

  for (let i = 0; i < MAX_ITERS; i++) {
    if (signal?.aborted) break
    const stream = await client.chat.completions.create(
      {
        model: llmModel(),
        max_tokens: llmMaxTokens(),
        messages,
        tools: CONTENT_TOOLS,
        tool_choice: 'auto',
        stream: true,
      },
      { signal },
    )

    let turnText = ''
    const acc = new Map<number, AccumulatedToolCall>()

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
      if (!delta) continue
      // Reasoning channel is non-standard (OpenAI SDK types omit it); models on
      // Ollama emit `reasoning_content` or `reasoning`. Display only — never added
      // to finalText or fed back into `messages`.
      const reasoning =
        (delta as { reasoning_content?: string }).reasoning_content ??
        (delta as { reasoning?: string }).reasoning
      if (reasoning) emitReasoning?.(reasoning)
      if (delta.content) {
        turnText += delta.content
        finalText += delta.content
        emit?.(delta.content)
      }
      for (const tc of delta.tool_calls ?? []) {
        const cur = acc.get(tc.index) ?? { id: '', name: '', args: '' }
        if (tc.id) cur.id = tc.id
        if (tc.function?.name) cur.name = tc.function.name
        if (tc.function?.arguments) cur.args += tc.function.arguments
        acc.set(tc.index, cur)
      }
    }

    const toolCalls = [...acc.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, t]) => t)

    const assistantMsg: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam =
      { role: 'assistant', content: turnText || null }
    if (toolCalls.length > 0) {
      assistantMsg.tool_calls = toolCalls.map((t) => ({
        id: t.id,
        type: 'function',
        function: { name: t.name, arguments: t.args || '{}' },
      }))
    }
    messages.push(assistantMsg)

    if (toolCalls.length === 0) break

    for (const t of toolCalls) {
      let result: unknown
      emitTool?.(t.name)
      try {
        const parsed = t.args ? JSON.parse(t.args) : {}
        result = await runScopedTool(t.name, parsed, toolCtx)
      } catch (e) {
        result = { error: e instanceof Error ? e.message : 'tool error' }
      }
      messages.push({
        role: 'tool',
        tool_call_id: t.id,
        content: JSON.stringify(result),
      })
    }
  }

  return finalText
}
