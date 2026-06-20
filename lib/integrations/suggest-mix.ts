import { completeJSON } from '@/lib/agent/complete'
import { buildProfileNote } from '@/lib/db/profile'
import { buildSkillDigest } from '@/lib/skills/digest'
import { listResearchItems } from '@/lib/db/research'
import { formatPerformance, tagPerformance } from '@/lib/db/posts'
import { listIdeas, createIdeas, type IdeaInput } from '@/lib/db/ideas'
import { createPlan } from '@/lib/db/plans'
import { analyzeFormatTrends } from '@/lib/integrations/analyze-formats'
import { DEFAULT_PLATFORM, formatsForPlatform, formatKeys, normalizeFormatKey } from '@/lib/formats/catalog'

/**
 * Weekly content-plan generator — the "suggest combinations of posts" feature.
 * Combines the deterministic format trends (what's working in the competitor
 * signal) + the creator's own format performance (what they win at) + research,
 * topics, and pending ideas into ONE grounded LLM call that returns a balanced
 * mix: N posts, each assigned a FORMAT + day. The plan is persisted as a
 * content_content_plans row plus N linked content_post_ideas (so each item is
 * draftable/dismissible through the existing idea machinery).
 *
 * Anti-fabrication mirrors run-ideas: the prompt forbids invented facts, and
 * every `source` is hard-filtered in code against real research URLs + skill
 * files. Every `format` is forced onto a real catalog key.
 */

export interface PlanItem {
  format: string
  topic: string
  angle: string | null
  hook: string | null
  rationale: string | null
  planned_for: string
  sources: string[]
}

export interface PlanGenResult {
  planId: string | null
  created: number
  summary: string
  items: PlanItem[]
}

