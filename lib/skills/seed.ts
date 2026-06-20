import { promises as fs } from 'node:fs'
import path from 'node:path'
import { supabaseService } from '@/lib/supabase/service'

/**
 * Canonical seed source: the unzipped `.skill` bundle(s) committed to the repo.
 * On first provision we import these into the DB (content_skills /
 * content_skill_files) for the account; from then on the agent reads/edits the
 * DB copy, so self-improvement persists and the repo copy stays as a clean seed.
 */
const SEED_ROOT = path.join(process.cwd(), 'seed', 'skills')

interface ParsedFrontmatter {
  name: string
  description: string
}

/** Minimal YAML-frontmatter reader for `name:` and `description:` (single-line). */
function parseFrontmatter(md: string, fallbackName: string): ParsedFrontmatter {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---/)
  let name = fallbackName
  let description = ''
  if (m) {
    const block = m[1]
    const nameM = block.match(/^name:\s*(.+)$/m)
    const descM = block.match(/^description:\s*(.+)$/m)
    if (nameM) name = nameM[1].trim()
    if (descM) description = descM[1].trim()
  }
  return { name, description }
}

/** Recursively collect file paths under `dir`, returned relative to `dir`. */
async function walk(dir: string, base = dir): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const out: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walk(full, base)))
    } else if (entry.isFile()) {
      out.push(path.relative(base, full))
    }
  }
  return out
}

/**
 * Idempotently seed every skill found under seed/skills/ into the given account.
 * Skips any skill whose slug already exists for the account, so it's safe to call
 * on every login.
 */
export async function seedSkillsForAccount(accountId: string): Promise<void> {
  const svc = supabaseService()

  let skillDirs: string[]
  try {
    const entries = await fs.readdir(SEED_ROOT, { withFileTypes: true })
    skillDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    // No seed directory packaged — nothing to seed.
    return
  }

  for (const slug of skillDirs) {
    const { data: existing, error: existErr } = await svc
      .from('content_skills')
      .select('id')
      .eq('account_id', accountId)
      .eq('slug', slug)
      .maybeSingle()
    if (existErr) throw new Error(`seed lookup failed: ${existErr.message}`)
    if (existing) continue

    const skillDir = path.join(SEED_ROOT, slug)
    const relPaths = (await walk(skillDir)).map((p) => p.split(path.sep).join('/'))

    const skillMdPath = relPaths.find((p) => p === 'SKILL.md')
    const skillMd = skillMdPath
      ? await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf8')
      : ''
    const { name, description } = parseFrontmatter(skillMd, slug)

    const { data: skill, error: skillErr } = await svc
      .from('content_skills')
      .insert({ account_id: accountId, slug, name, description })
      .select('id')
      .single()
    if (skillErr || !skill) {
      throw new Error(`seed skill insert failed: ${skillErr?.message ?? 'no data'}`)
    }
    const skillId = skill.id as string

    const fileRows = await Promise.all(
      relPaths.map(async (rel) => ({
        skill_id: skillId,
        account_id: accountId,
        path: rel,
        content: await fs.readFile(path.join(skillDir, rel), 'utf8'),
        version: 1,
      })),
    )

    const { error: filesErr } = await svc
      .from('content_skill_files')
      .insert(fileRows)
    if (filesErr) throw new Error(`seed files insert failed: ${filesErr.message}`)
  }
}
