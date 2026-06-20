import { runAgentLoop } from '@/lib/agent/agent-loop'
import { buildSkillsIndexNote } from '@/lib/skills/store'
import { buildProfileNote } from '@/lib/db/profile'
import { getIdea, setIdeaStatus } from '@/lib/db/ideas'

/**
 * Turn a selected idea into a saved draft. Runs the normal agent loop headless,
 * seeded with the idea and told to read the skill and call save_post — so the
 * draft is written through the exact skill-faithful path the chat agent uses. We
 * capture the post id from the save_post event the tool emits, then mark the idea
 * as written and linked.
 */
export async function writeIdeaToPost(
  accountId: string,
  ideaId: string,
): Promise<{ postId: string | null }> {
  const idea = await getIdea(accountId, ideaId)
  if (!idea) throw new Error('idea not found')

  const [skillsNote, profileNote] = await Promise.all([
    buildSkillsIndexNote(accountId).catch(() => ''),
    buildProfileNote(accountId).catch(() => ''),
  ])

  const prompt = [
    'Write a post from this idea. FIRST open the relevant skill (read_skill → read_skill_file for its constraints and archetypes), follow its voice and constraints exactly, THEN call save_post with the finished post (status "draft"). Show the post in your reply too.',
    '',
    `Topic: ${idea.topic}`,
    idea.angle ? `Angle: ${idea.angle}` : '',
    idea.structure ? `Suggested structure/archetype: ${idea.structure}` : '',
    idea.hook ? `Hook idea: ${idea.hook}` : '',
    idea.rationale ? `Why now: ${idea.rationale}` : '',
    idea.sources?.length ? `Source material: ${idea.sources.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  let postId: string | null = null
  await runAgentLoop({
    prompt,
    accountId,
    systemNotes: [skillsNote, profileNote].filter(Boolean),
    emitEvent: (event) => {
      const post = (event as { post?: { id?: string } }).post
      if (post?.id) postId = post.id
    },
  })

  await setIdeaStatus(accountId, ideaId, 'written', postId)
  return { postId }
}