function sanitizeSources(sources: unknown, allowedUrls: Set<string>, skillFiles: string[]): string[] {
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

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** Resolve a model-suggested weekday label to a real upcoming date; fall back to spacing. */
function plannedDate(dayLabel: string | undefined, index: number): string {
  const now = new Date()
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (dayLabel) {
    const norm = dayLabel.toLowerCase()
    const wd = WEEKDAYS.findIndex((w) => norm.includes(w) || norm.includes(w.slice(0, 3)))
    if (wd >= 0) {
      let delta = (wd - base.getDay() + 7) % 7
      if (delta === 0) delta = 7 // keep it in the future
      const d = new Date(base)
      d.setDate(base.getDate() + delta)
      return d.toISOString().slice(0, 10)
    }
  }
  const d = new Date(base)
  d.setDate(base.getDate() + index + 1)
  return d.toISOString().slice(0, 10)
}

export async function suggestPostMixForAccount(
  accountId: string,
  opts: { platform?: string; count?: number; horizonDays?: number } = {},
): Promise<PlanGenResult> {
  const platform = opts.platform ?? DEFAULT_PLATFORM
  const count = Math.min(Math.max(opts.count ?? 4, 1), 8)
  const horizonDays = opts.horizonDays ?? 7

  const [profileNote, { digest, files }, research, trends, ownFormats, tags, pending] =
    await Promise.all([
      buildProfileNote(accountId),
      buildSkillDigest(accountId),
      listResearchItems(accountId, { limit: 20, sinceDays: 7 }),
      analyzeFormatTrends(accountId, platform),
      formatPerformance(accountId).catch(() => []),
      tagPerformance(accountId).catch(() => null),
      listIdeas(accountId, 'pending').catch(() => []),
    ])

  const researchBlock = research.length
    ? research
        .map((r) => `- [${r.source}] ${r.title ?? r.url}${r.summary ? ` — ${r.summary.slice(0, 200)}` : ''} (${r.url})`)
        .join('\n')
    : '(no recent research yet)'

  const trendsBlock = trends.length
    ? trends
        .map(
          (t) =>
            `- ${t.formatKey} (${t.label}): ${t.direction}, recent avg engagement ${t.recentAvg?.toFixed(0) ?? 'n/a'}, ${t.share}% of recent competitor posts, ${t.posts} samples`,
        )
        .join('\n')
    : '(no competitor format signal yet — lean on the catalog + general best practice for this platform)'

  const ownFormatsBlock = ownFormats.length
    ? ownFormats
        .map(
          (f) =>
            `- ${f.format}: ${f.posts} posts, avg ${f.avgReactions?.toFixed(0) ?? 'n/a'} reactions, ${f.avgComments?.toFixed(0) ?? 'n/a'} comments`,
        )
        .join('\n')
    : '(no own-format performance yet)'

  const tagsBlock = tags ? JSON.stringify(tags).slice(0, 1200) : '(no per-tag performance yet)'

  const pendingBlock = pending.length
    ? pending.slice(0, 12).map((i) => `- ${i.topic}${i.angle ? ` — ${i.angle}` : ''}`).join('\n')
    : '(none)'

  const catalogBlock = formatsForPlatform(platform)
    .map((d) => `- ${d.key}: ${d.label} — ${d.description}`)
    .join('\n')

  const allowedUrls = new Set(research.map((r) => r.url))
  const allowedSourcesBlock =
    [...research.map((r) => `- ${r.url}`), ...files.map((f) => `- ${f}`)].join('\n') ||
    '(none — leave sources empty)'

  const parsed = await completeJSON<{
    summary?: string
    items?: { day?: string; format?: string; topic?: string; angle?: string; hook?: string; rationale?: string; sources?: unknown }[]
  }>({
    system: [
      `You are a content strategist building a ${count}-post WEEKLY PLAN for one creator on ${platform}. Assign each post a FORMAT (a structural container — carousel, short text, poll, etc.) and a day. Choose a COMBINATION that (a) leans into formats that are TRENDING in the competitor signal and/or that the creator personally OVER-PERFORMS in, (b) covers their content pillars/topics with variety, and (c) includes exactly ONE "explore" slot using a rising or under-tried format. Spread the posts across the week and avoid repeating the same format back-to-back.`,
      `FORMAT RULES — every "format" value MUST be one of the ALLOWED FORMAT KEYS listed below (use the key exactly, e.g. "carousel", "text-short"). Never invent a format.`,
      `HONESTY RULES — STRICT. Do NOT invent clients, customers, companies, case studies, deployments, partnerships, or specific numbers/metrics. The only claimable facts are what the CREATOR PROFILE lists under "Can honestly claim" and what the SKILL states. Keep any example clearly generic/hypothetical. Never copy a competitor's claims.`,
      `SOURCES — the "sources" array may ONLY contain strings copied EXACTLY from the ALLOWED SOURCES list (real research URLs or skill file paths). If nothing applies, use an empty array.`,
      `Return ONLY JSON: {"summary":"<2-3 sentence rationale for the mix, citing which formats you favored and why>","items":[{"day","format","topic","angle","hook","rationale","sources":[]}]}. Exactly ${count} items. No commentary.`,
    ].join('\n\n'),
    user: [
      `CREATOR PROFILE:\n${profileNote || '(none)'}`,
      `\nSKILL DIGEST:\n${digest || '(none)'}`,
      `\nFORMAT TRENDS (competitor signal — what's working now):\n${trendsBlock}`,
      `\nOWN FORMAT PERFORMANCE (what THIS creator wins at):\n${ownFormatsBlock}`,
      `\nOWN PER-TAG PERFORMANCE:\n${tagsBlock}`,
      `\nRECENT RESEARCH (for topics/angles):\n${researchBlock}`,
      `\nPENDING IDEAS (fold in where they fit a slot):\n${pendingBlock}`,
      `\nALLOWED FORMAT KEYS (pick "format" from these only):\n${catalogBlock || '(none defined for this platform)'}`,
      `\nALLOWED SOURCES (copy verbatim into "sources"; nothing else permitted):\n${allowedSourcesBlock}`,
    ].join('\n'),
    maxTokens: 2200,
  })

  const rawItems = Array.isArray(parsed?.items) ? parsed!.items! : []
  const fallbackFormat = trends[0]?.formatKey ?? formatKeys(platform)[0] ?? null

  const items: PlanItem[] = rawItems
    .slice(0, count)
    .filter((i) => i.topic && String(i.topic).trim().length > 0)
    .map((i, idx) => {
      const fmt =
        normalizeFormatKey(platform, i.format) ??
        (i.format && formatKeys(platform).includes(String(i.format).toLowerCase())
          ? String(i.format).toLowerCase()
          : fallbackFormat)
      return {
        format: fmt ?? 'text-short',
        topic: String(i.topic).trim(),
        angle: i.angle ?? null,
        hook: i.hook ?? null,
        rationale: i.rationale ?? null,
        planned_for: plannedDate(i.day, idx),
        sources: sanitizeSources(i.sources, allowedUrls, files),
      }
    })

  if (items.length === 0) {
    return { planId: null, created: 0, summary: '', items: [] }
  }

  const summary = typeof parsed?.summary === 'string' ? parsed.summary.trim() : ''
  const planId = await createPlan(accountId, { platform, horizonDays, summary, trends })

  const ideaInputs: IdeaInput[] = items.map((it) => ({
    topic: it.topic,
    angle: it.angle,
    structure: null,
    hook: it.hook,
    rationale: it.rationale,
    sources: it.sources,
    format: it.format,
    platform,
    planned_for: it.planned_for,
    plan_id: planId,
  }))
  const created = await createIdeas(accountId, ideaInputs)

  return { planId, created, summary, items }
}
