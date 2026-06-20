import { openai, llmModelFast, llmMaxTokens } from './llm'
import type { WriteContentInput } from './tools'

/**
 * The "writer" half of the orchestrator/writer split. The agent loop runs on the
 * HEAVY model (glm-5.2) and does the thinking — reading the skill, choosing the
 * archetype/angle/format. The actual prose is delegated here to the FAST model
 * (gpt-oss:120b) via the write_content tool.
 *
 * The writer is deliberately context-free: it sees only the brief the orchestrator
 * assembles (voice, constraints, source material, etc.), never the skill files,
 * creator profile, or conversation. That keeps it cheap and focused on one job —
 * turning a complete brief into a publish-ready body — while the orchestrator
 * stays the single source of strategy and the only thing that reads/edits skills.
 */

const WRITER_SYSTEM = `You are an expert social-media copywriter. You write the BODY of ONE post — ready to publish, in the creator's voice. You are given a brief (what to say), the voice to match, hard constraints, and any source material. Follow ALL of them exactly. You do not plan, orchestrate, call tools, or explain — you output only the finished post body and nothing else.

PLAIN TEXT ONLY: the body is pasted directly into the platform composer (LinkedIn, X, Threads, Instagram…), which renders PLAIN TEXT, not Markdown. Use NO Markdown syntax — no **bold** or *italic* (the asterisks show up literally), no # headings, no -, * or 1. bullets, and no [text](url) links. Write any URL out in full. Use blank lines for spacing; only use plain characters like "•" or "→" if the voice calls for it.

NO STAGE DIRECTIONS: never include placeholders or art direction like "[image here]", "[insert chart]", or "[Before: screenshot]". Output only the words of the post.

HONESTY: never invent the creator's own customers, clients, metrics, or case studies. Use only the facts in the brief and source material. If a specific fact is missing, write around it — do not fabricate it.

Output the post body only. No preamble, no sign-off about what you did, no surrounding quotes.`

function buildWriterBrief(input: WriteContentInput): string {
  return [
    'Write the post now. Output ONLY the finished post body as plain text.',
    input.platform ? `Platform: ${input.platform}` : '',
    input.format ? `Format: ${input.format}` : '',
    input.archetype ? `Archetype / narrative angle: ${input.archetype}` : '',
    '',
    `WHAT THE POST MUST SAY:\n${input.brief}`,
    input.voice
      ? `\nVOICE — match this exactly (sentence rhythm, hook style, formatting, CTA pattern):\n${input.voice}`
      : '',
    input.constraints
      ? `\nHARD CONSTRAINTS — never violate any of these:\n${input.constraints}`
      : '',
    input.source_material
      ? `\nSOURCE MATERIAL — ground the post in these facts; add no facts beyond them:\n${input.source_material}`
      : '',
    input.notes ? `\nADDITIONAL NOTES / REVISIONS:\n${input.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Generate one post body on the fast/writer model. Streams each delta through
 * `emitText` (so the prose appears live in chat and lands in the persisted
 * transcript) and also returns the full text, so the orchestrator can review it
 * and pass it verbatim to save_post.
 */
export async function writeContentDraft(
  input: WriteContentInput,
  opts: { emitText?: (text: string) => void; signal?: AbortSignal } = {},
): Promise<string> {
  const client = openai()
  const stream = await client.chat.completions.create(
    {
      model: llmModelFast(),
      max_tokens: llmMaxTokens(),
      messages: [
        { role: 'system', content: WRITER_SYSTEM },
        { role: 'user', content: buildWriterBrief(input) },
      ],
      stream: true,
    },
    { signal: opts.signal },
  )

  let text = ''
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content
    if (delta) {
      text += delta
      opts.emitText?.(delta)
    }
  }
  return text.trim()
}
