import OpenAI from 'openai'
import { env } from '@/lib/env'

let cached: OpenAI | null = null

/**
 * Shared OpenAI-compatible client (Ollama Cloud) for the agent loop. Points at
 * LLM_BASE_URL with LLM_API_KEY. maxRetries: 0 — the agent loop owns retry
 * behavior, and we don't want hidden retries mid-stream.
 */
export function openai(): OpenAI {
  if (!cached) {
    cached = new OpenAI({
      apiKey: env.llmApiKey(),
      baseURL: env.llmBaseUrl(),
      maxRetries: 0,
    })
  }
  return cached
}

export function llmModel(): string {
  return env.llmModel()
}

/** Agentic orchestrator model — drives the interactive chat loop (glm-5.2). */
export function llmModelHeavy(): string {
  return env.llmModelHeavy()
}

/** Worker/writer model — the post prose (write_content) + cron tasks (gpt-oss). */
export function llmModelFast(): string {
  return env.llmModelFast()
}

export function llmMaxTokens(): number {
  return env.llmMaxTokens()
}
