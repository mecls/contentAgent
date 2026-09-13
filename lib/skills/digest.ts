import { listSkills, readSkill } from '@/lib/skills/store'

/**
 * A compact, LLM-ready digest of the creator's PRIMARY skill: its SKILL.md, which
 * is the whole skill. This is the richest signal we have for a creator's actual
 * niche, so research targeting reuses it rather than the thin onboarding profile
 * alone.
 */

export interface SkillDigest {
  slug: string | null
  digest: string
}

export async function buildSkillDigest(accountId: string): Promise<SkillDigest> {
  const skills = await listSkills(accountId)
  if (skills.length === 0) return { slug: null, digest: '' }
  const slug = skills[0].slug
  const skill = await readSkill(accountId, slug)
  return { slug, digest: `# ${skill.name}\n${skill.skill_md}`.slice(0, 9000) }
}
