import { listCompetitorPosts } from '@/lib/db/competitors'
import { DEFAULT_PLATFORM, formatLabel } from '@/lib/formats/catalog'

/**
 * Trending-format analysis: "which structural formats are working right now" for
 * a platform. Deterministic aggregation over signal we ALREADY collect — the
 * competitor posts scraped weekly — grouped by their classified `format_key` and
 * ranked by recency-weighted engagement. No LLM here: the rankings must be
 * grounded in real engagement, not invented.
 *
 * The signal source is pluggable (`opts.source`) so external trend scrapers can
 * be added per platform later without touching callers.
 */

export interface FormatTrend {
  formatKey: string
  label: string
  platform: string
  /** Posts observed with this format. */
  posts: number
  /** All-time avg engagement (reactions + comments + reposts). */
  avgEngagement: number | null
  /** Avg engagement for posts ≤30 days old. */
  recentAvg: number | null
  /** Avg engagement for posts 30–60 days old. */
  priorAvg: number | null
  direction: 'rising' | 'steady' | 'falling'
  /** Share of recent posts (≤30d) using this format, 0–100. */
  share: number
}

/** Minimal per-post signal a trend source yields. */
export interface FormatSignalPost {
  formatKey: string | null
  engagement: number
  postedAt: string | null
}

export type FormatSignalSource = (
  accountId: string,
  platform: string,
) => Promise<FormatSignalPost[]>

const DAY = 86_400_000

/** Default source: the competitor posts we already scrape weekly. */
const competitorSignal: FormatSignalSource = async (accountId, platform) => {
  // `platform` is reserved for when non-LinkedIn competitor scrapes exist; today
  // all competitor posts are LinkedIn, so they are read as-is.
  void platform
  const rows = await listCompetitorPosts(accountId, { limit: 200 })
  return rows.map((r) => ({
    formatKey: r.features?.format_key ?? null,
    engagement: (r.metrics?.reactions ?? 0) + (r.metrics?.comments ?? 0) + (r.metrics?.reposts ?? 0),
    postedAt: r.posted_at,
  }))
}

export async function analyzeFormatTrends(
  accountId: string,
  platform: string = DEFAULT_PLATFORM,
  opts: { source?: FormatSignalSource } = {},
): Promise<FormatTrend[]> {
  const source = opts.source ?? competitorSignal
  const signal = (await source(accountId, platform)).filter((s) => s.formatKey)
  if (signal.length === 0) return []

  const now = Date.now()
  const ageDays = (iso: string | null): number | null =>
    iso ? (now - new Date(iso).getTime()) / DAY : null
  const isRecent = (s: FormatSignalPost): boolean => {
    const a = ageDays(s.postedAt)
    return a !== null && a <= 30
  }
  const isPrior = (s: FormatSignalPost): boolean => {
    const a = ageDays(s.postedAt)
    return a !== null && a > 30 && a <= 60
  }
  const avg = (nums: number[]): number | null =>
    nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null

  const recentTotal = signal.filter(isRecent).length

  const byFormat = new Map<string, FormatSignalPost[]>()
  for (const s of signal) {
    const key = s.formatKey as string
    const arr = byFormat.get(key) ?? []
    arr.push(s)
    byFormat.set(key, arr)
  }

  const trends: FormatTrend[] = [...byFormat.entries()].map(([formatKey, ps]) => {
    const recent = ps.filter(isRecent)
    const prior = ps.filter(isPrior)
    const recentAvg = avg(recent.map((s) => s.engagement))
    const priorAvg = avg(prior.map((s) => s.engagement))
    let direction: FormatTrend['direction'] = 'steady'
    if (recentAvg !== null && priorAvg !== null && priorAvg > 0) {
      if (recentAvg > priorAvg * 1.15) direction = 'rising'
      else if (recentAvg < priorAvg * 0.85) direction = 'falling'
    }
    return {
      formatKey,
      label: formatLabel(platform, formatKey),
      platform,
      posts: ps.length,
      avgEngagement: avg(ps.map((s) => s.engagement)),
      recentAvg,
      priorAvg,
      direction,
      share: recentTotal > 0 ? Math.round((recent.length / recentTotal) * 100) : 0,
    }
  })

  return trends.sort(
    (a, b) => (b.recentAvg ?? b.avgEngagement ?? -1) - (a.recentAvg ?? a.avgEngagement ?? -1),
  )
}
