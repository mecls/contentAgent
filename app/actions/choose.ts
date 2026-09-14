'use server'

import { revalidatePath } from 'next/cache'
import { requireAccountId } from '@/lib/auth/session'
import { deleteConfig, setConfig } from '@/lib/db/config'
import { LIMITS, type ChooseAngle } from '@/lib/choose/batch'
import { BATCH_KEY, GENERATING_KEY, getCurrentBatch, isGenerating, pickSkill } from '@/lib/choose/inputs'
import { generateBatch, type GenerateResult } from '@/lib/choose/generate'

export interface ChooseActionResult {
  ok: boolean
  message?: string
}

const STALE_BATCH = 'This batch was replaced — reload the page.'

/** The only path that calls the model on the Choose screen. */
export async function proposeBatchAction(focusInput: string | null): Promise<ChooseActionResult> {
  const { accountId } = await requireAccountId()
  const focus = focusInput?.trim() || null
  if (focus && focus.length > LIMITS.focus) {
    return { ok: false, message: 'Focus must be 300 characters or fewer.' }
  }

  const slug = await pickSkill(accountId)
  if (!slug) return { ok: false, message: 'No skill yet — finish onboarding first.' }

  // Read-then-write, not atomic: enough to stop a double-click paying for two batches.
  if (await isGenerating(accountId)) {
    return { ok: false, message: 'A batch is already being generated.' }
  }
  await setConfig(accountId, GENERATING_KEY, { started_at: new Date().toISOString() })

  try {
    let result: GenerateResult
    try {
      result = await generateBatch({ accountId, slug, focus })
    } catch (e) {
      console.error('[choose] generation failed', e)
      return { ok: false, message: "The model didn't respond — nothing was saved. Try again." }
    }
    if (!result.ok) {
      console.error('[choose] invalid batch:', result.reason)
      return { ok: false, message: 'The model returned an unusable batch — nothing was saved. Try again.' }
    }
    try {
      await setConfig(accountId, BATCH_KEY, result.batch)
    } catch (e) {
      console.error('[choose] saving the batch failed', e)
      return { ok: false, message: "Couldn't save the batch — try again." }
    }
    revalidatePath('/app')
    return { ok: true }
  } finally {
    await deleteConfig(accountId, GENERATING_KEY).catch((e) =>
      console.error('[choose] clearing the generation lock failed', e),
    )
  }
}

async function updateAngle(
  accountId: string,
  batchId: string,
  angleId: string,
  patch: Pick<ChooseAngle, 'status' | 'reject_reason'>,
): Promise<ChooseActionResult & { angle?: ChooseAngle }> {
  const batch = await getCurrentBatch(accountId)
  if (!batch || batch.id !== batchId) return { ok: false, message: STALE_BATCH }
  const angle = batch.angles.find((a) => a.id === angleId)
  if (!angle) return { ok: false, message: 'Angle not found.' }
  Object.assign(angle, patch)
  await setConfig(accountId, BATCH_KEY, batch)
  return { ok: true, angle }
}

export async function rejectAngleAction(
  batchId: string,
  angleId: string,
  reasonInput: string,
): Promise<ChooseActionResult> {
  const { accountId } = await requireAccountId()
  const reason = reasonInput.trim()
  if (reason.length < 1 || reason.length > LIMITS.reject_reason) {
    return { ok: false, message: 'Give a reason of 1-200 characters.' }
  }
  const res = await updateAngle(accountId, batchId, angleId, { status: 'rejected', reject_reason: reason })
  if (res.ok) revalidatePath('/app')
  return { ok: res.ok, message: res.message }
}

/** Marks the angle picked and returns where the chat builds its drafting prompt. Never drafts. */
export async function pickAngleAction(
  batchId: string,
  angleId: string,
): Promise<ChooseActionResult & { href?: string }> {
  const { accountId } = await requireAccountId()
  const res = await updateAngle(accountId, batchId, angleId, { status: 'picked', reject_reason: null })
  if (!res.ok || !res.angle) return { ok: false, message: res.message }
  revalidatePath('/app')
  return { ok: true, href: `/app/chat?angle=${encodeURIComponent(res.angle.id)}` }
}
