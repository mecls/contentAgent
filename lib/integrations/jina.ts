import { env } from '@/lib/env'
import type { ResearchItem } from '@/lib/integrations/exa'

/**
 * Content extraction via Jina Reader (r.jina.ai) — free with no key (rate-limited),
 * faster/higher-limit if a JINA_API_KEY is set. Given a URL it returns the clean
 * readable text of the page, including many paywalled/JS-heavy articles. We use it
 * to backfill summaries for items that arrive without one (mainly Hacker News link
 * posts), so the relevance filter and idea generation have something to work with.
 */

const READER = 'https://r.jina.ai/'

/** Extract clean text from a URL. Returns null on any failure (never throws). */
export async function jinaExtract(
  url: string,
  opts: { maxChars?: number; timeoutMs?: number } = {},
): Promise<string | null> {
  const maxChars = opts.maxChars ?? 800
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12_000)
  try {
    const key = env.jinaApiKey()
    const res = await fetch(`${READER}${url}`, {
      headers: {
        Accept: 'text/plain',
        // Ask for plain text (not markdown) so the summary is clean prose.
        'X-Return-Format': 'text',
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      signal: controller.signal,
    })
    if (!res.ok) return null
    const text = (await res.text()).trim()
    return text ? text.slice(0, maxChars) : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Backfill summaries in place for items that lack one, by extracting the linked
 * page. Bounded (only the first `max` summary-less items) so a research run never
 * fans out into dozens of slow page fetches. Best-effort: failures leave the item
 * summary null.
 */
export async function enrichSummaries(items: ResearchItem[], max = 8): Promise<void> {
  const targets = items.filter((it) => !it.summary && it.url).slice(0, max)
  if (targets.length === 0) return
  await Promise.allSettled(
    targets.map(async (it) => {
      const text = await jinaExtract(it.url)
      if (text) it.summary = text
    }),
  )
}
