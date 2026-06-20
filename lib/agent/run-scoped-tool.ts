import {
  ListSkillsInput,
  ReadSkillInput,
  ReadSkillFileInput,
  AppendSkillFileInput,
  ProposeOverwriteInput,
  CreateSkillFileInput,
  CreateSkillInput,
  SavePostInput,
  ListPostsInput,
  GetPostInput,
  GetTagPerformanceInput,
  UpdatePostMetricsInput,
  ListResearchInput,
  SearchNewsInput,
  ListIdeasInput,
  ListCompetitorInsightsInput,
  RunResearchInput,
  GenerateIdeasInput,
  LearnWritingStyleInput,
  ReconcileAnalyticsInput,
  SetPostUrlInput,
} from './tools'
import * as skills from '@/lib/skills/store'
import * as posts from '@/lib/db/posts'
import { reconcileScrapedMetrics } from '@/lib/integrations/reconcile'
import { listResearchItems, upsertResearchItems } from '@/lib/db/research'
import { exaSearch } from '@/lib/integrations/exa'
import { listIdeas } from '@/lib/db/ideas'
import { listCompetitorPosts } from '@/lib/db/competitors'
import { runResearchIfStale } from '@/lib/integrations/run-research'
import { generateIdeasForAccount } from '@/lib/integrations/run-ideas'
import { learnStyleFromProfile } from '@/lib/integrations/learn-style'

/**
 * UI side-channel. Tools return a JSON result to the MODEL, but some actions also
 * deserve a first-class card in the chat (a saved post, a pending skill-edit
 * proposal). Those are pushed through `emit` and rendered inline — separate from
 * the model's text.
 */
export interface ToolContext {
  accountId: string
  conversationId?: string | null
  emit?: (event: Record<string, unknown>) => void
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
    case 'read_skill_file': {
      const input = ReadSkillFileInput.parse(rawInput)
      const content = await skills.readSkillFile(accountId, input.slug, input.path)
      return { path: input.path, content }
    }

    // ── skill writes ──
    case 'append_skill_file': {
      const input = AppendSkillFileInput.parse(rawInput)
      const res = await skills.appendSkillFile(
        accountId,
        input.slug,
        input.path,
        input.content,
      )
      ctx.emit?.({ skillUpdate: { slug: input.slug, path: input.path, kind: 'append' } })
      return res
    }
    case 'propose_skill_overwrite': {
      const input = ProposeOverwriteInput.parse(rawInput)
      const res = await skills.proposeOverwrite(
        accountId,
        input.slug,
        input.path,
        input.content,
        input.rationale,
      )
      if ('proposed' in res) {
        ctx.emit?.({
          proposal: {
            id: res.proposalId,
            slug: input.slug,
            path: input.path,
            rationale: input.rationale,
          },
        })
      } else {
        ctx.emit?.({ skillUpdate: { slug: input.slug, path: input.path, kind: 'overwrite' } })
      }
      return res
    }
    case 'create_skill_file': {
      const input = CreateSkillFileInput.parse(rawInput)
      const res = await skills.createSkillFile(
        accountId,
        input.slug,
        input.path,
        input.content,
      )
      ctx.emit?.({ skillUpdate: { slug: input.slug, path: input.path, kind: 'create' } })
      return res
    }
    case 'create_skill': {
      const input = CreateSkillInput.parse(rawInput)
      return skills.createSkill(accountId, input.slug, input.name, input.description)
    }

    // ── posts ──
    case 'save_post': {
      const input = SavePostInput.parse(rawInput)
      const id = await posts.createPost(accountId, {
        body: input.body,
        hook: input.hook ?? null,
        archetype: input.archetype ?? null,
        status: input.status ?? 'draft',
        skill_slug: input.skill_slug ?? null,
        conversation_id: ctx.conversationId ?? null,
        source: 'agent',
        tags: input.tags,
      })
      ctx.emit?.({ post: { id, hook: input.hook ?? input.body.slice(0, 80) } })
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
      const items = await listResearchItems(accountId, { limit: 20, sinceDays: 7 })
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
      // Persist to the research archive (best-effort — a DB hiccup must not abort
      // the draft the creator is waiting on).
      try {
        await upsertResearchItems(accountId, found)
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
    case 'list_ideas': {
      ListIdeasInput.parse(rawInput ?? {})
      const ideas = await listIdeas(accountId, 'pending')
      ctx.emit?.({
        ideaItems: ideas.map((i) => ({
          id: i.id,
          topic: i.topic,
          angle: i.angle,
          hook: i.hook,
          structure: i.structure,
        })),
      })
      return ideas.map((i) => ({
        topic: i.topic,
        angle: i.angle,
        hook: i.hook,
        structure: i.structure,
      }))
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
    case 'generate_ideas': {
      const input = GenerateIdeasInput.parse(rawInput ?? {})
      const { created, ideas } = await generateIdeasForAccount(accountId, input.count ?? 4)
      ctx.emit?.({ ideas: { created } })
      // Return the ideas (no IDs needed to draft) so the model can act on them.
      return {
        created,
        ideas: ideas.map((i) => ({
          topic: i.topic,
          angle: i.angle ?? null,
          structure: i.structure ?? null,
          hook: i.hook ?? null,
        })),
      }
    }

    case 'learn_writing_style': {
      const input = LearnWritingStyleInput.parse(rawInput)
      const res = await learnStyleFromProfile(accountId, input.profile_url, {
        skillSlug: input.skill_slug,
      })
      // Surface the skill-file write as a card, like other skill updates.
      ctx.emit?.({ skillUpdate: { slug: res.slug, path: res.path, kind: 'overwrite' } })
      return {
        learned: true,
        slug: res.slug,
        path: res.path,
        author: res.author,
        sampleCount: res.sampleCount,
        style: res.markdown,
        summary: res.summary,
      }
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
