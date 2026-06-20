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
}): Promise<T | null> {
  const client = openai()
  const res = await client.chat.completions.create({
    model: llmModel(),
    max_tokens: args.maxTokens ?? llmMaxTokens(),
    messages: [
      { role: 'system', content: args.system },
      { role: 'user', content: args.user },
    ],
  })
  const text = res.choices[0]?.message?.content ?? ''
  return parseJsonLoose<T>(text)
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
