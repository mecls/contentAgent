import type { PlatformId } from '@/lib/onboarding/schema'

/**
 * The FORMAT taxonomy — the structural/media container a post takes on each
 * platform (carousel, short text, poll, reel…). This is a NEW axis, orthogonal
 * to `tags` (topic) and `archetype` (narrative angle). It is the "platform-
 * specific viral format" the planning feature reasons about.
 *
 * Kept as version-controlled reference data (not per-account rows): aggregation
 * needs stable normalized keys, the agent can read it, and there is no migration
 * or seed to manage. Free-text formats coming off competitor scrapes (or the
 * model) are mapped onto these canonical keys via `normalizeFormatKey`.
 *
 * Today only LinkedIn carries real signal (it is the only platform we scrape),
 * but every platform in the onboarding enum gets a starter set so the analysis
 * and plan generators generalize the moment other scrapers exist.
 */

export interface FormatDef {
  /** Canonical kebab-case key — the value stored on posts/ideas/competitor rows. */
  key: string
  /** Human label for UI + prompts. */
  label: string
  platform: PlatformId
  /** One-line description of the container. */
  description: string
  /** Free-text variants that should normalize onto this key. */
  aliases?: string[]
}

/** The platform we have real format signal for today. */
export const DEFAULT_PLATFORM: PlatformId = 'linkedin'

export const FORMAT_CATALOG: Partial<Record<PlatformId, FormatDef[]>> = {
  linkedin: [
    { key: 'text-short', label: 'Short text', platform: 'linkedin', description: 'Punchy text-only post (≤ ~600 chars) — one insight or contrarian line.', aliases: ['short', 'one-liner', 'short-form', 'micro'] },
    { key: 'text-long', label: 'Long-form text', platform: 'linkedin', description: 'Mini-essay / story / listicle / how-to with line breaks.', aliases: ['long-form', 'long form', 'longform', 'story', 'listicle', 'essay'] },
    { key: 'carousel', label: 'Carousel / document', platform: 'linkedin', description: 'Multi-slide swipeable PDF/document.', aliases: ['carousel-caption', 'document', 'pdf', 'slides', 'deck'] },
    { key: 'image-text', label: 'Image + text', platform: 'linkedin', description: 'Single image/graphic/screenshot with a caption.', aliases: ['image', 'photo', 'graphic', 'screenshot', 'single-image'] },
    { key: 'poll', label: 'Poll', platform: 'linkedin', description: 'Native poll asking the audience to vote.', aliases: ['survey', 'vote'] },
    { key: 'video', label: 'Video', platform: 'linkedin', description: 'Native video or short clip.', aliases: ['clip', 'reel'] },
    { key: 'repost-commentary', label: 'Repost + commentary', platform: 'linkedin', description: "Reshare/quote of someone else's content with added take.", aliases: ['repost', 'reshare', 'quote', 'commentary'] },
    { key: 'newsletter-link', label: 'Newsletter / external link', platform: 'linkedin', description: 'Post pointing out to a newsletter or article.', aliases: ['link', 'newsletter', 'article-link'] },
  ],
  x: [
    { key: 'single-tweet', label: 'Single tweet', platform: 'x', description: 'One standalone post.', aliases: ['tweet', 'single', 'short'] },
    { key: 'thread', label: 'Thread', platform: 'x', description: 'Multi-tweet / numbered thread.', aliases: ['multi-tweet', 'numbered', 'tweetstorm'] },
    { key: 'quote-tweet', label: 'Quote post', platform: 'x', description: "Quote of another post with commentary.", aliases: ['quote', 'qt', 'commentary'] },
    { key: 'image-tweet', label: 'Image post', platform: 'x', description: 'Post built around an image/screenshot.', aliases: ['image', 'screenshot', 'photo'] },
    { key: 'video-tweet', label: 'Video post', platform: 'x', description: 'Post built around a video clip.', aliases: ['video', 'clip'] },
    { key: 'poll', label: 'Poll', platform: 'x', description: 'Native poll.', aliases: ['survey', 'vote'] },
  ],
  instagram: [
    { key: 'reel', label: 'Reel', platform: 'instagram', description: 'Short vertical video.', aliases: ['video', 'short'] },
    { key: 'carousel', label: 'Carousel', platform: 'instagram', description: 'Multi-image swipeable post.', aliases: ['slides', 'swipe'] },
    { key: 'single-image', label: 'Single image', platform: 'instagram', description: 'One image/graphic with caption.', aliases: ['image', 'photo', 'post'] },
    { key: 'story', label: 'Story', platform: 'instagram', description: 'Ephemeral story frame.', aliases: ['stories'] },
  ],
  tiktok: [
    { key: 'talking-head', label: 'Talking head', platform: 'tiktok', description: 'Direct-to-camera commentary.', aliases: ['monologue', 'piece-to-camera'] },
    { key: 'tutorial', label: 'Tutorial / how-to', platform: 'tiktok', description: 'Step-by-step demo.', aliases: ['how-to', 'demo'] },
    { key: 'trend-remix', label: 'Trend remix', platform: 'tiktok', description: 'Riff on a trending sound/format.', aliases: ['trend', 'sound', 'remix'] },
    { key: 'story-time', label: 'Story-time', platform: 'tiktok', description: 'Narrative story to camera.', aliases: ['story', 'narrative'] },
  ],
  youtube: [
    { key: 'long-form', label: 'Long-form video', platform: 'youtube', description: 'Full-length video.', aliases: ['video', 'longform', 'long form'] },
    { key: 'short', label: 'Short', platform: 'youtube', description: 'Vertical short-form clip.', aliases: ['shorts', 'clip', 'reel'] },
    { key: 'tutorial', label: 'Tutorial', platform: 'youtube', description: 'How-to / walkthrough.', aliases: ['how-to', 'walkthrough', 'demo'] },
  ],
  threads: [
    { key: 'text-short', label: 'Short text', platform: 'threads', description: 'Punchy single post.', aliases: ['short', 'single'] },
    { key: 'text-thread', label: 'Thread', platform: 'threads', description: 'Multi-post thread.', aliases: ['thread', 'multi'] },
    { key: 'image-text', label: 'Image + text', platform: 'threads', description: 'Image/graphic with caption.', aliases: ['image', 'photo'] },
  ],
  substack: [
    { key: 'essay', label: 'Essay', platform: 'substack', description: 'Long-form essay/article.', aliases: ['article', 'long-form', 'longform'] },
    { key: 'digest', label: 'Digest / roundup', platform: 'substack', description: 'Curated links + commentary.', aliases: ['roundup', 'newsletter', 'links'] },
    { key: 'list', label: 'Listicle', platform: 'substack', description: 'Numbered/list-driven piece.', aliases: ['listicle', 'list-post'] },
  ],
  reddit: [
    { key: 'text-post', label: 'Text post', platform: 'reddit', description: 'Self/text post.', aliases: ['self', 'discussion', 'text'] },
    { key: 'link-post', label: 'Link post', platform: 'reddit', description: 'Outbound link submission.', aliases: ['link', 'url'] },
    { key: 'image-post', label: 'Image post', platform: 'reddit', description: 'Image/screenshot submission.', aliases: ['image', 'photo', 'screenshot'] },
  ],
  facebook: [
    { key: 'text-post', label: 'Text post', platform: 'facebook', description: 'Text-only status.', aliases: ['status', 'text', 'short'] },
    { key: 'image-text', label: 'Image + text', platform: 'facebook', description: 'Image/graphic with caption.', aliases: ['image', 'photo'] },
    { key: 'video', label: 'Video', platform: 'facebook', description: 'Native video/clip.', aliases: ['clip', 'reel'] },
  ],
  bluesky: [
    { key: 'text-short', label: 'Short text', platform: 'bluesky', description: 'Punchy single post.', aliases: ['short', 'single', 'skeet'] },
    { key: 'image-text', label: 'Image + text', platform: 'bluesky', description: 'Image/graphic with caption.', aliases: ['image', 'photo'] },
    { key: 'thread', label: 'Thread', platform: 'bluesky', description: 'Multi-post thread.', aliases: ['multi', 'tweetstorm'] },
  ],
}

