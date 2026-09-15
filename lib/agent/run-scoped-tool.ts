import {
  ListSkillsInput,
  ReadSkillInput,
  WriteContentInput,
  SavePostInput,
  ListPostsInput,
  GetPostInput,
  GetTagPerformanceInput,
  UpdatePostMetricsInput,
  ListResearchInput,
  SearchNewsInput,
  ListCompetitorInsightsInput,
  RunResearchInput,
  AnalyzeFormatTrendsInput,
  GetFormatPerformanceInput,
  ReconcileAnalyticsInput,
  SetPostUrlInput,
} from './tools'
import * as skills from '@/lib/skills/store'
import * as posts from '@/lib/db/posts'
import { DEFAULT_PLATFORM, normalizeFormatKey } from '@/lib/formats/catalog'
import { reconcileScrapedMetrics } from '@/lib/integrations/reconcile'
import { listDailyResearch, upsertResearchItems } from '@/lib/db/research'
import { exaSearch } from '@/lib/integrations/exa'
import { listCompetitorPosts } from '@/lib/db/competitors'
import { runResearchIfStale } from '@/lib/integrations/run-research'
import { analyzeFormatTrends } from '@/lib/integrations/analyze-formats'
import { writeContentDraft } from './write-content'
import {
  findUnsourcedDetails,
  decideAfterReview,
  tagsWithNeedsCheck,
  quoteList,
  NEEDS_CHECK_TAG,
  type UnsupportedDetail,
} from './sourced-details'
import { reviewDetails } from './review-details'

/**
 * UI side-channel. Tools return a JSON result to the MODEL, but some actions also
 * deserve a first-class card in the chat (a saved post, research items). Those
 * are pushed through `emit` and rendered inline — separate from the model's text.
 */
export interface ToolContext {
  accountId: string
  conversationId?: string | null
  emit?: (event: Record<string, unknown>) => void
  /**
   * Streams plain assistant text (used by write_content to surface the writer
   * model's prose live, and to fold it into the persisted transcript). Distinct
   * from `emit`, which carries structured UI events.
   */
  emitText?: (text: string) => void
  /**
   * Text from real sources seen this run (the creator's messages, skill, research and
   * analytics results). When set, save_post refuses a body with a detail not in it.
   */
  evidence?: string[]
  /** save_post's model-review refusals so far this run (shared and mutable). */
  reviewRefusals?: { count: number }
  /** Aborts in-flight model calls inside a tool when the client disconnects. */
  signal?: AbortSignal
}

/**
 * Execute a tool call, scoped to a SERVER-DERIVED accountId. The model fills the
 * params; this code Zod-validates them and runs the (always account-filtered)
 * operation. The account id is injected here and is impossible for the model to
 * override — the core tenancy guarantee.
 */
