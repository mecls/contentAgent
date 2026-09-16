import { getConfig } from '@/lib/db/config'
import { listSkills, readSkill } from '@/lib/skills/store'
import { listDailyResearch, type ResearchRow } from '@/lib/db/research'
import { listPosts } from '@/lib/db/posts'
import { getFunnelMix } from '@/lib/db/profile'
import {
  MIX_WINDOW_POSTS,
  recentStageCounts,
  type FunnelStage,
  type StageCounts,
  type StageMixTarget,
} from '@/lib/funnel/stages'
import type { ChooseBatch } from '@/lib/choose/batch'

/**
 * Inputs for the Choose screen. Reads only — nothing here calls a model, so the
 * page can use it on every load.
 */

export const BATCH_KEY = 'choose_batch'
export const GENERATING_KEY = 'choose_generating'
export const GENERATION_LOCK_MS = 120_000

export interface RecentPost {
  hook: string | null
  archetype: string | null
  funnel_stage: FunnelStage | null
  status: string
  posted_at: string | null
}

/** The account's LinkedIn skill, else its first skill, else null. */
export async function pickSkill(accountId: string): Promise<string | null> {
  const skills = await listSkills(accountId)
  return (skills.find((s) => s.slug.endsWith('-linkedin-content')) ?? skills[0])?.slug ?? null
}

function asBatch(value: unknown): ChooseBatch | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Partial<ChooseBatch>
  return typeof candidate.id === 'string' && Array.isArray(candidate.angles) ? (candidate as ChooseBatch) : null
}

export async function getCurrentBatch(accountId: string): Promise<ChooseBatch | null> {
  return asBatch(await getConfig(accountId, BATCH_KEY))
}

/** True while a generation for this account started less than 120 seconds ago. */
export async function isGenerating(accountId: string): Promise<boolean> {
  const value = (await getConfig(accountId, GENERATING_KEY)) as { started_at?: string } | null
  const started = value?.started_at ? Date.parse(value.started_at) : Number.NaN
  return Number.isFinite(started) && Date.now() - started < GENERATION_LOCK_MS
}

export interface ChooseState {
  batch: ChooseBatch | null
  generating: boolean
  skillSlug: string | null
  researchCount: number
}

export async function loadChooseState(accountId: string): Promise<ChooseState> {
  const [batch, generating, skillSlug, research] = await Promise.all([
    getCurrentBatch(accountId),
    isGenerating(accountId),
    pickSkill(accountId),
    listDailyResearch(accountId),
  ])
  return { batch, generating, skillSlug, researchCount: research.length }
}

export interface GenerationInputs {
  skillMd: string
  research: ResearchRow[]
  posts: RecentPost[]
  current: ChooseBatch | null
  /** The account's target funnel mix, defaulting to 60/30/10. */
  mix: StageMixTarget
  /** What the recent window already holds, so the next batch can correct it. */
  recentCounts: StageCounts
}

export async function loadGenerationInputs(accountId: string, slug: string): Promise<GenerationInputs> {
  const [skill, research, posts, current, mix] = await Promise.all([
    readSkill(accountId, slug),
    listDailyResearch(accountId),
    listPosts(accountId),
    getCurrentBatch(accountId),
    getFunnelMix(accountId),
  ])
  return {
    skillMd: skill.skill_md,
    research,
    // listPosts is newest first.
    posts: posts.slice(0, 10).map((p) => ({
      hook: p.hook,
      archetype: p.archetype,
      funnel_stage: p.funnel_stage,
      status: p.status,
      posted_at: p.posted_at,
    })),
    current,
    mix,
    // Counted over the newest classified posts only — posts written before the funnel
    // existed say nothing about the current balance.
    recentCounts: recentStageCounts(posts, { limit: MIX_WINDOW_POSTS }),
  }
}
