import { openai, llmModel } from '@/lib/agent/llm'
import { listSkills, createSkill, createSkillFile, SKILL_FILE } from '@/lib/skills/store'
import { platformLabel, skillSlug, slugifyUsername, type OnboardingProfile } from '@/lib/onboarding/schema'

/**
 * Crafts a personalized skill PER PLATFORM from the onboarding answers, using a
 * short built-in example skill (for a fictional creator) purely as a
 * STRUCTURAL/quality template. One LLM call per platform returns the skill's single
 * SKILL.md as JSON; a deterministic fallback guarantees onboarding always yields a
 * usable skill even if the model misbehaves.
 */

/** A short example skill for a fictional creator, to guide structure and quality. */
const TEMPLATE_GUIDE = `---
name: alex-linkedin-content
description: Write LinkedIn posts for Alex Rivera, who runs a two-person bookkeeping-automation studio, for owners of small accounting firms. Trigger whenever drafting, critiquing or planning Alex's LinkedIn content.
---

# Alex's LinkedIn Content Skill

## Audience & positioning
Owners of 5-30 person accounting firms who are buried in month-end close. Alex builds automations for them.
Alex can honestly claim: four years running a bookkeeping team, two pilot clients. Alex cannot claim case-study results yet.

## Post archetypes
1. The month-end confession: name one painful ritual precisely, say what it costs, end with a question.
   Structure: specific scene -> the hidden cost -> one-line reframe -> question.
   Example opener: "It's 9pm on the 3rd and you're re-keying the same bank feed for the third time."
2. Builder notes: three numbered lessons from building a real automation, each with a "what most people miss" line.
3. Contrarian take: a defensible position the audience half-agrees with; pre-empt the obvious objection.

## Constraints & voice
- Short sentences, one idea per line, no emojis, at most two hashtags.
- Never invent clients, numbers or testimonials. Use forward-looking framing ("what I'd automate first").
- Close with a question, never a "comment X to get the guide" gate.

## LinkedIn tactics
- Two to three posts a week, Tuesday to Thursday mornings in the audience's timezone.
- Reply to every comment in the first hour.
`

interface GeneratedSkill {
  name: string
  description: string
  skill_md: string
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
  const guide = TEMPLATE_GUIDE

  const system = `You are an expert content strategist. You craft a personalized "skill" — a single markdown file, SKILL.md — that lets an AI draft on-brand ${platform} content for ONE specific creator. The skill must fit THIS person and THIS platform perfectly.`

  const user = `Create a ${platform} content skill for this creator:

${profileSummary(profile)}

Tailor everything to ${platform}'s native norms (ideal length/format, hooks, hashtags, media, posting rhythm) and to the creator's voice, audience, goal, and constraints. Honor the constraints strictly — e.g. if they have no shipped customers, forbid traction/customer claims and prefer forward-looking framing. Do NOT invent fake metrics or testimonials. Start patterns as best-practice hypotheses the creator can refine over time.

Return ONLY a JSON object with this exact shape:
{
  "name": "<short skill name>",
  "description": "<one-paragraph description of when this skill triggers and who it's for>",
  "skill_md": "<the full SKILL.md: YAML frontmatter (name, description), then these sections — how to use the skill; audience & positioning (who the audience is, the creator's positioning, what they can honestly claim); 3-6 post archetypes that fit this creator + platform, each with structure, when to use, and a short on-voice example; constraints & voice (honest constraints, no-gos, tone, CTA/engagement rules); ${platform} tactics (format, cadence, best posting times for their timezone, engagement-window tactics, conversion path)>"
}

Keep the whole file concise (roughly 900-1500 words). It is the skill's only file, so never refer to other files. The SKILL.md frontmatter MUST be valid YAML starting with --- on the first line.

For quality/structure reference only (DO NOT copy its personal details, names, companies, or numbers), here is an example of a strong skill:
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
  if (!parsed?.skill_md || typeof parsed.skill_md !== 'string') {
    throw new Error('generated skill missing skill_md')
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

This skill drafts on-brand ${platform} content for ${profile.name}.

## Who & why
${profileSummary(profile)}

## Core principles
- Write for the audience below; speak to their tension, not at them.
- Match the creator's voice: ${profile.voiceFormality} formality, ${profile.voiceEdge} edge, emoji ${profile.voiceEmoji ? 'allowed' : 'avoided'}.
- Respect every rule in "Constraints & voice" before publishing.
- Optimize each post for ${platform}'s native format.

## Audience & positioning
${profile.audience}

Positioning: ${profile.oneLiner || profile.role || profile.name}.

What can be honestly claimed: ${profile.claims || '(fill in)'}.

## Post archetypes (${platform})
Start with these and refine them over time:

1. **Insight** — a sharp, specific observation your audience feels but hasn't named.
2. **Story/lesson** — a concrete experience and what it taught you.
3. **Contrarian take** — an unpopular-but-defensible position, with evidence.
4. **Framework** — a repeatable way to think about a recurring problem.

## Constraints & voice
Voice: ${profile.voiceFormality} formality, ${profile.voiceEdge} edge, emoji ${profile.voiceEmoji ? 'allowed' : 'avoided'}.

Hard constraints / no-gos: ${profile.constraints || '(none specified)'}.

Banned tactics: ${profile.bannedTactics || 'engagement-baiting / false claims'}.

## Tactical execution (${platform})
Cadence: ${profile.cadence || '(set a sustainable rhythm)'}.
Timezone: ${profile.timezone || '(set yours)'}.
Conversion path: ${profile.conversion || '(how readers become leads/subscribers)'}.

Reply to early comments quickly to build momentum in the first engagement window.
`
  return { name, description, skill_md: skillMd }
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
): Promise<void> {
  // Skill name == slug (e.g. "alex-linkedin-content") — never the model's
  // arbitrary choice. One identity across the DB row, the file, and the tools.
  await createSkill(accountId, slug, slug, gen.description)
  await createSkillFile(
    accountId,
    slug,
    SKILL_FILE,
    normalizeSkillMd(gen.skill_md, slug, gen.description),
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

    await storeSkill(accountId, slug, gen)
    existing.add(slug)
    created.push(slug)
  }

  return created
}
