import { promises as fs } from 'node:fs'
import path from 'node:path'
import { openai, llmModel } from '@/lib/agent/llm'
import { listSkills, createSkill, createSkillFile } from '@/lib/skills/store'
import { platformLabel, skillSlug, slugifyUsername, type OnboardingProfile } from '@/lib/onboarding/schema'

/**
 * Crafts a personalized skill PER PLATFORM from the onboarding answers, using the
 * bundled hand-crafted skill purely as a STRUCTURAL/quality template (its personal
 * details are never copied). One LLM call per platform returns the file set as
 * JSON; a deterministic fallback guarantees onboarding always yields a usable
 * skill even if the model misbehaves. The improvement log always starts empty.
 */

const TEMPLATE_DIR = path.join(process.cwd(), 'seed', 'skills', 'miguel-linkedin-content')

const REFERENCE_FILES = [
  'references/audience-and-positioning.md',
  'references/post-archetypes.md',
  'references/constraints-and-voice.md',
  'references/tactical-execution.md',
] as const

let templateCache: string | null = null

/** A trimmed structural excerpt of the hand-crafted skill, to guide quality. */
async function templateGuide(): Promise<string> {
  if (templateCache !== null) return templateCache
  try {
    const archetypes = await fs.readFile(
      path.join(TEMPLATE_DIR, 'references', 'post-archetypes.md'),
      'utf8',
    )
    templateCache = archetypes.slice(0, 4000)
  } catch {
    templateCache = ''
  }
  return templateCache
}

function improvementLogSeed(name: string, platform: string): string {
  return `# Improvement log — ${name} · ${platform}

This log starts empty. After each post, append the real numbers (impressions,
reactions, comments, engagement rate after 48h) and a one-line lesson. The skill
gets sharper as data accumulates.

## Entry template
- **Date**:
- **Post (hook)**:
- **Archetype**:
- **Numbers (48h)**: impressions / reactions / comments / engagement rate
- **Lesson**:
`
}

function voiceReferenceSeed(name: string, platform: string): string {
  return `# Voice reference — ${name} · ${platform}

This file is EMPTY until the creator sets a writing style by reference. They can
do that from chat — e.g. "update my writing style to be like <link>" — which
scrapes that creator's posts and writes a captured style guide here, OVERWRITING
this placeholder. Once set, it is the primary authority on voice, rhythm, hooks,
structure, formatting, and engagement tactics. Until then, follow the voice rules
in the constraints file.

(Factual-honesty constraints always apply: never invent the creator's own
customers, clients, or metrics, regardless of the referenced style.)
`
}

function preferencesSeed(name: string, platform: string): string {
  return `# Preferences — ${name} · ${platform}

A running list of durable preferences and corrections stated in chat — words to
avoid, formatting rules, recurring asks. The agent appends here so they carry
across conversations; post-performance numbers go to improvement-log.md instead.
Read this before writing. This starts empty.

## Entry template
- **Date**:
- **Preference**:
`
}

interface GeneratedSkill {
  name: string
  description: string
  files: Record<string, string>
}

function extractJson(raw: string): unknown {
  // Models sometimes wrap JSON in prose or ```json fences. Grab the outermost {}.
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('no JSON object found')
  return JSON.parse(raw.slice(start, end + 1))
}

function profileSummary(p: OnboardingProfile): string {
  return [
    `Name: ${p.name}`,
    p.role && `Role/title: ${p.role}`,
    p.company && `Company: ${p.company}`,
    p.oneLiner && `What they do: ${p.oneLiner}`,
    p.stage && `Stage: ${p.stage}`,
    p.claims && `What they can honestly claim: ${p.claims}`,
    `Audience / ICP: ${p.audience}`,
    `Primary goal: ${p.goal}`,
    p.pillars && `Content pillars: ${p.pillars}`,
    `Voice: ${p.voiceFormality} formality, ${p.voiceEdge} edge, emoji=${p.voiceEmoji ? 'yes' : 'no'}`,
    p.constraints && `Hard constraints / no-gos: ${p.constraints}`,
    p.bannedTactics && `Banned tactics: ${p.bannedTactics}`,
    p.cadence && `Cadence: ${p.cadence}`,
    p.timezone && `Timezone: ${p.timezone}`,
    p.conversion && `Conversion path: ${p.conversion}`,
    p.inspiration && `Inspiration accounts: ${p.inspiration}`,
    p.pastWins && `Past wins: ${p.pastWins}`,
  ]
    .filter(Boolean)
    .join('\n')
}

