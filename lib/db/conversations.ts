import { supabaseService } from '@/lib/supabase/service'

/**
 * Persisted chat (ChatGPT-style history). All reads/writes are account-scoped
 * through the service-role client; the account id is always server-derived.
 */

export interface ConversationRow {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface MessageRow {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  reasoning: string | null
  created_at: string
}

export async function listConversations(
  accountId: string,
): Promise<ConversationRow[]> {
  const { data, error } = await supabaseService()
    .from('content_conversations')
    .select('id, title, created_at, updated_at')
    .eq('account_id', accountId)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(`listConversations failed: ${error.message}`)
  return (data ?? []) as ConversationRow[]
}

export async function getConversation(
  accountId: string,
  id: string,
): Promise<ConversationRow | null> {
  const { data, error } = await supabaseService()
    .from('content_conversations')
    .select('id, title, created_at, updated_at')
    .eq('account_id', accountId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`getConversation failed: ${error.message}`)
  return (data as ConversationRow | null) ?? null
}

export async function createConversation(
  accountId: string,
  title: string,
): Promise<string> {
  const clean = title.trim().slice(0, 80) || 'New chat'
  const { data, error } = await supabaseService()
    .from('content_conversations')
    .insert({ account_id: accountId, title: clean })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`createConversation failed: ${error?.message ?? 'no data'}`)
  }
  return data.id as string
}

export async function listMessages(
  accountId: string,
  conversationId: string,
): Promise<MessageRow[]> {
  const { data, error } = await supabaseService()
    .from('content_messages')
    .select('id, conversation_id, role, content, reasoning, created_at')
    .eq('account_id', accountId)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`listMessages failed: ${error.message}`)
  return (data ?? []) as MessageRow[]
}

export async function addMessage(
  accountId: string,
  conversationId: string,
  msg: {
    role: 'user' | 'assistant'
    content: string
    reasoning?: string | null
    tool_calls?: unknown
  },
): Promise<void> {
  const { error } = await supabaseService().from('content_messages').insert({
    account_id: accountId,
    conversation_id: conversationId,
    role: msg.role,
    content: msg.content,
    reasoning: msg.reasoning ?? null,
    tool_calls: msg.tool_calls ?? null,
  })
  if (error) throw new Error(`addMessage failed: ${error.message}`)
  // Bump the conversation so it sorts to the top of the history list.
  await supabaseService()
    .from('content_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('account_id', accountId)
}

export async function renameConversation(
  accountId: string,
  id: string,
  title: string,
): Promise<void> {
  const { error } = await supabaseService()
    .from('content_conversations')
    .update({ title: title.trim().slice(0, 80) || 'New chat' })
    .eq('id', id)
    .eq('account_id', accountId)
  if (error) throw new Error(`renameConversation failed: ${error.message}`)
}

export async function deleteConversation(
  accountId: string,
  id: string,
): Promise<void> {
  const { error } = await supabaseService()
    .from('content_conversations')
    .delete()
    .eq('id', id)
    .eq('account_id', accountId)
  if (error) throw new Error(`deleteConversation failed: ${error.message}`)
}
