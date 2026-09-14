import type OpenAI from 'openai'
import { z } from 'zod'

/**
 * Tool surface for the content agent. Skill tools are READ-ONLY: the agent loads
 * a skill's single SKILL.md and has no way to change it (only the owner edits
 * skills, on the Skills page). Post tools persist and revisit generated posts.
 *
 * Each tool has a Zod schema (validated at execution) and an OpenAI function def
 * (sent to the model). Keep schemas small and explicit — open-weight models call
 * tools more reliably with tight, well-described parameters.
 */

// ── skill: reads ───────────────────────────────────────────────────────────────
export const ListSkillsInput = z.object({})

export const ReadSkillInput = z.object({
  slug: z.string().min(1),
})
export type ReadSkillInput = z.infer<typeof ReadSkillInput>

// ── content writing (delegated to the fast/writer model) ─────────────────────────
export const WriteContentInput = z.object({
  brief: z.string().min(1),
  platform: z.string().optional(),
  archetype: z.string().optional(),
  format: z.string().optional(),
  voice: z.string().optional(),
  constraints: z.string().optional(),
  source_material: z.string().optional(),
  notes: z.string().optional(),
})
export type WriteContentInput = z.infer<typeof WriteContentInput>

// ── posts ──────────────────────────────────────────────────────────────────────
export const SavePostInput = z.object({
  body: z.string().min(1),
  hook: z.string().optional(),
  archetype: z.string().optional(),
  format: z.string().optional(),
  status: z.enum(['draft', 'approved', 'posted']).optional(),
  skill_slug: z.string().optional(),
  tags: z.array(z.string()).optional(),
})
export type SavePostInput = z.infer<typeof SavePostInput>

export const ListPostsInput = z.object({})

export const GetTagPerformanceInput = z.object({})

export const GetPostInput = z.object({ id: z.string().min(1) })
export type GetPostInput = z.infer<typeof GetPostInput>

export const UpdatePostMetricsInput = z.object({
  id: z.string().min(1),
  impressions: z.number().optional(),
  reactions: z.number().optional(),
  comments: z.number().optional(),
  engagement_rate: z.number().optional(),
})
export type UpdatePostMetricsInput = z.infer<typeof UpdatePostMetricsInput>

// ── research & competitor insights ───────────────────────────────────────────
export const ListResearchInput = z.object({})
export const SearchNewsInput = z.object({ query: z.string().min(1) })
export type SearchNewsInput = z.infer<typeof SearchNewsInput>
export const ListCompetitorInsightsInput = z.object({})
export const RunResearchInput = z.object({})

// ── format analysis ──────────────────────────────────────────────────────────
export const AnalyzeFormatTrendsInput = z.object({
  platform: z.string().optional(),
})
export type AnalyzeFormatTrendsInput = z.infer<typeof AnalyzeFormatTrendsInput>

export const GetFormatPerformanceInput = z.object({})

// ── analytics (LinkedIn scrape) ──────────────────────────────────────────────
export const ReconcileAnalyticsInput = z.object({})

export const SetPostUrlInput = z.object({
  post_id: z.string().min(1),
  linkedin_url: z.string().min(1),
})
export type SetPostUrlInput = z.infer<typeof SetPostUrlInput>

