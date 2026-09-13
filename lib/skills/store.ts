import JSZip from 'jszip'
import { supabaseService } from '@/lib/supabase/service'

/**
 * Account-scoped CRUD + versioning for skills stored in Supabase.
 *
 * Every function takes a SERVER-DERIVED accountId and filters by it (the
 * service-role client bypasses RLS, so scoping is our responsibility).
 *
 * A skill is exactly one file, SKILL.md, and only human actions write it: the
 * owner editing on the Skills page, and onboarding. The agent can read
 * a skill but has no tool that reaches the write functions here. Every applied
 * change is recorded as an immutable version row for audit + rollback.
 */

/** The only file a skill may contain. */
export const SKILL_FILE = 'SKILL.md'

export interface SkillRow {
  id: string
  slug: string
  name: string
  description: string | null
}

export interface SkillFileRow {
  id: string
  skill_id: string
  path: string
  content: string
  version: number
  updated_at: string
}

export interface VersionRow {
  id: string
  skill_file_id: string
  path: string
  content: string
  version: number
  change_type: string
  author: string
  created_at: string
}

// ── reads ────────────────────────────────────────────────────────────────────

export async function listSkills(accountId: string): Promise<SkillRow[]> {
  const { data, error } = await supabaseService()
    .from('content_skills')
    .select('id, slug, name, description')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`listSkills failed: ${error.message}`)
  return (data ?? []) as SkillRow[]
}

async function getSkillBySlug(
  accountId: string,
  slug: string,
): Promise<SkillRow> {
  const { data, error } = await supabaseService()
    .from('content_skills')
    .select('id, slug, name, description')
    .eq('account_id', accountId)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(`getSkill failed: ${error.message}`)
  if (!data) throw new Error(`skill not found: ${slug}`)
  return data as SkillRow
}

export async function listSkillFiles(
  accountId: string,
  slug: string,
): Promise<SkillFileRow[]> {
  const skill = await getSkillBySlug(accountId, slug)
  const { data, error } = await supabaseService()
    .from('content_skill_files')
    .select('id, skill_id, path, content, version, updated_at')
    .eq('account_id', accountId)
    .eq('skill_id', skill.id)
    .order('path', { ascending: true })
  if (error) throw new Error(`listSkillFiles failed: ${error.message}`)
  return (data ?? []) as SkillFileRow[]
}

/** A skill's SKILL.md — the whole skill, since it has no other files. */
export async function readSkill(accountId: string, slug: string) {
  const skill = await getSkillBySlug(accountId, slug)
  const skillMd = await getFile(accountId, slug, SKILL_FILE)
  return {
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    skill_md: skillMd?.content ?? '',
  }
}

async function getFile(
  accountId: string,
  slug: string,
  filePath: string,
): Promise<SkillFileRow | null> {
  const skill = await getSkillBySlug(accountId, slug)
  const { data, error } = await supabaseService()
    .from('content_skill_files')
    .select('id, skill_id, path, content, version, updated_at')
    .eq('account_id', accountId)
    .eq('skill_id', skill.id)
    .eq('path', filePath)
    .maybeSingle()
  if (error) throw new Error(`getFile failed: ${error.message}`)
  return (data as SkillFileRow | null) ?? null
}

// ── version recording ─────────────────────────────────────────────────────────

async function recordVersion(
  accountId: string,
  file: { id: string; path: string; content: string; version: number },
  changeType: 'overwrite' | 'create' | 'rollback',
  author: 'agent' | 'user',
): Promise<void> {
  const { error } = await supabaseService()
    .from('content_skill_file_versions')
    .insert({
      skill_file_id: file.id,
      account_id: accountId,
      path: file.path,
      content: file.content,
      version: file.version,
      change_type: changeType,
      author,
    })
  if (error) throw new Error(`recordVersion failed: ${error.message}`)
}

// ── writes (human paths only: Skills page, onboarding) ────────────────────────

/**
 * Create a skill's SKILL.md. Errors if it already exists (use writeSkillFile to
 * change it).
 */
export async function createSkillFile(
  accountId: string,
  slug: string,
  filePath: string,
  content: string,
  author: 'agent' | 'user' = 'agent',
): Promise<{ applied: true; path: string }> {
  if (filePath !== SKILL_FILE) throw new Error(`only ${SKILL_FILE} is allowed in a skill: ${filePath}`)
  const existing = await getFile(accountId, slug, filePath)
  if (existing) throw new Error(`file already exists: ${slug}/${filePath}`)
  const skill = await getSkillBySlug(accountId, slug)
  const { data, error } = await supabaseService()
    .from('content_skill_files')
    .insert({
      skill_id: skill.id,
      account_id: accountId,
      path: filePath,
      content,
      version: 1,
    })
    .select('id, path, content, version')
    .single()
  if (error || !data) {
    throw new Error(`createSkillFile failed: ${error?.message ?? 'no data'}`)
  }
  await recordVersion(accountId, data as SkillFileRow, 'create', author)
  return { applied: true, path: filePath }
}