async function llmGenerate(
  profile: OnboardingProfile,
  platformId: string,
): Promise<GeneratedSkill> {
  const platform = platformLabel(platformId)
  const guide = await templateGuide()

  const system = `You are an expert content strategist. You craft a personalized "skill" — a set of markdown files — that lets an AI draft on-brand ${platform} content for ONE specific creator and improve it over time. The skill must fit THIS person and THIS platform perfectly.`

  const user = `Create a ${platform} content skill for this creator:

${profileSummary(profile)}

Tailor everything to ${platform}'s native norms (ideal length/format, hooks, hashtags, media, posting rhythm) and to the creator's voice, audience, goal, and constraints. Honor the constraints strictly — e.g. if they have no shipped customers, forbid traction/customer claims and prefer forward-looking framing. Do NOT invent fake metrics or testimonials. Start patterns as best-practice hypotheses to be validated via the improvement loop.

Return ONLY a JSON object with this exact shape:
{
  "name": "<short skill name>",
  "description": "<one-paragraph description of when this skill triggers and who it's for>",
  "files": {
    "SKILL.md": "<full markdown with YAML frontmatter (name, description), how to use the skill, the core principles tailored to this creator, and an 'improvement loop' section instructing to log results and append learnings (append, don't overwrite)>",
    "references/audience-and-positioning.md": "<who the audience is, the creator's positioning/identity, and what they can honestly claim>",
    "references/post-archetypes.md": "<3-6 post archetypes that fit this creator + platform, each with structure, when to use, and a short on-voice example>",
    "references/constraints-and-voice.md": "<honest constraints, no-gos, voice/tone rules, CTA/engagement rules>",
    "references/tactical-execution.md": "<${platform}-specific format, cadence, best posting times for their timezone, engagement-window tactics, and conversion path>"
  }
}

Keep each reference concise (roughly 150-300 words) — it will grow via the improvement loop. The SKILL.md frontmatter MUST be valid YAML starting with --- on the first line.

For quality/structure reference only (DO NOT copy its personal details, names, companies, or numbers), here is an excerpt of a strong archetypes file:
"""
${guide}
"""`

  const client = openai()
  const res = await client.chat.completions.create({
    model: llmModel(),
    max_tokens: 8000,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  })
  const raw = res.choices[0]?.message?.content ?? ''
  const parsed = extractJson(raw) as GeneratedSkill
  if (!parsed?.files || typeof parsed.files !== 'object' || !parsed.files['SKILL.md']) {
    throw new Error('generated skill missing files/SKILL.md')
  }
  return parsed
}

/** Deterministic fallback so onboarding never hard-fails. */
function fallbackSkill(profile: OnboardingProfile, platformId: string, slug: string): GeneratedSkill {
  const platform = platformLabel(platformId)
  const name = slug
  const description = `Write ${platform} content for ${profile.name}${profile.role ? `, ${profile.role}` : ''}. Audience: ${profile.audience}. Primary goal: ${profile.goal}. Trigger whenever drafting, editing, or planning ${platform} content.`
  const skillMd = `---
name: ${slug}
description: ${description}
---

# ${name}

This skill drafts on-brand ${platform} content for ${profile.name} and improves over time.

## Who & why
${profileSummary(profile)}

## Core principles
- Write for the audience above; speak to their tension, not at them.
- Match the creator's voice: ${profile.voiceFormality} formality, ${profile.voiceEdge} edge, emoji ${profile.voiceEmoji ? 'allowed' : 'avoided'}.
- Respect every constraint in references/constraints-and-voice.md before publishing.
- Optimize each post for ${platform}'s native format.

## The improvement loop
After each post, append the real numbers + a one-line lesson to references/improvement-log.md (append, don't overwrite). Add newly-proven patterns to references/post-archetypes.md. Only change existing guidance via an approved overwrite.
`
  return {
    name,
    description,
    files: {
      'SKILL.md': skillMd,
      'references/audience-and-positioning.md': `# Audience & positioning\n\n${profile.audience}\n\nPositioning: ${profile.oneLiner || profile.role || profile.name}.\n\nWhat can be honestly claimed: ${profile.claims || '(fill in)'}.`,
      'references/post-archetypes.md': `# Post archetypes (${platform})\n\nStart with these and refine via the improvement loop:\n\n1. **Insight** — a sharp, specific observation your audience feels but hasn't named.\n2. **Story/lesson** — a concrete experience and what it taught you.\n3. **Contrarian take** — an unpopular-but-defensible position, with evidence.\n4. **Framework** — a repeatable way to think about a recurring problem.`,
      'references/constraints-and-voice.md': `# Constraints & voice\n\nVoice: ${profile.voiceFormality} formality, ${profile.voiceEdge} edge, emoji ${profile.voiceEmoji ? 'allowed' : 'avoided'}.\n\nHard constraints / no-gos: ${profile.constraints || '(none specified)'}.\n\nBanned tactics: ${profile.bannedTactics || 'engagement-baiting / false claims'}.`,
      'references/tactical-execution.md': `# Tactical execution (${platform})\n\nCadence: ${profile.cadence || '(set a sustainable rhythm)'}.\nTimezone: ${profile.timezone || '(set yours)'}.\nConversion path: ${profile.conversion || '(how readers become leads/subscribers)'}.\n\nReply to early comments quickly to build momentum in the first engagement window.`,
    },
  }
}

