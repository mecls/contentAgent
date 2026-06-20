'use server'

import { revalidatePath } from 'next/cache'
import { requireAccountId } from '@/lib/auth/session'
import { suggestPostMixForAccount } from '@/lib/integrations/suggest-mix'
import type { ActionResult } from './integrations'

/** Manually generate a weekly content plan now (substitutes for the weekly cron in dev). */
export async function generatePlanNowAction(): Promise<ActionResult> {
  const { accountId } = await requireAccountId()
  try {
    const { created } = await suggestPostMixForAccount(accountId)
    revalidatePath('/app/plan')
    if (created === 0) {
      return {
        ok: false,
        message: 'No plan generated yet — add competitors and run research so there is format signal to work from.',
      }
    }
    return { ok: true, message: `Planned ${created} post(s) for the week.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Plan generation failed.' }
  }
}
