import { completeJSON } from '@/lib/agent/complete'
import { buildProfileNote } from '@/lib/db/profile'
import { buildSkillDigest } from '@/lib/skills/digest'
import { listResearchItems } from '@/lib/db/research'
import { listCompetitorPosts } from '@/lib/db/competitors'
import { tagPerformance } from '@/lib/db/posts'
import { createIdeas, type IdeaInput } from '@/lib/db/ideas'

/**
 * Generate post ideas for one account by combining everything the system knows:
 * the creator profile + their skill, recent web/social research, competitor post
 * patterns, and the creator's own per-tag performance. One structured LLM call
 * produces N ideas the user can pick to draft.
 *
 * Anti-fabrication is enforced two ways: the prompt forbids inventing
 * clients/metrics/sources, AND every returned `source` is hard-filtered in code
 * against the real research URLs + real skill file paths, so nothing invented can
 * reach the UI even if the model disobeys.
 */

/**
 * Keep only sources that are a real research URL or a real skill file path. Drops
 * anything the model invented (fake PDFs, made-up "internal case studies", etc.).
 */
function sanitizeSources(
  sources: unknown,
  allowedUrls: Set<string>,
  skillFiles: string[],
): string[] {
  if (!Array.isArray(sources)) return []
  const out: string[] = []
  for (const raw of sources) {
    const s = String(raw).trim()
    if (!s) continue
    const isUrl = allowedUrls.has(s)
    const isSkillFile = skillFiles.some((f) => s === f || s.endsWith(`/${f}`) || s.endsWith(f))
    if ((isUrl || isSkillFile) && !out.includes(s)) out.push(s)
    if (out.length >= 4) break
  }
  return out
}

export interface IdeaGenResult {
  created: number
  ideas: IdeaInput[]
}

export async function generateIdeasForAccount(accountId: string, n = 4): Promise<IdeaGenResult> {
  const [profileNote, { digest, files }, research, competitors, tags] = await Promise.all([
    buildProfileNote(accountId),
    buildSkillDigest(accountId),
    listResearchItems(accountId, { limit: 20, sinceDays: 5 }),
    listCompetitorPosts(accountId, { limit: 24 }),
    tagPerformance(accountId).catch(() => null),
  ])

  const researchBlock = research.length
    ? research
        .map((r) => `- [${r.source}] ${r.title ?? r.url}${r.summary ? ` — ${r.summary.slice(0, 240)}` : ''} (${r.url})`)
        .join('\n')
    : '(no recent research yet)'

  const competitorBlock = competitors.length
    ? competitors
        .map((c) => {
          const f = c.features ?? {}
          return `- structure: ${f.structure ?? '?'}; hook: ${f.hook ?? '?'}; why: ${f.why_it_worked ?? '?'} (${c.metrics?.reactions ?? 0} reactions)`
        })
        .join('\n')
    : '(no competitor data yet)'

  const tagsBlock = tags ? JSON.stringify(tags).slice(0, 1500) : '(no per-tag performance yet)'

  // The ONLY strings allowed in `sources`.
  const allowedUrls = new Set(research.map((r) => r.url))
  const allowedSourcesBlock = [
    ...research.map((r) => `- ${r.url}`),
    ...files.map((f) => `- ${f}`),
  ].join('\n') || '(none — leave sources empty)'

  const parsed = await completeJSON<{ ideas?: (IdeaInput & { sources?: unknown })[] }>({
    system: [
      `You are a content strategist generating ${n} post ideas for one specific creator. Use the RESEARCH and COMPETITOR PATTERNS for WHAT to talk about (timely, relevant angles); the CREATOR PROFILE and SKILL are the source of truth for voice, positioning, and constraints.`,
      `HONESTY RULES — STRICT. Do NOT invent clients, customers, companies, case studies, deployments, partnerships, or specific numbers/metrics. Do NOT fabricate "internal case studies" or PDFs. The only real, claimable facts are what the CREATOR PROFILE lists under "Can honestly claim" and what the SKILL states — anything beyond that is fabrication and is forbidden. If an example would help, keep it clearly generic/hypothetical (no real company names), never presented as a real result the creator achieved. Never copy a competitor's claims.`,
      `SOURCES — the "sources" array may ONLY contain strings copied EXACTLY from the ALLOWED SOURCES list below (real research URLs or real skill file paths). Never invent a URL, file, or study. If nothing applies, use an empty array.`,
      `Return ONLY JSON: {"ideas":[{"topic","angle","structure","hook","rationale","sources":[]}]}. ${n} ideas. No commentary.`,
    ].join('\n\n'),
    user: [
      `CREATOR PROFILE:\n${profileNote || '(none)'}`,
      `\nSKILL DIGEST:\n${digest || '(none)'}`,
      `\nRECENT RESEARCH:\n${researchBlock}`,
      `\nCOMPETITOR PATTERNS:\n${competitorBlock}`,
      `\nOWN PER-TAG PERFORMANCE:\n${tagsBlock}`,
      `\nALLOWED SOURCES (copy these strings verbatim into "sources"; nothing else is permitted):\n${allowedSourcesBlock}`,
    ].join('\n'),
    maxTokens: 1800,
  })

  const raw = Array.isArray(parsed?.ideas) ? parsed!.ideas : []
  const ideas: IdeaInput[] = raw.slice(0, n).map((i) => ({
    topic: i.topic,
    angle: i.angle ?? null,
    structure: i.structure ?? null,
    hook: i.hook ?? null,
    rationale: i.rationale ?? null,
    sources: sanitizeSources(i.sources, allowedUrls, files),
  }))
  const created = await createIdeas(accountId, ideas)
  return { created, ideas }
}
