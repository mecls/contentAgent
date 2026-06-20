import { requireAccountId } from '@/lib/auth/session'
import { seedSkillsForAccount } from '@/lib/skills/seed'

// Manual reseed (idempotent) — handy if migrations were applied after the
// account was created. Account-scoped; only seeds the caller's own account.
export const runtime = 'nodejs'

export async function POST() {
  let accountId: string
  try {
    ;({ accountId } = await requireAccountId())
  } catch {
    return new Response('unauthorized', { status: 401 })
  }
  await seedSkillsForAccount(accountId)
  return Response.json({ ok: true })
}
