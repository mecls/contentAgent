import { requireAccountId } from '@/lib/auth/session'
import { getConversation, listMessages } from '@/lib/db/conversations'
import { ChatPanel } from '@/components/app/chat/chat-panel'
import type { InitialMessage } from '@/components/app/chat/use-agent-chat'
import { getChatModel } from '@/lib/agent/models'
import { buildDraftPrompt } from '@/lib/choose/batch'
import { getCurrentBatch } from '@/lib/choose/inputs'

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; prompt?: string; angle?: string }>
}) {
  const { accountId } = await requireAccountId()
  const { c, prompt, angle } = await searchParams
  const chatModel = await getChatModel(accountId)

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

  // A Choose pick arrives as ?angle=<id>. The prompt is built here from the saved
  // batch, never carried in the URL; an angle that's no longer in it opens empty.
  let initialPrompt = c ? undefined : prompt
  if (!c && angle) {
    const picked = (await getCurrentBatch(accountId))?.angles.find((a) => a.id === angle)
    initialPrompt = picked ? buildDraftPrompt(picked) : undefined
  }

  return (
    <ChatPanel
      key={conversationId ?? 'new'}
      conversationId={conversationId}
      initialMessages={initialMessages}
      initialPrompt={initialPrompt}
      initialModel={chatModel}
    />
  )
}
