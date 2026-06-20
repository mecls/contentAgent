import { getProfile, type ResearchFocus } from '@/lib/db/profile'
import { completeJSON } from '@/lib/agent/complete'
import { exaSearch, type ResearchItem } from '@/lib/integrations/exa'
import { linkedinTopContent } from '@/lib/integrations/apify-sources'
import { hackerNewsSearch } from '@/lib/integrations/hackernews'
import { enrichSummaries } from '@/lib/integrations/jina'
import { upsertResearchItems, lastResearchAt } from '@/lib/db/research'
import { ensureResearchFocus } from '@/lib/integrations/research-focus'
import type { OnboardingProfile } from '@/lib/onboarding/schema'

/**
 * Daily research for one account: derive queries from the creator's focus, fan
 * out to free sources (Exa web + Hacker News) plus LinkedIn top-content, backfill
 * missing summaries via Jina, and store the results. Each source is isolated —
 * one failing source never aborts the rest.
 */

interface ResearchQueries {
  webQueries: string[]
  keywords: string[]
  linkedinTopics: string[]
}

/** Fallback when the LLM is unavailable: split pillars/audience into keywords. */
function fallbackQueries(profile: OnboardingProfile | null): ResearchQueries {
  const raw = [profile?.pillars, profile?.audience, profile?.oneLiner].filter(Boolean).join(', ')
  const parts = raw
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
    .slice(0, 5)
  return { webQueries: parts, keywords: parts.slice(0, 4), linkedinTopics: parts.slice(0, 3) }
}

/**
 * Turn the creator's research FOCUS (their niche topics + exclusions) into
 * concrete search queries, staying strictly inside the topics. When the focus is
 * empty (pre-onboarding, or the creator cleared it) we fall back to splitting the
 * profile text so research still runs — just unfocused.
 */
