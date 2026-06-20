import { runAgentLoop } from '@/lib/agent/agent-loop'
import { buildSkillsIndexNote } from '@/lib/skills/store'
import { buildProfileNote } from '@/lib/db/profile'
import { getIdea, setIdeaStatus, type IdeaRow } from '@/lib/db/ideas'
import { createPost } from '@/lib/db/posts'
import type { DraftPreview } from '@/lib/agent/draft-preview'

/**
 * Turn a selected idea into a post draft. Generation always runs the normal agent
 * loop headless — seeded with the idea and told to read the skill and call
 * save_post — so the draft is written through the exact skill-faithful path the
 * chat agent uses.
 *
 * Two entry points:
 *  - previewIdeaPost(): generates in DRY-RUN mode (nothing is persisted) and
 *    returns the full draft for the user to review before committing.
 *  - writeIdeaToPost(): generates AND saves in one step (legacy direct path).
 * Once a preview is approved, saveIdeaDraft() persists that exact text.
 */

function buildIdeaPrompt(idea: IdeaRow): string {
  return [
    'Write a post from this idea. FIRST open the relevant skill (read_skill → read_skill_file for its constraints and archetypes), THEN produce the post body with the write_content tool (pass it the skill\'s voice and constraints — it cannot read the skill itself), and finally call save_post with the returned body verbatim (status "draft").',
    '',
    `Topic: ${idea.topic}`,
    idea.angle ? `Angle: ${idea.angle}` : '',
    idea.structure ? `Suggested structure/archetype: ${idea.structure}` : '',
    idea.format ? `Format: ${idea.format} — write the post in this structural format and pass this exact value to save_post's "format" field.` : '',
    idea.hook ? `Hook idea: ${idea.hook}` : '',
    idea.rationale ? `Why now: ${idea.rationale}` : '',
    idea.sources?.length ? `Source material: ${idea.sources.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

async function buildIdeaNotes(accountId: string): Promise<string[]> {
  const [skillsNote, profileNote] = await Promise.all([
    buildSkillsIndexNote(accountId).catch(() => ''),
    buildProfileNote(accountId).catch(() => ''),
  ])
  return [skillsNote, profileNote].filter(Boolean)
}

/**
 * Generate a draft for review WITHOUT saving it. Runs the agent loop in dry-run
 * mode so save_post surfaces the full draft (via a postPreview event) instead of
 * persisting. The idea status is left untouched. Returns null if no draft was
 * produced.
 */
export async function previewIdeaPost(
  accountId: string,
  ideaId: string,
): Promise<DraftPreview | null> {
  const idea = await getIdea(accountId, ideaId)
  if (!idea) throw new Error('idea not found')

  let preview: DraftPreview | null = null
  await runAgentLoop({
    prompt: buildIdeaPrompt(idea),
    accountId,
    systemNotes: await buildIdeaNotes(accountId),
    dryRun: true,
    emitEvent: (event) => {
      const p = (event as { postPreview?: DraftPreview }).postPreview
      if (p?.body) preview = p
    },
  })
  return preview
}

/** Persist a reviewed draft to the Posts library and mark its idea written. */
export async function saveIdeaDraft(
  accountId: string,
  ideaId: string,
  draft: DraftPreview,
): Promise<{ postId: string }> {
  const postId = await createPost(accountId, {
    body: draft.body,
    hook: draft.hook ?? null,
    archetype: draft.archetype ?? null,
    format: draft.format ?? null,
    skill_slug: draft.skill_slug ?? null,
    status: 'draft',
    source: 'agent',
  })
  await setIdeaStatus(accountId, ideaId, 'written', postId)
  return { postId }
}

/**
 * Generate a draft and save it in one step. We capture the post id from the
 * save_post event the tool emits, then mark the idea as written and linked.
 */
export async function writeIdeaToPost(
  accountId: string,
  ideaId: string,
): Promise<{ postId: string | null }> {
  const idea = await getIdea(accountId, ideaId)
  if (!idea) throw new Error('idea not found')

  let postId: string | null = null
  await runAgentLoop({
    prompt: buildIdeaPrompt(idea),
    accountId,
    systemNotes: await buildIdeaNotes(accountId),
    emitEvent: (event) => {
      const post = (event as { post?: { id?: string } }).post
      if (post?.id) postId = post.id
    },
  })

  await setIdeaStatus(accountId, ideaId, 'written', postId)
  return { postId }
}
