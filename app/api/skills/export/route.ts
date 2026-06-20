import { type NextRequest } from 'next/server'
import { requireAccountId } from '@/lib/auth/session'
import { exportSkillToZip } from '@/lib/skills/store'

// Download a skill's current files re-packed as a `.skill` (zip) bundle.
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  let accountId: string
  try {
    ;({ accountId } = await requireAccountId())
  } catch {
    return new Response('unauthorized', { status: 401 })
  }
  const slug = new URL(req.url).searchParams.get('slug')
  if (!slug) return new Response('missing slug', { status: 400 })

  const bytes = await exportSkillToZip(accountId, slug)
  // Uint8Array is a valid BodyInit at runtime; the cast sidesteps a TS generics
  // quirk (ArrayBufferLike vs ArrayBuffer).
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${slug}.skill"`,
    },
  })
}
