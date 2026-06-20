import { z } from 'zod'

/**
 * Platforms the user can post on (multi-select in onboarding). Each maps to a
 * dedicated skill slug — one skill per platform, since norms/length/cadence
 * differ a lot across them.
 */
export const PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn', slug: 'linkedin-content' },
  { id: 'x', label: 'X (Twitter)', slug: 'x-content' },
  { id: 'instagram', label: 'Instagram', slug: 'instagram-content' },
  { id: 'tiktok', label: 'TikTok', slug: 'tiktok-content' },
  { id: 'youtube', label: 'YouTube', slug: 'youtube-content' },
  { id: 'threads', label: 'Threads', slug: 'threads-content' },
  { id: 'substack', label: 'Substack / Newsletter', slug: 'newsletter-content' },
  { id: 'reddit', label: 'Reddit', slug: 'reddit-content' },
  { id: 'facebook', label: 'Facebook', slug: 'facebook-content' },
  { id: 'bluesky', label: 'Bluesky', slug: 'bluesky-content' },
] as const

export type PlatformId = (typeof PLATFORMS)[number]['id']

export function platformLabel(id: string): string {
  return PLATFORMS.find((p) => p.id === id)?.label ?? id
}

export function platformSlug(id: string): string {
  return PLATFORMS.find((p) => p.id === id)?.slug ?? `${id}-content`
}

/** A short kebab username from the person's name (first word), for skill slugs. */
export function slugifyUsername(name: string): string {
  const first = (name.trim().split(/\s+/)[0] ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return first || 'user'
}

/** The skill slug for a person + platform, e.g. `miguel-linkedin-content`. */
export function skillSlug(username: string, platformId: string): string {
  return `${username}-${platformSlug(platformId)}`
}

const platformIds = PLATFORMS.map((p) => p.id) as [string, ...string[]]

/**
 * The onboarding answers — everything needed to craft a skill that fits the
 * person. Stored in `config` (key `content_profile`) so the skill can be
 * regenerated and the agent can reference it.
 */
export const OnboardingProfile = z.object({
  // Identity
  name: z.string().min(1, 'Your name is required'),
  role: z.string().default(''),
  company: z.string().default(''),
  oneLiner: z.string().default(''),
  // Stage & what can be honestly claimed
  stage: z.string().default(''),
  claims: z.string().default(''),
  // Audience + goal
  audience: z.string().min(1, 'Describe who you want to reach'),
  goal: z.string().min(1, 'Pick a primary goal'),
  // Platforms
  platforms: z.array(z.enum(platformIds)).min(1, 'Select at least one platform'),
  // Content
  pillars: z.string().default(''),
  // Voice
  voiceFormality: z.enum(['casual', 'balanced', 'formal']).default('balanced'),
  voiceEmoji: z.boolean().default(false),
  voiceEdge: z.enum(['measured', 'balanced', 'contrarian']).default('balanced'),
  // Constraints
  constraints: z.string().default(''),
  bannedTactics: z.string().default(''),
  // Cadence + execution
  cadence: z.string().default(''),
  timezone: z.string().default(''),
  conversion: z.string().default(''),
  // Optional calibration
  inspiration: z.string().default(''),
  pastWins: z.string().default(''),
})

export type OnboardingProfile = z.infer<typeof OnboardingProfile>

export const GOALS = [
  { id: 'inbound', label: 'Inbound leads / clients' },
  { id: 'authority', label: 'Authority / thought leadership' },
  { id: 'hiring', label: 'Hiring / employer brand' },
  { id: 'fundraising', label: 'Fundraising / investor reach' },
  { id: 'sales', label: 'Direct sales / pipeline' },
  { id: 'community', label: 'Community / audience growth' },
] as const
