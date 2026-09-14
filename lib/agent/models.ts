import { env } from '@/lib/env'
import { llmModelHeavy } from '@/lib/agent/llm'
import { getConfig, setConfig } from '@/lib/db/config'

/**
 * The chat's planning model, chosen per account from the Ollama Cloud models that
 * support tool calling — the agent loop runs entirely on tools, so a model without
 * them can't drive the chat. Listing reads model metadata only (no generation), so
 * it costs nothing. Post prose is still written by the writer model (write_content),
 * and crons keep their own model.
 */

export interface ChatModel {
  id: string
  contextLength: number | null
  vision: boolean
}

const CONFIG_KEY = 'chat_model'
const CACHE_MS = 10 * 60 * 1000
const TIMEOUT_MS = 8000

let cache: { at: number; models: ChatModel[] } | null = null

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.llmApiKey()}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Ollama returned ${res.status} for ${new URL(url).pathname}`)
  return res.json()
}

/**
 * Tool-capable models, sorted by id. Ids come from the OpenAI-compatible list (the
 * same ids the chat calls); capabilities come from the native /api/show endpoint
 * beside it. Cached for 10 minutes per server instance.
 */
export async function listChatModels(): Promise<ChatModel[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.models

  const baseUrl = env.llmBaseUrl().replace(/\/+$/, '')
  const nativeBase = baseUrl.replace(/\/v1$/, '')
  const list = (await getJson(`${baseUrl}/models`)) as { data?: { id?: string }[] }
  const ids = [...new Set((list.data ?? []).map((m) => m.id).filter((id): id is string => !!id))]

  const shown = await Promise.all(
    ids.map(async (id): Promise<ChatModel | null> => {
      try {
        const info = (await getJson(`${nativeBase}/api/show`, {
          method: 'POST',
          body: JSON.stringify({ model: id }),
        })) as { capabilities?: string[]; model_info?: Record<string, unknown> }
        const caps = info.capabilities ?? []
        if (!caps.includes('tools')) return null
        const ctx = Object.entries(info.model_info ?? {}).find(([k]) => k.endsWith('context_length'))?.[1]
        return { id, contextLength: typeof ctx === 'number' ? ctx : null, vision: caps.includes('vision') }
      } catch {
        // One model's metadata failing shouldn't hide the rest.
        return null
      }
    }),
  )

  const models = shown.filter((m): m is ChatModel => m !== null).sort((a, b) => a.id.localeCompare(b.id))
  if (models.length === 0) throw new Error('Ollama returned no models that support tool calling.')
  cache = { at: Date.now(), models }
  return models
}

/**
 * The account's chosen planning model, or the heavy default. Makes no network call:
 * a stored model that the cached list no longer offers falls back to the default.
 */
export async function getChatModel(accountId: string): Promise<string> {
  const stored = await getConfig(accountId, CONFIG_KEY).catch(() => null)
  if (typeof stored !== 'string' || !stored) return llmModelHeavy()
  if (cache && !cache.models.some((m) => m.id === stored)) return llmModelHeavy()
  return stored
}

/** Save a planning model after checking Ollama still offers it with tool support. */
export async function setChatModel(accountId: string, model: string): Promise<void> {
  const models = await listChatModels()
  if (!models.some((m) => m.id === model)) {
    throw new Error(`${model} isn't an available model with tool support.`)
  }
  await setConfig(accountId, CONFIG_KEY, model)
}
