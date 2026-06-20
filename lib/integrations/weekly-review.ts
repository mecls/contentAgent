import { runAgentLoop } from '@/lib/agent/agent-loop'
import { buildSkillsIndexNote } from '@/lib/skills/store'
import { createConversation, addMessage } from '@/lib/db/conversations'
import type { SyncResult } from '@/lib/integrations/sync-posts'

/**
 * The qualitative layer of the weekly run. Metrics were ALREADY written
 * deterministically by reconcileScrapedMetrics — here the agent only reasons
 * about the fresh numbers: it appends one-line lessons to the skill's
 * improvement log and writes a short summary into a dated conversation so the
 * weekly result shows up in the sidebar.
 *
 * Runs headless: runAgentLoop is called with no emit* callbacks (no SSE); we
 * persist the returned text ourselves.
 */
export async function runWeeklyReview(
  accountId: string,
  result: SyncResult,
): Promise<{ conversationId: string }> {
  const date = new Date().toISOString().slice(0, 10)
  const title = `Weekly analytics review — ${date}`
  const conversationId = await createConversation(accountId, title)

  const touched = [...result.created, ...result.updated]
  const lines = touched.map((d) => {
    const m = d.metrics
    return `- "${(d.hook ?? '').slice(0, 80)}" → reactions ${m.reactions ?? 0}, comments ${m.comments ?? 0}, reposts ${m.reposts ?? 0}${
      typeof m.impressions === 'number' ? `, impressions ${m.impressions}` : ' (impressions not provided)'
    }`
  })

  const prompt = [
    `This is the automated weekly analytics review for ${date}.`,
    '',
    `I have ALREADY synced this week's LinkedIn scrape into the Posts library (imported ${result.created.length} newly-seen post(s), refreshed metrics on ${result.updated.length}). Metrics are reactions, comments, reposts — impressions are private to me and are NOT included.`,
    '',
    touched.length > 0
      ? `Posts with fresh numbers this week:\n${lines.join('\n')}`
      : 'No posts had fresh engagement this week.',
    '',
    'Do this:',
    '1. Read the miguel-linkedin-content skill if you need its archetypes/constraints.',
    "2. For each post above, append ONE concise line to references/improvement-log.md via append_skill_file: the date, the post's apparent archetype, the reactions/comments numbers, and a one-line lesson. Do NOT invent impressions.",
    '3. Then give me a short written summary of how this week performed and any pattern worth noting.',
  ].join('\n')

  await addMessage(accountId, conversationId, {
    role: 'user',
    content: `Automated weekly analytics review for ${date} (${touched.length} post(s) with fresh numbers).`,
  })

  let skillsNote = ''
  try {
    skillsNote = await buildSkillsIndexNote(accountId)
  } catch {
    skillsNote = ''
  }

  const answer = await runAgentLoop({
    prompt,
    accountId,
    conversationId,
    systemNotes: skillsNote ? [skillsNote] : [],
  })

  await addMessage(accountId, conversationId, {
    role: 'assistant',
    content: answer || 'Weekly review completed.',
  })

  return { conversationId }
}
