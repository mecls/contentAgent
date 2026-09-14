'use server'

import { requireAccountId } from '@/lib/auth/session'
import { llmModelHeavy } from '@/lib/agent/llm'
import { getChatModel, listChatModels, setChatModel, type ChatModel } from '@/lib/agent/models'

export interface ChatModelsResult {
  ok: boolean
  message?: string
  models: ChatModel[]
  current: string
  defaultModel: string
}

/** The tool-capable Ollama Cloud models plus the account's current choice. No generation. */
export async function listChatModelsAction(): Promise<ChatModelsResult> {
  const { accountId } = await requireAccountId()
  const defaultModel = llmModelHeavy()
  try {
    const models = await listChatModels()
    return { ok: true, models, current: await getChatModel(accountId), defaultModel }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Couldn't load the models.",
      models: [],
      current: await getChatModel(accountId),
      defaultModel,
    }
  }
}

export async function setChatModelAction(model: string): Promise<{ ok: boolean; message: string }> {
  const { accountId } = await requireAccountId()
  try {
    await setChatModel(accountId, model)
    return { ok: true, message: `Chat model set to ${model}.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't change the model." }
  }
}