/** Force the SKILL.md frontmatter `name` to equal the slug so the file, the DB
 * row, and the agent's tools all agree on one identity. */
function normalizeSkillMd(content: string, slug: string, description: string): string {
  const fm = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (fm) {
    const block = /^name:.*$/m.test(fm[1])
      ? fm[1].replace(/^name:.*$/m, `name: ${slug}`)
      : `name: ${slug}\n${fm[1]}`
    return content.replace(/^---\s*\n[\s\S]*?\n---/, `---\n${block}\n---`)
  }
  return `---\nname: ${slug}\ndescription: ${description}\n---\n\n${content}`
}

async function storeSkill(
  accountId: string,
  slug: string,
  gen: GeneratedSkill,
  platformId: string,
): Promise<void> {
  // Skill name == slug (e.g. "miguel-linkedin-content") — never the model's
  // arbitrary choice. One identity across the DB row, the file, and the tools.
  const displayName = slug
  await createSkill(accountId, slug, displayName, gen.description)
  for (const filePath of ['SKILL.md', ...REFERENCE_FILES]) {
    let content = gen.files[filePath]
    if (!content || !content.trim()) continue
    if (filePath === 'SKILL.md') content = normalizeSkillMd(content, slug, gen.description)
    await createSkillFile(accountId, slug, filePath, content, 'agent')
  }
  await createSkillFile(
    accountId,
    slug,
    'references/improvement-log.md',
    improvementLogSeed(displayName, platformLabel(platformId)),
    'agent',
  )
  await createSkillFile(
    accountId,
    slug,
    'references/preferences.md',
    preferencesSeed(displayName, platformLabel(platformId)),
    'agent',
  )
  await createSkillFile(
    accountId,
    slug,
    'references/voice-reference.md',
    voiceReferenceSeed(displayName, platformLabel(platformId)),
    'agent',
  )
}

/**
 * Generate + store a personalized skill for each selected platform that doesn't
 * already have one. Calls `onProgress` with a human-readable step before each
 * platform. Returns the slugs created.
 */
export async function generatePersonalizedSkills(
  accountId: string,
  profile: OnboardingProfile,
  onProgress?: (message: string) => void,
): Promise<string[]> {
  const username = slugifyUsername(profile.name)
  const existing = new Set((await listSkills(accountId)).map((s) => s.slug))
  const created: string[] = []

  for (const platformId of profile.platforms) {
    const slug = skillSlug(username, platformId)
    if (existing.has(slug)) continue
    onProgress?.(`Crafting your ${platformLabel(platformId)} skill…`)

    let gen: GeneratedSkill
    try {
      gen = await llmGenerate(profile, platformId)
    } catch (e) {
      console.error(`[onboarding] LLM generation failed for ${platformId}, using fallback`, e)
      gen = fallbackSkill(profile, platformId, slug)
    }

    await storeSkill(accountId, slug, gen, platformId)
    existing.add(slug)
    created.push(slug)
  }

  return created
}
