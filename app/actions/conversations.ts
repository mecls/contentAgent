'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAccountId } from '@/lib/auth/session'
import { renameConversation, deleteConversation } from '@/lib/db/conversations'

export async function renameConversationAction(id: string, title: string) {
  const { accountId } = await requireAccountId()
  await renameConversation(accountId, id, title)
  revalidatePath('/app')
}

export async function deleteConversationAction(id: string) {
  const { accountId } = await requireAccountId()
  await deleteConversation(accountId, id)
  revalidatePath('/app')
  redirect('/app')
}
