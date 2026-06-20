import { scrapeProfilePosts } from '@/lib/integrations/apify'
import { completeJSON } from '@/lib/agent/complete'
import { DEFAULT_PLATFORM, formatsForPlatform, normalizeFormatKey } from '@/lib/formats/catalog'
import {
  listCompetitors,
  upsertCompetitorPosts,
  type CompetitorPostFeatures,
  type CompetitorPostInput,
} from '@/lib/db/competitors'

/**
 * Weekly competitor analysis for one account: reuse the existing LinkedIn post
 * scraper for each curated competitor, then run a structured LLM pass per post to
 * extract WHY it works (hook, tone, structure, topic, lead magnet/CTA, voice,
 * format…). Stored as a swipe-file the idea + format-trend generators read.
 */

/** System prompt for feature extraction, with the platform's format catalog injected. */
function featureSystem(platform: string): string {
  const defs = formatsForPlatform(platform)
  const list = defs.map((d) => `${d.key} (${d.label})`).join('; ')
  return [
    'You analyze a social post and extract the reusable craft behind it.',
    'Return ONLY JSON with keys: hook (the opening line verbatim or its pattern), tone, structure (e.g. story, listicle, contrarian-take, how-to, announcement), topic, lead_magnet (what they offer, or null), cta (the call to action, or null), voice (1-3 adjectives), format (free-text label, e.g. short, long-form, carousel-caption, poll), format_key (THE single allowed key below whose structural format best matches this post), length_words (integer), why_it_worked (one sentence). No commentary.',
    `Allowed format_key values: ${list}.`,
  ].join('\n')
}

export async function extractPostFeatures(
  content: string,
  metrics: { reactions?: number; comments?: number; reposts?: number },
  platform: string = DEFAULT_PLATFORM,
): Promise<CompetitorPostFeatures> {
  const parsed = await completeJSON<CompetitorPostFeatures>({
    system: featureSystem(platform),
    user: `Engagement: ${metrics.reactions ?? 0} reactions, ${metrics.comments ?? 0} comments, ${metrics.reposts ?? 0} reposts.\n\nPost:\n${content.slice(0, 4000)}`,
    maxTokens: 600,
  })
  const features = parsed ?? {}
  // Pin format_key to a canonical catalog key (the model may answer loosely, or
  // only fill the free-text `format`). Drop it if nothing plausibly matches.
  const key = normalizeFormatKey(platform, features.format_key ?? features.format)
  if (key) features.format_key = key
  else delete features.format_key
  return features
}

export interface CompetitorRunResult {
  competitors: number
  posts: number
}

export async function runCompetitorAnalysisForAccount(
  accountId: string,
): Promise<CompetitorRunResult> {
  const competitors = (await listCompetitors(accountId)).filter((c) => c.active)
  let posts = 0

  for (const competitor of competitors) {
    try {
      const scraped = await scrapeProfilePosts({ profileUrl: competitor.profile_url, maxPosts: 10 })
      const rows: CompetitorPostInput[] = []
      for (const item of scraped) {
        const metrics = {
          reactions: item.reactions,
          comments: item.comments,
          reposts: item.reposts,
        }
        let features: CompetitorPostFeatures = {}
        if (item.content && item.content.trim().length > 0) {
          try {
            features = await extractPostFeatures(item.content, metrics)
          } catch (e) {
            console.error('[competitors] feature extraction failed', item.source_url, e)
          }
        }
        rows.push({
          source_url: item.source_url,
          content: item.content,
          posted_at: item.posted_at,
          metrics,
          features,
        })
      }
      posts += await upsertCompetitorPosts(accountId, competitor.id, rows)
    } catch (e) {
      console.error(`[competitors] scrape failed for ${competitor.profile_url}`, e)
    }
  }

  return { competitors: competitors.length, posts }
}