export async function runScopedTool(
  name: string,
  rawInput: unknown,
  ctx: ToolContext,
): Promise<unknown> {
  const { accountId } = ctx

  switch (name) {
    // ── skill reads ──
    case 'list_skills': {
      ListSkillsInput.parse(rawInput ?? {})
      return skills.listSkills(accountId)
    }
    case 'read_skill': {
      const input = ReadSkillInput.parse(rawInput)
      return skills.readSkill(accountId, input.slug)
    }

    // ── content writing (delegated to the fast/writer model) ──
    case 'write_content': {
      const input = WriteContentInput.parse(rawInput)
      const body = await writeContentDraft(input, {
        emitText: ctx.emitText,
        signal: ctx.signal,
      })
      // Return the full draft so the orchestrator can review it and pass it to
      // save_post. The prose itself was already streamed to the user via emitText.
      return { body }
    }

    // ── posts ──
    case 'save_post': {
      const input = SavePostInput.parse(rawInput)
      // Real stories only, enforced: a number, amount, duration, clock time or weekday
      // must come from something loaded this run, or the post isn't saved; then a
      // model review looks for invented moments (below).
      let needsCheck: { unsupported: UnsupportedDetail[]; reviewed: boolean } | null = null
      if (ctx.evidence) {
        const unsourced = findUnsourcedDetails(input.body, ctx.evidence)
        if (unsourced.length > 0) {
          return {
            saved: false,
            unsourced,
            error: `Not saved: these details don't appear in the skill, the research or search results loaded in this chat, or the creator's messages: ${unsourced.join(', ')}. Remove each one or make its line general (call write_content again with the fix in notes), then save again. If a detail is real, load its source first (read_skill, list_research or search_news) or ask the creator.`,
          }
        }
        // Then a model review for what the pattern check can't see: invented moments with
        // no number or day. It refuses once; if the rewrite is still flagged (or the
        // review fails twice) the post is saved tagged NEEDS_CHECK_TAG instead, so an
        // over-strict review never loses a draft, and the creator is shown the lines.
        const review = await reviewDetails(input.body, ctx.evidence)
        const refusals = ctx.reviewRefusals ?? { count: 0 }
        const decision = decideAfterReview(review, refusals.count)
        if (decision === 'refuse') {
          refusals.count++
          if (!review.ok) {
            return { saved: false, error: "Not saved: the detail review couldn't run. Call save_post again with the same body." }
          }
          return {
            saved: false,
            unsupported: review.unsupported,
            error: `Not saved: the detail review found moments the sources loaded in this chat don't support: ${quoteList(review.unsupported)}. Rewrite each as a plain general statement or cut it (call write_content again with the fix in notes), then save again. If one is real, ask the creator to confirm it. If the review still flags lines on the next save, the post is saved tagged ${NEEDS_CHECK_TAG} and you must show the creator those lines.`,
          }
        }
        if (decision === 'save-flagged') {
          needsCheck = review.ok ? { unsupported: review.unsupported, reviewed: true } : { unsupported: [], reviewed: false }
        }
      }
      // Pin format to a canonical catalog key when it matches; else keep a
      // lowercased fallback so the value still groups in formatPerformance.
      const format = input.format
        ? (normalizeFormatKey(DEFAULT_PLATFORM, input.format) ?? input.format.trim().toLowerCase())
        : null
      const id = await posts.createPost(accountId, {
        body: input.body,
        hook: input.hook ?? null,
        archetype: input.archetype ?? null,
        format,
        status: input.status ?? 'draft',
        skill_slug: input.skill_slug ?? null,
        conversation_id: ctx.conversationId ?? null,
        source: 'agent',
        tags: needsCheck ? tagsWithNeedsCheck(input.tags) : input.tags,
      })
      ctx.emit?.({ post: { id, hook: input.hook ?? input.body.slice(0, 80) } })
      if (needsCheck) {
        return {
          id,
          saved: true,
          needs_fact_check: needsCheck.unsupported,
          note: needsCheck.reviewed
            ? `Saved as a draft tagged ${NEEDS_CHECK_TAG}: the detail review still flags ${quoteList(needsCheck.unsupported)}. Show the creator these exact lines and tell them to verify or cut each one before posting.`
            : `Saved as a draft tagged ${NEEDS_CHECK_TAG}: the detail review couldn't run, so its moments and details are unchecked. Tell the creator to check them before posting.`,
        }
      }
      return { id, saved: true }
    }
    case 'list_posts': {
      ListPostsInput.parse(rawInput ?? {})
      const all = await posts.listPosts(accountId)
      // Lightweight projection — keep the model's context small.
      return all.map((p) => ({
        id: p.id,
        hook: p.hook,
        archetype: p.archetype,
        format: p.format,
        status: p.status,
        metrics: p.metrics,
        tags: p.tags,
        created_at: p.created_at,
      }))
    }
    case 'get_post': {
      const input = GetPostInput.parse(rawInput)
      return posts.getPost(accountId, input.id)
    }
    case 'get_tag_performance': {
      GetTagPerformanceInput.parse(rawInput ?? {})
      return posts.tagPerformance(accountId)
    }
    case 'update_post_metrics': {
      const input = UpdatePostMetricsInput.parse(rawInput)
      await posts.updatePostMetrics(accountId, input.id, {
        impressions: input.impressions,
        reactions: input.reactions,
        comments: input.comments,
        engagement_rate: input.engagement_rate,
      })
      return { id: input.id, updated: true }
    }

    // ── research & competitor insights ──
    case 'list_research': {
      ListResearchInput.parse(rawInput ?? {})
      const items = await listDailyResearch(accountId)
      // Render the top items as inline cards (with a "Draft post" action) for the user.
      ctx.emit?.({
        researchItems: items.slice(0, 8).map((r) => ({
          id: r.id,
          source: r.source,
          title: r.title,
          url: r.url,
          summary: r.summary,
          topic: r.topic,
          key_points: r.key_points,
        })),
      })
      // Lean projection for the model.
      return items.slice(0, 12).map((r) => ({
        id: r.id,
        source: r.source,
        title: r.title,
        summary: r.summary,
        url: r.url,
        topic: r.topic,
      }))
    }
    case 'search_news': {
      const input = SearchNewsInput.parse(rawInput)
      // News-first for recency; fall back to general web if news returns nothing.
      let found = await exaSearch({ query: input.query, numResults: 8, category: 'news' })
      if (found.length === 0) {
        found = await exaSearch({ query: input.query, numResults: 8 })
      }
      if (found.length === 0) {
        return { found: 0, query: input.query }
      }
      // Persist to the research archive as 'chat' (best-effort — a DB hiccup must not
      // abort the draft the creator is waiting on). The Research page shows these;
      // Choose and list_research don't, so one post's searches can't steer them.
      try {
        await upsertResearchItems(accountId, found, 'chat')
      } catch (e) {
        console.error('[search_news] persist failed', e)
      }
      // Render the top results as inline cards (reusing the research-card event).
      ctx.emit?.({
        researchItems: found.slice(0, 6).map((r) => ({
          id: r.url,
          source: r.source,
          title: r.title,
          url: r.url,
          summary: r.summary,
          topic: r.topic,
          key_points: [] as string[],
        })),
      })
      // Lean projection for the model — include published_at so it can pick the
      // freshest item to ground the post in.
      return {
        query: input.query,
        found: found.length,
        items: found.slice(0, 8).map((r) => ({
          source: r.source,
          title: r.title,
          url: r.url,
          summary: r.summary,
          published_at: r.published_at,
        })),
      }
    }
    case 'list_competitor_insights': {
      ListCompetitorInsightsInput.parse(rawInput ?? {})
      const items = await listCompetitorPosts(accountId, { limit: 24 })
      return items.map((c) => ({
        features: c.features,
        metrics: c.metrics,
        source_url: c.source_url,
      }))
    }
    case 'run_research': {
      RunResearchInput.parse(rawInput ?? {})
      const res = await runResearchIfStale(accountId)
      ctx.emit?.({ research: { reused: res.reused, stored: res.stored } })
      return res
    }

    // ── format analysis ──
    case 'analyze_format_trends': {
      const input = AnalyzeFormatTrendsInput.parse(rawInput ?? {})
      return analyzeFormatTrends(accountId, input.platform ?? DEFAULT_PLATFORM)
    }
    case 'get_format_performance': {
      GetFormatPerformanceInput.parse(rawInput ?? {})
      return posts.formatPerformance(accountId)
    }

    // ── analytics (LinkedIn scrape) ──
    case 'reconcile_analytics': {
      ReconcileAnalyticsInput.parse(rawInput ?? {})
      const result = await reconcileScrapedMetrics(accountId)
      // Lightweight projection — keep the model's context small.
      return {
        updated: result.updated.map((d) => ({
          postId: d.postId,
          hook: d.hook,
          reactions: d.after.reactions,
          comments: d.after.comments,
          reposts: d.after.reposts,
          impressions: d.after.impressions ?? null,
        })),
        unmatchedUrls: result.unmatchedUrls,
      }
    }
    case 'set_post_url': {
      const input = SetPostUrlInput.parse(rawInput)
      await posts.updatePost(accountId, input.post_id, {
        linkedin_url: input.linkedin_url,
      })
      return { id: input.post_id, linkedin_url: input.linkedin_url, updated: true }
    }

    default:
      throw new Error(`unknown tool: ${name}`)
  }
}
