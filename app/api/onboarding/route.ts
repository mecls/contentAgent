import { type NextRequest } from 'next/server'
import { requireAccountId } from '@/lib/auth/session'
import { OnboardingProfile } from '@/lib/onboarding/schema'
import { setProfile, setOnboarded } from '@/lib/db/profile'
import { generatePersonalizedSkills } from '@/lib/skills/generate'

// Node runtime + generous duration: crafting one skill per platform is several
// LLM calls.
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Runs onboarding: validates the profile, stores it, and crafts one personalized
 * skill per selected platform — streaming progress as SSE so the wizard can show
 * which skill it's building. Account id is server-derived.
 *
 * Events: {step}, {done, skills}, {error}.
 */
export async function POST(req: NextRequest) {
  let accountId: string
  try {
    ;({ accountId } = await requireAccountId())
  } catch {
    return new Response('unauthorized', { status: 401 })
  }

  let profile: OnboardingProfile
  try {
    profile = OnboardingProfile.parse(await req.json())
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'invalid profile' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const encoder = new TextEncoder()
  let closed = false
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
        } catch {
          closed = true
        }
      }
      try {
        await setProfile(accountId, profile)
        send({ step: 'Saved your profile…' })
        const slugs = await generatePersonalizedSkills(accountId, profile, (m) =>
          send({ step: m }),
        )
        await setOnboarded(accountId, true)
        send({ done: true, skills: slugs })
      } catch (e) {
        console.error('[onboarding] failed', e)
        send({ error: e instanceof Error ? e.message : 'onboarding_error' })
      } finally {
        if (!closed) {
          closed = true
          try {
            controller.close()
          } catch {
            // already closed
          }
        }
      }
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