export async function deriveResearchQueries(
  focus: ResearchFocus,
  profile: OnboardingProfile | null,
): Promise<ResearchQueries> {
  if (focus.topics.length === 0) return fallbackQueries(profile)
  const parsed = await completeJSON<Partial<ResearchQueries>>({
    system:
      "You turn a creator's research focus into search queries for content research. Stay STRICTLY within the listed TOPICS and never drift into the EXCLUSIONS. Return ONLY JSON with keys webQueries (3-5 natural web search queries about what is new/trending within these topics), keywords (3-5 short keyword phrases for Hacker News search), linkedinTopics (2-4 short topic labels). No commentary.",
    user: [
      `TOPICS (research only these):\n${focus.topics.map((t) => `- ${t}`).join('\n')}`,
      focus.exclusions.length
        ? `\nEXCLUSIONS (never search for these):\n${focus.exclusions.map((t) => `- ${t}`).join('\n')}`
        : '',
      profile?.audience ? `\nAudience/ICP (context only): ${profile.audience}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    maxTokens: 500,
  })
  const clean = (a: unknown, n: number): string[] =>
    Array.isArray(a)
      ? a.map((x) => String(x).trim()).filter((x) => x.length > 1).slice(0, n)
      : []
  const q: ResearchQueries = {
    webQueries: clean(parsed?.webQueries, 5),
    keywords: clean(parsed?.keywords, 5),
    linkedinTopics: clean(parsed?.linkedinTopics, 4),
  }
  // If the model gave us nothing usable, search the focus topics verbatim.
  if (q.webQueries.length === 0 && q.keywords.length === 0) {
    return {
      webQueries: focus.topics.slice(0, 5),
      keywords: focus.topics.slice(0, 4),
      linkedinTopics: focus.topics.slice(0, 3),
    }
  }
  return q
}

/**
 * Drop fetched items that aren't on the creator's niche, in ONE batched LLM call.
 * Fail-open by design: an empty focus, an unparseable response, or a "keep
 * nothing" result all return the items unchanged — we never silently throw away
 * a whole research run.
 */
async function filterRelevantItems(
  items: ResearchItem[],
  focus: ResearchFocus,
): Promise<ResearchItem[]> {
  if (focus.topics.length === 0 || items.length === 0) return items

  const numbered = items
    .map((it, i) => {
      const head = (it.title ?? it.url).slice(0, 140)
      const tail = it.summary ? ` — ${it.summary.slice(0, 200)}` : ''
      return `${i}. [${it.source}] ${head}${tail}`
    })
    .join('\n')

  const parsed = await completeJSON<{ keep?: unknown }>({
    system: [
      "You are filtering a content-research feed for one specific creator. Keep only items that are genuinely useful SOURCE MATERIAL for that creator's posts — on their TOPICS and not matching their EXCLUSIONS.",
      'Err toward keeping an item when it is plausibly relevant; drop only items that are clearly off-niche.',
      'Return ONLY JSON: {"keep": number[]} — the indices (from the numbered list) to KEEP. No commentary.',
    ].join('\n'),
    user: [
      `TOPICS:\n${focus.topics.map((t) => `- ${t}`).join('\n')}`,
      focus.exclusions.length
        ? `\nEXCLUSIONS:\n${focus.exclusions.map((t) => `- ${t}`).join('\n')}`
        : '',
      `\nITEMS:\n${numbered}`,
    ]
      .filter(Boolean)
      .join('\n'),
    maxTokens: 500,
  })

  if (!parsed || !Array.isArray(parsed.keep)) return items
  const keep = new Set(
    parsed.keep
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 0 && n < items.length),
  )
  // Treat "kept nothing" as a likely bad pass rather than nuke the run.
  if (keep.size === 0) return items
  return items.filter((_, i) => keep.has(i))
}

export interface ResearchRunResult {
  web: number
  hackernews: number
  linkedin: number
  stored: number
}

type SourceKey = 'web' | 'hackernews' | 'linkedin'

export async function runResearchForAccount(accountId: string): Promise<ResearchRunResult> {
  const [profile, focus] = await Promise.all([getProfile(accountId), ensureResearchFocus(accountId)])
  const queries = await deriveResearchQueries(focus, profile)
  const counts: Record<SourceKey, number> = { web: 0, hackernews: 0, linkedin: 0 }

  // Run every source concurrently so wall time ≈ the slowest source, not the sum
  // (Exa, Hacker News, and the LinkedIn actor can each take tens of seconds). One
  // failing source never blocks the others — Promise.allSettled + per-source logs.
  const tasks: Array<Promise<{ key: SourceKey; items: ResearchItem[] }>> = [
    ...queries.webQueries
      .slice(0, 4)
      .map((query) =>
        exaSearch({ query, numResults: 5, topic: query }).then((items) => ({ key: 'web' as const, items })),
      ),
    hackerNewsSearch(queries.keywords, 5).then((items) => ({ key: 'hackernews' as const, items })),
    linkedinTopContent(queries.linkedinTopics, 5).then((items) => ({ key: 'linkedin' as const, items })),
  ]

  const collected: ResearchItem[] = []
  for (const r of await Promise.allSettled(tasks)) {
    if (r.status === 'fulfilled') {
      counts[r.value.key] += r.value.items.length
      collected.push(...r.value.items)
    } else {
      console.error('[research] source failed', r.reason)
    }
  }

  // Backfill summaries for items that arrived without one (Hacker News link posts)
  // by extracting the linked page — so filtering & ideation have real text to use.
  await enrichSummaries(collected)

  // Drop off-niche items before they ever reach the Research page / idea gen.
  const relevant = await filterRelevantItems(collected, focus)
  if (relevant.length !== collected.length) {
    console.log(
      `[research] relevance filter kept ${relevant.length}/${collected.length} (dropped ${collected.length - relevant.length})`,
    )
  }

  const stored = await upsertResearchItems(accountId, relevant)
  return { ...counts, stored }
}

/**
 * Run research only if the last run is older than `maxAgeHours` — otherwise reuse
 * the existing items. Lets the on-demand "plan my week" flow stay fast without
 * re-paying for Exa/Apify on every click.
 */
export async function runResearchIfStale(
  accountId: string,
  maxAgeHours = 24,
): Promise<ResearchRunResult & { reused: boolean }> {
  const last = await lastResearchAt(accountId)
  if (last && Date.now() - new Date(last).getTime() < maxAgeHours * 3_600_000) {
    return { web: 0, hackernews: 0, linkedin: 0, stored: 0, reused: true }
  }
  return { ...(await runResearchForAccount(accountId)), reused: false }
}