/** Format definitions for a platform (empty array if none defined yet). */
export function formatsForPlatform(platform: string): FormatDef[] {
  return FORMAT_CATALOG[platform as PlatformId] ?? []
}

/** Canonical format keys for a platform. */
export function formatKeys(platform: string): string[] {
  return formatsForPlatform(platform).map((d) => d.key)
}

/** Display label for a (platform, key) pair; falls back to the raw key. */
export function formatLabel(platform: string, key: string | null | undefined): string {
  if (!key) return 'Unclassified'
  return formatsForPlatform(platform).find((d) => d.key === key)?.label ?? key
}

const normToken = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Map a free-text format label (from a competitor scrape, the model, or a user)
 * onto a canonical catalog key for the platform. Returns null when nothing
 * plausibly matches — callers decide whether to keep the raw value or drop it.
 */
export function normalizeFormatKey(
  platform: string,
  raw: string | null | undefined,
): string | null {
  if (!raw) return null
  const defs = formatsForPlatform(platform)
  if (defs.length === 0) return null
  const target = normToken(raw)
  if (!target) return null

  // 1. exact match on key / label / alias
  for (const d of defs) {
    const exact = [d.key, d.label, ...(d.aliases ?? [])].map(normToken)
    if (exact.includes(target)) return d.key
  }
  // 2. substring overlap either direction (e.g. "carousel caption" → "carousel")
  for (const d of defs) {
    const hay = [d.key, d.label, ...(d.aliases ?? [])].map(normToken).filter(Boolean)
    if (hay.some((h) => target.includes(h) || h.includes(target))) return d.key
  }
  return null
}
