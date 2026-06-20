import { requireAccountId } from '@/lib/auth/session'
import { getConversation, listMessages } from '@/lib/db/conversations'
import { ChatPanel } from '@/components/app/chat/chat-panel'
import type { InitialMessage } from '@/components/app/chat/use-agent-chat'

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; prompt?: string }>
}) {
  const { accountId } = await requireAccountId()
  const { c, prompt } = await searchParams

  let conversationId: string | null = null
  let initialMessages: InitialMessage[] = []

  if (c) {
    const conv = await getConversation(accountId, c)
    if (conv) {
      conversationId = conv.id
      const msgs = await listMessages(accountId, c)
      initialMessages = msgs.map((m) => ({
        role: m.role === 'assistant' ? 'agent' : 'user',
        body: m.content,
        reasoning: m.reasoning,
        createdAt: new Date(m.created_at).getTime(),
      }))
    }
  }

  return (
    <ChatPanel
      key={conversationId ?? 'new'}
      conversationId={conversationId}
      initialMessages={initialMessages}
      initialPrompt={c ? undefined : prompt}
    />
  )
}
