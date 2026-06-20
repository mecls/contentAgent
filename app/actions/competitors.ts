'use server'

import { revalidatePath } from 'next/cache'
import { requireAccountId } from '@/lib/auth/session'
import { addCompetitor, removeCompetitor } from '@/lib/db/competitors'
import { runCompetitorAnalysisForAccount } from '@/lib/integrations/run-competitors'
import type { ActionResult } from './integrations'

export async function addCompetitorAction(
  profileUrl: string,
  name?: string,
): Promise<ActionResult> {
  const { accountId } = await requireAccountId()
  const url = profileUrl.trim()
  if (!/^https?:\/\/(www\.)?linkedin\.com\/in\/.+/i.test(url)) {
    return { ok: false, message: 'Enter a LinkedIn profile URL like https://www.linkedin.com/in/handle' }
  }
  await addCompetitor(accountId, url, name?.trim() || null)
  revalidatePath('/app/integrations')
  return { ok: true, message: 'Competitor added.' }
}

export async function removeCompetitorAction(id: string): Promise<void> {
  const { accountId } = await requireAccountId()
  await removeCompetitor(accountId, id)
  revalidatePath('/app/integrations')
}

/** Manually run competitor analysis now (substitutes for the weekly cron in dev). */
export async function runCompetitorsNowAction(): Promise<ActionResult> {
  const { accountId } = await requireAccountId()
  try {
    const r = await runCompetitorAnalysisForAccount(accountId)
    revalidatePath('/app/integrations')
    return {
      ok: true,
      message: `Analyzed ${r.posts} post(s) across ${r.competitors} competitor(s).`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Competitor analysis failed.' }
  }
}
