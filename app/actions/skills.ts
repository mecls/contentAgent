'use server'

import { revalidatePath } from 'next/cache'
import { requireAccountId } from '@/lib/auth/session'
import { rollbackToVersion, writeSkillFile } from '@/lib/skills/store'

export async function updateSkillFileAction(
  slug: string,
  path: string,
  content: string,
) {
  const { accountId } = await requireAccountId()
  await writeSkillFile(accountId, slug, path, content, 'user')
  revalidatePath('/app/skills')
}

export async function rollbackVersionAction(versionId: string) {
  const { accountId } = await requireAccountId()
  await rollbackToVersion(accountId, versionId)
  revalidatePath('/app/skills')
}