/**
 * Directly overwrite SKILL.md — for DELIBERATE human edits from the UI (the owner
 * editing their own skill). Applies immediately and records a version for
 * history/rollback. Creates the file if it doesn't exist yet.
 */
export async function writeSkillFile(
  accountId: string,
  slug: string,
  filePath: string,
  content: string,
  author: 'agent' | 'user' = 'user',
): Promise<{ applied: true; path: string; version: number }> {
  if (filePath !== SKILL_FILE) throw new Error(`only ${SKILL_FILE} is allowed in a skill: ${filePath}`)
  const existing = await getFile(accountId, slug, filePath)
  if (!existing) {
    const res = await createSkillFile(accountId, slug, filePath, content, author)
    return { ...res, version: 1 }
  }
  const nextVersion = existing.version + 1
  const { error } = await supabaseService()
    .from('content_skill_files')
    .update({ content, version: nextVersion, updated_at: new Date().toISOString() })
    .eq('id', existing.id)
    .eq('account_id', accountId)
  if (error) throw new Error(`writeSkillFile failed: ${error.message}`)
  await recordVersion(
    accountId,
    { id: existing.id, path: filePath, content, version: nextVersion },
    'overwrite',
    author,
  )
  return { applied: true, path: filePath, version: nextVersion }
}

/** Create a new (empty) skill. */
export async function createSkill(
  accountId: string,
  slug: string,
  name: string,
  description: string,
): Promise<{ applied: true; slug: string }> {
  const { error } = await supabaseService()
    .from('content_skills')
    .insert({ account_id: accountId, slug, name, description })
  if (error) throw new Error(`createSkill failed: ${error.message}`)
  return { applied: true, slug }
}

// ── version history + rollback ─────────────────────────────────────────────────

export async function listFileVersions(
  accountId: string,
  skillFileId: string,
): Promise<VersionRow[]> {
  const { data, error } = await supabaseService()
    .from('content_skill_file_versions')
    .select('id, skill_file_id, path, content, version, change_type, author, created_at')
    .eq('account_id', accountId)
    .eq('skill_file_id', skillFileId)
    .order('version', { ascending: false })
  if (error) throw new Error(`listFileVersions failed: ${error.message}`)
  return (data ?? []) as VersionRow[]
}

/** Roll a file back to the content captured in a prior version row. */
export async function rollbackToVersion(
  accountId: string,
  versionId: string,
): Promise<void> {
  const svc = supabaseService()
  const { data: ver, error: vErr } = await svc
    .from('content_skill_file_versions')
    .select('skill_file_id, content')
    .eq('account_id', accountId)
    .eq('id', versionId)
    .single()
  if (vErr || !ver) throw new Error(`rollback version lookup failed: ${vErr?.message}`)

  const { data: file, error: fErr } = await svc
    .from('content_skill_files')
    .select('id, path, version')
    .eq('account_id', accountId)
    .eq('id', ver.skill_file_id as string)
    .single()
  if (fErr || !file) throw new Error(`rollback file lookup failed: ${fErr?.message}`)

  const nextVersion = (file.version as number) + 1
  const { error: uErr } = await svc
    .from('content_skill_files')
    .update({
      content: ver.content as string,
      version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq('id', file.id)
    .eq('account_id', accountId)
  if (uErr) throw new Error(`rollback update failed: ${uErr.message}`)
  await recordVersion(
    accountId,
    {
      id: file.id as string,
      path: file.path as string,
      content: ver.content as string,
      version: nextVersion,
    },
    'rollback',
    'user',
  )
}

// ── export ─────────────────────────────────────────────────────────────────────

/** Re-pack a skill's current files into a `.skill` (zip) buffer for download. */
export async function exportSkillToZip(
  accountId: string,
  slug: string,
): Promise<Uint8Array> {
  const files = await listSkillFiles(accountId, slug)
  const zip = new JSZip()
  const root = zip.folder(slug)!
  for (const f of files) root.file(f.path, f.content)
  return zip.generateAsync({ type: 'uint8array' })
}

// ── system-prompt helper ────────────────────────────────────────────────────────

/**
 * Compact index of available skills injected as a system note each turn, so the
 * model knows what exists and can load a skill's SKILL.md on demand.
 */
export async function buildSkillsIndexNote(accountId: string): Promise<string> {
  const skills = await listSkills(accountId)
  if (skills.length === 0) {
    return 'AVAILABLE SKILLS: (none yet).'
  }
  const lines = skills.map(
    (s) => `- ${s.slug}: ${s.description ?? s.name}`,
  )
  return `AVAILABLE SKILLS (call read_skill with the slug to load its SKILL.md before writing):\n${lines.join('\n')}`
}
