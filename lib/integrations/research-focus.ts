import { completeJSON } from '@/lib/agent/complete'
import {
  getProfile,
  getResearchFocus,
  setResearchFocus,
  type ResearchFocus,
} from '@/lib/db/profile'
import { buildSkillDigest } from '@/lib/skills/digest'
import type { OnboardingProfile } from '@/lib/onboarding/schema'

/**
 * The "research focus" is the bridge between WHO the creator is and WHAT we
 * research for them. We derive it once from the rich skill digest + the full
 * onboarding profile (not just the 4 thin fields the query-writer used to see),
 * cache it in `config`, and let the creator edit it. Both the query targeting
 * and the relevance filter in run-research read from it, so research stays on
 * the creator's actual niche instead of drifting into generic noise.
 */

function profileBlock(p: OnboardingProfile | null): string {
  if (!p) return '(no profile captured)'
  return [
    p.oneLiner && `What they do: ${p.oneLiner}`,
    p.role && `Role: ${p.role}`,
    p.company && `Company: ${p.company}`,
    p.audience && `Audience / ICP: ${p.audience}`,
    p.goal && `Primary goal: ${p.goal}`,
    p.pillars && `Content pillars: ${p.pillars}`,
    p.claims && `Can honestly claim: ${p.claims}`,
    p.constraints && `Hard constraints / no-gos: ${p.constraints}`,
    p.bannedTactics && `Banned tactics: ${p.bannedTactics}`,
    p.inspiration && `Studies / admires: ${p.inspiration}`,
    p.pastWins && `Past wins: ${p.pastWins}`,
  ]
    .filter(Boolean)
    .join('\n')
}

const cleanList = (a: unknown, n: number): string[] =>
  Array.isArray(a)
    ? [...new Set(a.map((x) => String(x).trim()).filter((x) => x.length > 1))].slice(0, n)
    : []

const nowIso = () => new Date().toISOString()

/** Split free-text profile fields into rough topics — last resort if the LLM gives nothing. */
function fallbackTopics(profile: OnboardingProfile | null): string[] {
  const raw = [profile?.pillars, profile?.audience, profile?.oneLiner].filter(Boolean).join(', ')
  return raw
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
    .slice(0, 6)
}

/**
 * Derive a fresh research focus from the creator's skill + profile via one LLM
 * call. Never throws on a bad model response (completeJSON returns null); falls
 * back to splitting the profile text. Returns an empty focus only when there is
 * truly no signal (no skill and no profile).
 */
export async function deriveResearchFocus(accountId: string): Promise<ResearchFocus> {
  const [profile, { digest }] = await Promise.all([
    getProfile(accountId),
    buildSkillDigest(accountId),
  ])

  if (!profile && !digest) {
    return { topics: [], exclusions: [], source: 'auto', updatedAt: nowIso() }
  }

  const parsed = await completeJSON<{ topics?: unknown; exclusions?: unknown }>({
    system: [
      "You define a creator's research focus: the specific topics a daily content-research bot should search for on their behalf, and the adjacent themes it should avoid so it doesn't pull irrelevant content.",
      'Return ONLY JSON: {"topics": string[], "exclusions": string[]}. No commentary.',
      'topics: 5-8 CONCRETE, specific subjects this creator actually posts about — specific enough to filter a news feed (e.g. "multifamily property-management operations", "AI adoption by non-technical operators"), NOT broad one-word themes (e.g. "AI", "business", "marketing").',
      'exclusions: 3-6 adjacent-but-off-niche themes that would pull irrelevant content for this creator (derive them from the creator\'s constraints/banned tactics and the obvious neighbouring noise around their niche).',
      'Ground STRICTLY in the SKILL and PROFILE below. Do NOT invent a niche the creator did not state.',
    ].join('\n'),
    user: [`SKILL:\n${digest || '(none)'}`, `\nPROFILE:\n${profileBlock(profile)}`].join('\n'),
    maxTokens: 600,
  })

  const topics = cleanList(parsed?.topics, 8)
  const exclusions = cleanList(parsed?.exclusions, 6)
  return {
    topics: topics.length > 0 ? topics : fallbackTopics(profile),
    exclusions,
    source: 'auto',
    updatedAt: nowIso(),
  }
}

/**
 * Return the stored focus, deriving + persisting one on first use (cron path has
 * no session, so this is where auto-derivation happens). Respects a user who has
 * deliberately cleared their topics — only derives when NOTHING is stored yet.
 * Never throws: a derive failure degrades to an empty focus (research then runs
 * unfiltered rather than breaking).
 */
export async function ensureResearchFocus(accountId: string): Promise<ResearchFocus> {
  const existing = await getResearchFocus(accountId)
  if (existing) return existing
  try {
    const focus = await deriveResearchFocus(accountId)
    if (focus.topics.length > 0) await setResearchFocus(accountId, focus)
    return focus
  } catch (e) {
    console.error('[research-focus] derive failed', e)
    return { topics: [], exclusions: [], source: 'auto', updatedAt: nowIso() }
  }
}
