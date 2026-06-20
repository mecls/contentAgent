import { scrapeProfilePosts, type ScrapedItem } from '@/lib/integrations/apify'
import { openai, llmModel } from '@/lib/agent/llm'
import { listSkills, writeSkillFile } from '@/lib/skills/store'

/**
 * Writing-style-by-reference: scrape a creator's recent posts, distill HOW they
 * write into a reusable style guide, and write it into the skill as
 * `references/voice-reference.md`. The agent reads that file before drafting, so
 * the creator's posts come out in the referenced voice. Re-running overwrites the
 * file (with version history kept for rollback), so the creator can re-point their
 * style at a new reference any time from chat.
 *
 * Reuses the same Apify actor + one-shot LLM-extraction pattern as the competitor
 * analysis (run-competitors.ts) — here aimed at producing a voice/tactics guide
 * rather than per-post features.
 */

export const VOICE_REFERENCE_PATH = 'references/voice-reference.md'

const STYLE_SYSTEM = `You are a writing-style analyst. You are given a set of social posts by ONE author. Produce a precise, reusable STYLE GUIDE that a different writer could follow to reproduce this author's voice AND their full engagement playbook on the same platform.

Capture, with specifics and short verbatim snippets (in quotes) pulled from the posts:
- Voice & tone — 3-6 adjectives, and what in the writing creates them.
- Sentence & paragraph rhythm — typical lengths, use of fragments, one-line paragraphs, punctuation/dash habits.
- Hook patterns — exactly how they open. Give 2-3 real opener examples.
- Structure / archetypes they reuse — e.g. story, listicle, contrarian take, how-to, problem→solution.
- Formatting habits — line breaks, white space, emoji use, bullet/symbol style, capitalization.
- Engagement tactics & CTAs — how they drive comments/shares and how they close. Quote the real CTAs they use (including comment-gated ones like "comment X", lead-magnet offers, question closes).
- Use of numbers/specifics — how they deploy metrics, names, and concrete details for punch.
- Vocabulary & signature phrases — recurring words, openers, transitions.
- A short DO / DON'T list for matching this exact voice.

Output GitHub-flavored Markdown ONLY (use ## section headings). No preamble, no JSON, no closing commentary. Be concrete and cite short snippets. Keep it under ~550 words. Do NOT invent anything that isn't supported by the posts.`

export interface StyleLearnResult {
  slug: string
  path: string
  profileUrl: string
  author: string | null
  sampleCount: number
  /** The full markdown written to the skill (header + extracted guide). */
  markdown: string
  /** A short plain-text summary for the chat reply. */
  summary: string
  version: number
}

/** Build the numbered corpus handed to the analyst, bounded for the context window. */
function buildCorpus(posts: ScrapedItem[]): string {
  return posts
    .map((p, i) => {
      const eng = `(${p.reactions} reactions · ${p.comments} comments · ${p.reposts} reposts)`
      const text = (p.content ?? '').trim().slice(0, 1500)
      return `--- POST ${i + 1} ${eng} ---\n${text}`
    })
    .join('\n\n')
}

/** Run the LLM analyst over the corpus and return the markdown style guide. */
export async function extractWritingStyle(posts: ScrapedItem[]): Promise<string> {
  const client = openai()
  const res = await client.chat.completions.create({
    model: llmModel(),
    max_tokens: 1800,
    messages: [
      { role: 'system', content: STYLE_SYSTEM },
      {
        role: 'user',
        content: `Analyze these ${posts.length} posts by the same author and produce the style guide.\n\n${buildCorpus(
          posts,
        )}`,
      },
    ],
  })
  const text = (res.choices[0]?.message?.content ?? '').trim()
  // Strip an accidental code fence if the model wraps the whole thing.
  return text.replace(/^```(?:markdown)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
}

/**
 * Resolve which skill the style should land in. Prefer an explicit slug; else
 * infer from the profile URL's platform (a linkedin.com URL → the *-linkedin-*
 * skill); else fall back to the only skill. Throws if it can't decide.
 */
async function resolveSkillSlug(
  accountId: string,
  profileUrl: string,
  explicit?: string,
): Promise<string> {
  const all = await listSkills(accountId)
  if (explicit) {
    if (!all.some((s) => s.slug === explicit)) {
      throw new Error(`No skill found with slug "${explicit}".`)
    }
    return explicit
  }
  if (all.length === 0) throw new Error('No skill exists yet to attach a style to.')
  if (all.length === 1) return all[0].slug

  const url = profileUrl.toLowerCase()
  const platforms = ['linkedin', 'twitter', 'x', 'instagram', 'threads', 'tiktok', 'youtube']
  const platform = platforms.find((p) => url.includes(`${p}.com`) || url.includes(`${p}.`))
  if (platform) {
    const match = all.find((s) => s.slug.includes(`-${platform}-`))
    if (match) return match.slug
  }
  throw new Error(
    `Multiple skills exist (${all
      .map((s) => s.slug)
      .join(', ')}). Pass skill_slug to say which one to update.`,
  )
}

/**
 * Scrape `profileUrl`, distill the writing style, and overwrite the skill's
 * voice-reference file. Returns a summary for the chat. `maxPosts` defaults to 25.
 */
export async function learnStyleFromProfile(
  accountId: string,
  profileUrl: string,
  opts: { skillSlug?: string; maxPosts?: number } = {},
): Promise<StyleLearnResult> {
  const slug = await resolveSkillSlug(accountId, profileUrl, opts.skillSlug)

  const scraped = await scrapeProfilePosts({ profileUrl, maxPosts: opts.maxPosts ?? 25 })
  const posts = scraped.filter((p) => (p.content ?? '').trim().length > 30).slice(0, 20)
  if (posts.length === 0) {
    throw new Error(
      'No readable posts found at that profile URL — check the link points to a public profile that has text posts.',
    )
  }

  const author = posts.find((p) => p.author)?.author ?? null
  const guide = await extractWritingStyle(posts)
  if (!guide || guide.length < 40) {
    throw new Error('Style extraction returned nothing usable — try again in a moment.')
  }

  const today = new Date().toISOString().slice(0, 10)
  const header = `# Voice reference

> Auto-extracted writing style. Source: ${profileUrl}${author ? ` (${author})` : ''}
> Captured ${today} from ${posts.length} posts. This file is OVERWRITTEN whenever the creator re-points their style at a new reference. It is the PRIMARY authority on voice, rhythm, formatting, and engagement tactics — match it when drafting. (Factual-honesty constraints in the constraints file still apply: never invent the creator's own customers or metrics.)

`
  const markdown = header + guide

  const res = await writeSkillFile(accountId, slug, VOICE_REFERENCE_PATH, markdown, 'agent')

  const summary = `Learned the writing style from ${profileUrl}${
    author ? ` (${author})` : ''
  } across ${posts.length} posts and saved it to ${slug}/${VOICE_REFERENCE_PATH}. Future drafts will match this voice.`

  return {
    slug,
    path: VOICE_REFERENCE_PATH,
    profileUrl,
    author,
    sampleCount: posts.length,
    markdown,
    summary,
    version: res.version,
  }
}
