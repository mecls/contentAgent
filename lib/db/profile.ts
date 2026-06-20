import { supabaseService } from '@/lib/supabase/service'
import { listSkills } from '@/lib/skills/store'
import { platformLabel, type OnboardingProfile } from '@/lib/onboarding/schema'

/**
 * Onboarding state + the captured profile live in the shared `config` table
 * (account_id, key, value jsonb) — no extra migration needed. `content_profile`
 * holds the answers; `onboarded` is the completion flag.
 */

async function getConfig(accountId: string, key: string): Promise<unknown> {
  const { data, error } = await supabaseService()
    .from('config')
    .select('value')
    .eq('account_id', accountId)
    .eq('key', key)
    .maybeSingle()
  if (error) throw new Error(`getConfig(${key}) failed: ${error.message}`)
  return data?.value ?? null
}

async function setConfig(accountId: string, key: string, value: unknown): Promise<void> {
  const { error } = await supabaseService()
    .from('config')
    .upsert({ account_id: accountId, key, value }, { onConflict: 'account_id,key' })
  if (error) throw new Error(`setConfig(${key}) failed: ${error.message}`)
}

export async function getProfile(accountId: string): Promise<OnboardingProfile | null> {
  return (await getConfig(accountId, 'content_profile')) as OnboardingProfile | null
}

export async function setProfile(accountId: string, profile: OnboardingProfile): Promise<void> {
  await setConfig(accountId, 'content_profile', profile)
}

export async function setOnboarded(accountId: string, value = true): Promise<void> {
  await setConfig(accountId, 'onboarded', value)
}

/**
 * The creator's "research focus" — the niche topics research should target and
 * the adjacent-but-off-niche themes it should avoid. Auto-derived from the skill
 * + profile, then user-editable. Stored in `config` under key `research_focus`,
 * so it needs no extra table. This is the single source of truth for BOTH what
 * to search for and what counts as relevant when filtering results.
 */
export interface ResearchFocus {
  topics: string[]
  exclusions: string[]
  source: 'auto' | 'user'
  updatedAt: string
}

export async function getResearchFocus(accountId: string): Promise<ResearchFocus | null> {
  return (await getConfig(accountId, 'research_focus')) as ResearchFocus | null
}

export async function setResearchFocus(accountId: string, focus: ResearchFocus): Promise<void> {
  await setConfig(accountId, 'research_focus', focus)
}

/**
 * Cross-account list of accounts that have completed onboarding (have a captured
 * profile). Used by the research/ideas crons, which have no user session.
 */
export async function listOnboardedAccountIds(): Promise<string[]> {
  const { data, error } = await supabaseService()
    .from('config')
    .select('account_id')
    .eq('key', 'content_profile')
  if (error) throw new Error(`listOnboardedAccountIds failed: ${error.message}`)
  return [...new Set((data ?? []).map((r) => r.account_id as string))]
}

/**
 * Treat an account as onboarded if the flag is set OR it already has at least one
 * skill (so pre-existing accounts — e.g. the hand-crafted one — are never forced
 * through onboarding).
 */
export async function isOnboarded(accountId: string): Promise<boolean> {
  const flag = await getConfig(accountId, 'onboarded')
  if (flag === true) return true
  const skills = await listSkills(accountId)
  return skills.length > 0
}

/**
 * A compact, model-facing summary of the onboarding profile, injected as a
 * system note each turn so the agent tailors content even when a detail isn't
 * yet captured in a skill file. This is background context only — the skill
 * files remain the source of truth for voice/constraints when they overlap.
 * Returns '' when no profile has been captured (e.g. pre-onboarding accounts).
 */
export async function buildProfileNote(accountId: string): Promise<string> {
  const p = await getProfile(accountId)
  if (!p) return ''
  const lines = [
    `Name: ${p.name}`,
    p.role && `Role/title: ${p.role}`,
    p.company && `Company: ${p.company}`,
    p.oneLiner && `What they do: ${p.oneLiner}`,
    p.stage && `Stage: ${p.stage}`,
    p.claims && `Can honestly claim: ${p.claims}`,
    p.audience && `Audience / ICP: ${p.audience}`,
    p.goal && `Primary goal: ${p.goal}`,
    p.platforms?.length && `Platforms: ${p.platforms.map(platformLabel).join(', ')}`,
    p.pillars && `Content pillars: ${p.pillars}`,
    `Voice: ${p.voiceFormality} formality, ${p.voiceEdge} edge, emoji ${p.voiceEmoji ? 'allowed' : 'avoided'}`,
    p.constraints && `Hard constraints / no-gos: ${p.constraints}`,
    p.bannedTactics && `Banned tactics: ${p.bannedTactics}`,
    p.cadence && `Cadence: ${p.cadence}`,
    p.timezone && `Timezone: ${p.timezone}`,
    p.conversion && `Conversion path: ${p.conversion}`,
  ].filter(Boolean)
  return `CREATOR PROFILE (background context for tailoring — when it overlaps with a skill file, the skill file wins):\n${lines.join('\n')}`
}
