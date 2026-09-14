import { openai, llmModel, llmMaxTokens } from './llm'

/**
 * One-shot structured LLM completion for non-conversational tasks (deriving
 * research queries, extracting competitor post features, generating post ideas).
 * Separate from the tool-calling agent loop. Returns parsed JSON, or null when
 * the model returns something unparseable — callers must handle null and never
 * crash a cron on one bad response.
 */
export async function completeJSON<T = unknown>(args: {
  system: string
  user: string
  maxTokens?: number
  /** Override the model (defaults to LLM_MODEL — the fast tier). */
  model?: string
}): Promise<T | null> {
  const client = openai()
  const res = await client.chat.completions.create({
    model: args.model ?? llmModel(),
    max_tokens: args.maxTokens ?? llmMaxTokens(),
    messages: [
      { role: 'system', content: args.system },
      { role: 'user', content: args.user },
    ],
  })
  const choice = res.choices[0]
  const text = choice?.message?.content ?? ''
  const parsed = parseJsonLoose<T>(text)
  if (parsed === null) {
    // Say why, so a failure is diagnosable from the logs (e.g. a reasoning model
    // spending the whole token budget before writing any content).
    const message = choice?.message as { reasoning?: string; reasoning_content?: string } | undefined
    console.error('[completeJSON] unparseable response', {
      model: args.model ?? llmModel(),
      finish_reason: choice?.finish_reason ?? null,
      content_chars: text.length,
      reasoning_chars: (message?.reasoning ?? message?.reasoning_content ?? '').length,
      completion_tokens: res.usage?.completion_tokens ?? null,
    })
  }
  return parsed
}

/** Parse JSON from a model response that may wrap it in prose or code fences. */
export function parseJsonLoose<T = unknown>(text: string): T | null {
  if (!text) return null
  const cleaned = text.replace(/```(?:json)?/gi, '').trim()
  // Try direct parse first, then the first balanced {...} or [...] span.
  const candidates = [cleaned]
  const objStart = cleaned.indexOf('{')
  const objEnd = cleaned.lastIndexOf('}')
  if (objStart !== -1 && objEnd > objStart) candidates.push(cleaned.slice(objStart, objEnd + 1))
  const arrStart = cleaned.indexOf('[')
  const arrEnd = cleaned.lastIndexOf(']')
  if (arrStart !== -1 && arrEnd > arrStart) candidates.push(cleaned.slice(arrStart, arrEnd + 1))
  for (const c of candidates) {
    try {
      return JSON.parse(c) as T
    } catch {
      // try next candidate
    }
  }
  return null
}
