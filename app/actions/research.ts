'use server'

import { revalidatePath } from 'next/cache'
import { requireAccountId } from '@/lib/auth/session'
import { runResearchForAccount } from '@/lib/integrations/run-research'
import { deriveResearchFocus } from '@/lib/integrations/research-focus'
import { setResearchFocus, type ResearchFocus } from '@/lib/db/profile'
import type { ActionResult } from './integrations'

/** Manually trigger a research run now (substitutes for the daily cron in dev). */
export async function runResearchNowAction(): Promise<ActionResult> {
  const { accountId } = await requireAccountId()
  try {
    const r = await runResearchForAccount(accountId)
    revalidatePath('/app/research')
    return {
      ok: true,
      message: `Pulled ${r.stored} items this run — web ${r.web}, hacker news ${r.hackernews}, linkedin ${r.linkedin}.`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Research failed.' }
  }
}

const normalizeList = (a: string[]): string[] =>
  [...new Set((Array.isArray(a) ? a : []).map((t) => t.trim()).filter(Boolean))].slice(0, 12)

/** Persist the creator's edited research focus (marks it user-owned). */
export async function saveResearchFocusAction(
  topics: string[],
  exclusions: string[],
): Promise<ActionResult> {
  const { accountId } = await requireAccountId()
  const focus: ResearchFocus = {
    topics: normalizeList(topics),
    exclusions: normalizeList(exclusions),
    source: 'user',
    updatedAt: new Date().toISOString(),
  }
  await setResearchFocus(accountId, focus)
  revalidatePath('/app/research')
  return { ok: true, message: 'Research focus saved.' }
}

/** Re-derive the focus from the creator's skill + profile, overwriting the current one. */
export async function regenerateResearchFocusAction(): Promise<
  ActionResult & { topics?: string[]; exclusions?: string[] }
> {
  const { accountId } = await requireAccountId()
  try {
    const focus = await deriveResearchFocus(accountId)
    await setResearchFocus(accountId, focus)
    revalidatePath('/app/research')
    return {
      ok: true,
      message: focus.topics.length
        ? `Regenerated ${focus.topics.length} focus topics from your profile.`
        : 'Could not derive topics — add a skill/profile first, or enter topics manually.',
      topics: focus.topics,
      exclusions: focus.exclusions,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not regenerate focus.' }
  }
}
