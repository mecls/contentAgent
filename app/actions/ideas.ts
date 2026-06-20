'use server'

import { revalidatePath } from 'next/cache'
import { requireAccountId } from '@/lib/auth/session'
import { setIdeaStatus } from '@/lib/db/ideas'
import { writeIdeaToPost } from '@/lib/integrations/write-idea'
import { generateIdeasForAccount } from '@/lib/integrations/run-ideas'
import type { ActionResult } from './integrations'

export async function writeIdeaAction(ideaId: string): Promise<ActionResult> {
  const { accountId } = await requireAccountId()
  try {
    const { postId } = await writeIdeaToPost(accountId, ideaId)
    revalidatePath('/app/ideas')
    revalidatePath('/app/posts')
    return {
      ok: true,
      message: postId ? 'Draft created — find it in Posts.' : 'Written, but no draft was captured.',
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Writing failed.' }
  }
}

export async function dismissIdeaAction(ideaId: string): Promise<void> {
  const { accountId } = await requireAccountId()
  await setIdeaStatus(accountId, ideaId, 'dismissed')
  revalidatePath('/app/ideas')
}

/** Manually generate ideas now (substitutes for the twice-daily cron in dev). */
export async function generateIdeasNowAction(): Promise<ActionResult> {
  const { accountId } = await requireAccountId()
  try {
    const { created } = await generateIdeasForAccount(accountId, 4)
    revalidatePath('/app/ideas')
    return { ok: true, message: `Generated ${created} idea(s).` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Idea generation failed.' }
  }
}
