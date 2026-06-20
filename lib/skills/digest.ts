import { listSkills, readSkill, readSkillFile } from '@/lib/skills/store'

/**
 * A compact, LLM-ready digest of the creator's PRIMARY skill: SKILL.md plus the
 * few reference files that describe who they are and what they may claim
 * (audience/positioning, constraints, voice, archetypes, tactical). This is the
 * richest signal we have for a creator's actual niche, so anything that needs to
 * understand "what this creator is about" (idea generation, research targeting)
 * reuses this rather than the thin onboarding profile alone.
 */

const REFERENCE_RELEVANCE = /archetype|constraint|voice|preference|positioning|tactical|audience/i

export interface SkillDigest {
  slug: string | null
  digest: string
  files: string[]
}

export async function buildSkillDigest(accountId: string): Promise<SkillDigest> {
  const skills = await listSkills(accountId)
  if (skills.length === 0) return { slug: null, digest: '', files: [] }
  const slug = skills[0].slug
  const skill = await readSkill(accountId, slug)
  const parts: string[] = [`# ${skill.name}\n${skill.skill_md}`]
  const refs = skill.files.filter((p) => p !== 'SKILL.md' && REFERENCE_RELEVANCE.test(p)).slice(0, 4)
  for (const path of refs) {
    try {
      const content = await readSkillFile(accountId, slug, path)
      parts.push(`## ${path}\n${content.slice(0, 2500)}`)
    } catch {
      // skip unreadable reference
    }
  }
  return { slug, digest: parts.join('\n\n').slice(0, 9000), files: skill.files }
}