// ── OpenAI tool definitions ─────────────────────────────────────────────────────
export const CONTENT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_skills',
      description:
        'List the available content skills (slug + description). Call this first if you are unsure which skill applies.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_skill',
      description:
        "Open a skill: returns its SKILL.md — the single source of truth for voice, constraints, archetypes and cadence. A skill has no other files. ALWAYS read the relevant skill before writing or critiquing content.",
      parameters: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'The skill slug, e.g. "alex-linkedin-content".' },
        },
        required: ['slug'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_content',
      description:
        "Generate the actual POST BODY. YOU orchestrate; THIS tool writes — never write a post body yourself, always produce prose through here. Call it only AFTER you've read the skill's SKILL.md and decided the angle, archetype, and format. The writer model has NO access to the skill, the creator profile, the research, or this conversation, so you MUST pass everything it needs in the parameters — a vague brief yields a generic post. It returns the finished plain-text body, which is ALREADY shown to the creator (do not paste it again). Then review it against the constraints and call save_post with that body verbatim (only fix a real violation). For revisions the creator asks for, call write_content again with the change in `notes`.",
      parameters: {
        type: 'object',
        properties: {
          brief: {
            type: 'string',
            description:
              'What the post must say: the core message, angle, key points, and any structure to follow. Be specific and complete — this is the writer\'s only source of intent.',
          },
          platform: { type: 'string', description: "Platform, e.g. 'linkedin', 'x'." },
          archetype: {
            type: 'string',
            description: 'The narrative archetype from the skill the post should follow.',
          },
          format: {
            type: 'string',
            description: "Structural format, e.g. 'text-short', 'text-long', 'carousel', 'poll'.",
          },
          voice: {
            type: 'string',
            description:
              'The voice to match, distilled from SKILL.md: sentence rhythm, hook style, formatting, CTA pattern. Quote the concrete rules — the writer cannot read the skill.',
          },
          constraints: {
            type: 'string',
            description:
              'The hard constraints the writer must not violate, from SKILL.md (honesty rules, banned words, length limits).',
          },
          source_material: {
            type: 'string',
            description:
              "The only real stories, events, facts and concrete details the post may use. Each must come from SKILL.md, a cited source, or the creator's own words in this chat. Never pass an invented or illustrative story, scenario or detail — including 'you' scenarios with unit numbers, incidents or dollar amounts.",
          },
          notes: {
            type: 'string',
            description:
              'Extra instructions, or revision feedback when regenerating an earlier draft (e.g. "punchier hook", "drop the emoji").',
          },
        },
        required: ['brief'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_post',
      description:
        "Save a finished post so it appears in the user's Posts library. Call this whenever you produce a post the user might publish. `body` is the full post text exactly as it should be published; `hook` is the opening line; `archetype` is which skill archetype it follows (if any). `tags` are 2-5 short lowercase keyword tags describing the post's topic and style (e.g. [\"ai\",\"hiring\",\"contrarian\"]) — REUSE the keywords from the EXISTING POST TAGS note when one fits, so engagement stays comparable across posts.",
      parameters: {
        type: 'object',
        properties: {
          body: { type: 'string', description: 'The full post text, ready to publish.' },
          hook: { type: 'string', description: 'The opening line / hook.' },
          archetype: { type: 'string', description: 'Archetype name from the skill, if applicable.' },
          format: {
            type: 'string',
            description:
              "The post's structural format key (e.g. 'carousel', 'text-short', 'text-long', 'poll', 'image-text'). Set this whenever the post follows a specific format, so format performance stays comparable.",
          },
          status: { type: 'string', enum: ['draft', 'approved', 'posted'] },
          skill_slug: { type: 'string', description: 'The skill used to write it.' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description:
              '2-5 lowercase keyword tags (topic + style). Reuse existing tags when they fit; only coin a new one when none apply.',
          },
        },
        required: ['body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_posts',
      description:
        'List the user\'s saved posts (id, hook, archetype, status, metrics). Use when analyzing past performance.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_post',
      description: 'Get the full text + metrics of one saved post by id.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_post_metrics',
      description:
        'Record real performance for a saved post (impressions, reactions, comments, engagement_rate).',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          impressions: { type: 'number' },
          reactions: { type: 'number' },
          comments: { type: 'number' },
          engagement_rate: { type: 'number' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_tag_performance',
      description:
        'Compare engagement across post tags — returns, per tag, the post count and average reactions, comments, and engagement rate (averaged only over posts with that metric). Use this to see which topics/styles perform best before recommending what to write.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_research',
      description:
        "List recent research the system gathered about the creator's topics (top web/blog, Hacker News, and LinkedIn items, each with a short summary, source, and URL). Use it to ground a post in something timely or factual — what to talk about. The skill and creator profile still govern voice and constraints.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_news',
      description:
        "Do a FRESH, on-demand web/news search for a specific keyword or subject and get back the latest articles (title, url, summary, published date). Call this when the creator names a concrete, timely, searchable subject — a product, company, person, tool, or news event (e.g. 'write a post about Cursor', 'a post about the new Claude API'). After it returns, pick the most relevant and RECENT result (use published_at), read the skill, and draft the post grounded in that article, then save_post. The found articles also render as cards for the creator. For generic/evergreen topics with no specific searchable angle (e.g. 'a post about delegation'), do NOT call this — just draft from the skill.",
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              "The keyword/subject to search for (e.g. 'Cursor', 'OpenAI new model', 'AI coding agents'). Keep it focused on the entity the creator named.",
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_competitor_insights',
      description:
        "List patterns extracted from competitor LinkedIn posts (hook, tone, structure, topic, CTA, voice, why it worked, plus engagement). Use it to borrow STRUCTURE/format that performs — never copy their claims or voice. The creator's own skill is the source of truth for voice.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_research',
      description:
        "Pull FRESH research on the creator's topics (web/blogs via Exa + Reddit/X/LinkedIn). It automatically reuses research from the last 24h instead of re-fetching, so it's cheap to call. Call it at the START of planning a week of content, or when the creator wants up-to-date angles. Afterwards, use list_research to read the items.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_format_trends',
      description:
        "Show which structural FORMATS (carousel, short text, poll, video…) are working RIGHT NOW on a platform — aggregated from competitor posts and ranked by recent engagement, each with a rising/steady/falling direction and its share of recent posts. 'Format' is the post's container, distinct from its topic (tags) and narrative archetype. Grounded in real scraped engagement, not opinion. Use when planning content or when the creator asks what formats/styles are trending. Defaults to LinkedIn.",
      parameters: {
        type: 'object',
        properties: {
          platform: {
            type: 'string',
            description: "Platform id (e.g. 'linkedin', 'x', 'instagram'). Defaults to linkedin.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_format_performance',
      description:
        "Compare the creator's OWN engagement across the formats they've used — per format, the post count and average reactions/comments/engagement rate. Use it to see which formats THIS creator personally wins at (analyze_format_trends is competitors; this is them). Only posts that have a saved format are counted.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reconcile_analytics',
      description:
        "Pull this week's scraped LinkedIn engagement onto the creator's saved posts. Matches each scraped post to a saved post by LinkedIn URL and writes reactions/comments/reposts (NOT impressions — those stay manual). Returns what was updated, plus any scraped posts that have no matching saved post (their LinkedIn URL needs attaching via set_post_url). Call this when the creator asks to update/refresh their analytics.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_post_url',
      description:
        "Attach the published LinkedIn URL to one of the creator's saved posts, so future weekly scrapes can match it and update its real engagement. Use when the creator gives you the URL of a post they published.",
      parameters: {
        type: 'object',
        properties: {
          post_id: { type: 'string', description: 'The saved post id.' },
          linkedin_url: { type: 'string', description: 'The full LinkedIn post URL.' },
        },
        required: ['post_id', 'linkedin_url'],
      },
    },
  },
]
