import JSZip from 'jszip'
import { supabaseService } from '@/lib/supabase/service'

/**
 * Account-scoped CRUD + versioning for skills stored in Supabase.
 *
 * Every function takes a SERVER-DERIVED accountId and filters by it (the
 * service-role client bypasses RLS, so scoping is our responsibility). This is
 * the only module that mutates skill content; the agent reaches it through tools.
 *
 * Self-edit rule (per product decision): appends are applied immediately;
 * overwrites of existing, non-empty content become a pending proposal that a
 * human approves in the UI. Every applied change is recorded as an immutable
 * version row for audit + rollback.
 */

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

export interface ProposalRow {
  id: string
  skill_id: string
  skill_file_id: string | null
  path: string
  proposed_content: string
  base_version: number | null
  change_type: string
  rationale: string | null
  status: string
  created_at: string
  resolved_at: string | null
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

/** SKILL.md content + the list of reference paths (for progressive disclosure). */
export async function readSkill(accountId: string, slug: string) {
  const skill = await getSkillBySlug(accountId, slug)
  const files = await listSkillFiles(accountId, slug)
  const skillMd = files.find((f) => f.path === 'SKILL.md')
  return {
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    skill_md: skillMd?.content ?? '',
    files: files.map((f) => f.path),
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

export async function readSkillFile(
  accountId: string,
  slug: string,
  filePath: string,
): Promise<string> {
  const file = await getFile(accountId, slug, filePath)
  if (!file) throw new Error(`file not found: ${slug}/${filePath}`)
  return file.content
}

// ── version recording ─────────────────────────────────────────────────────────

async function recordVersion(
  accountId: string,
  file: { id: string; path: string; content: string; version: number },
  changeType: 'append' | 'overwrite' | 'create' | 'rollback',
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

// ── writes ────────────────────────────────────────────────────────────────────

/**
 * Append to a reference file (the skill's own "add, don't overwrite" rule —
 * applied immediately). Creates the file if it doesn't exist yet.
 */
export async function appendSkillFile(
  accountId: string,
  slug: string,
  filePath: string,
  content: string,
  author: 'agent' | 'user' = 'agent',
): Promise<{ applied: true; path: string; version: number }> {
  const skill = await getSkillBySlug(accountId, slug)
  const existing = await getFile(accountId, slug, filePath)
  const svc = supabaseService()

  if (!existing) {
    const { data, error } = await svc
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
      throw new Error(`appendSkillFile create failed: ${error?.message ?? 'no data'}`)
    }
    await recordVersion(accountId, data as SkillFileRow, 'create', author)
    return { applied: true, path: filePath, version: 1 }
  }

  const merged = `${existing.content.replace(/\s*$/, '')}\n\n${content.trim()}\n`
  const nextVersion = existing.version + 1
  const { error } = await svc
    .from('content_skill_files')
    .update({ content: merged, version: nextVersion, updated_at: new Date().toISOString() })
    .eq('id', existing.id)
    .eq('account_id', accountId)
  if (error) throw new Error(`appendSkillFile update failed: ${error.message}`)
  await recordVersion(
    accountId,
    { id: existing.id, path: filePath, content: merged, version: nextVersion },
    'append',
    author,
  )
  return { applied: true, path: filePath, version: nextVersion }
}

/**
 * Create a brand-new reference file (new content, not destructive). Applied
 * immediately. Errors if the path already exists (use propose/append instead).
 */
export async function createSkillFile(
  accountId: string,
  slug: string,
  filePath: string,
  content: string,
  author: 'agent' | 'user' = 'agent',
): Promise<{ applied: true; path: string }> {
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
 * Directly overwrite a file's full content — for DELIBERATE human edits from the
 * UI (the owner editing their own skill). Unlike the agent's `proposeOverwrite`,
 * this applies immediately; it still records a version for history/rollback.
 * Creates the file if it doesn't exist yet.
 */
export async function writeSkillFile(
  accountId: string,
  slug: string,
  filePath: string,
  content: string,
  author: 'agent' | 'user' = 'user',
): Promise<{ applied: true; path: string; version: number }> {
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

/**
 * Overwrite request. If the target file exists with non-empty content, this does
 * NOT write — it records a pending proposal for human approval and returns its
 * id. If the file is new/empty, it writes directly (nothing destroyed).
 */
export async function proposeOverwrite(
  accountId: string,
  slug: string,
  filePath: string,
  content: string,
  rationale: string,
): Promise<
  | { applied: true; path: string }
  | { proposed: true; proposalId: string; path: string }
> {
  const skill = await getSkillBySlug(accountId, slug)
  const existing = await getFile(accountId, slug, filePath)

  if (!existing || existing.content.trim() === '') {
    // Nothing to destroy → safe to apply immediately as a create/overwrite.
    if (!existing) {
      await createSkillFile(accountId, slug, filePath, content)
    } else {
      const nextVersion = existing.version + 1
      const { error } = await supabaseService()
        .from('content_skill_files')
        .update({ content, version: nextVersion, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .eq('account_id', accountId)
      if (error) throw new Error(`proposeOverwrite apply failed: ${error.message}`)
      await recordVersion(
        accountId,
        { id: existing.id, path: filePath, content, version: nextVersion },
        'overwrite',
        'agent',
      )
    }
    return { applied: true, path: filePath }
  }

  const { data, error } = await supabaseService()
    .from('content_skill_edit_proposals')
    .insert({
      account_id: accountId,
      skill_id: skill.id,
      skill_file_id: existing.id,
      path: filePath,
      proposed_content: content,
      base_version: existing.version,
      change_type: 'overwrite',
      rationale,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`proposeOverwrite failed: ${error?.message ?? 'no data'}`)
  }
  return { proposed: true, proposalId: data.id as string, path: filePath }
}

// ── proposals ─────────────────────────────────────────────────────────────────

export async function listProposals(
  accountId: string,
  status = 'pending',
): Promise<ProposalRow[]> {
  const { data, error } = await supabaseService()
    .from('content_skill_edit_proposals')
    .select(
      'id, skill_id, skill_file_id, path, proposed_content, base_version, change_type, rationale, status, created_at, resolved_at',
    )
    .eq('account_id', accountId)
    .eq('status', status)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`listProposals failed: ${error.message}`)
  return (data ?? []) as ProposalRow[]
}

export async function getProposal(
  accountId: string,
  proposalId: string,
): Promise<ProposalRow | null> {
  const { data, error } = await supabaseService()
    .from('content_skill_edit_proposals')
    .select(
      'id, skill_id, skill_file_id, path, proposed_content, base_version, change_type, rationale, status, created_at, resolved_at',
    )
    .eq('account_id', accountId)
    .eq('id', proposalId)
    .maybeSingle()
  if (error) throw new Error(`getProposal failed: ${error.message}`)
  return (data as ProposalRow | null) ?? null
}

/** Apply a pending proposal: overwrite the file, version it, mark approved. */
export async function approveProposal(
  accountId: string,
  proposalId: string,
): Promise<void> {
  const proposal = await getProposal(accountId, proposalId)
  if (!proposal) throw new Error('proposal not found')
  if (proposal.status !== 'pending') throw new Error('proposal already resolved')

  const svc = supabaseService()

  if (proposal.skill_file_id) {
    const { data: file, error: fErr } = await svc
      .from('content_skill_files')
      .select('id, path, version')
      .eq('account_id', accountId)
      .eq('id', proposal.skill_file_id)
      .single()
    if (fErr || !file) throw new Error(`approveProposal file lookup failed: ${fErr?.message}`)
    const nextVersion = (file.version as number) + 1
    const { error: uErr } = await svc
      .from('content_skill_files')
      .update({
        content: proposal.proposed_content,
        version: nextVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposal.skill_file_id)
      .eq('account_id', accountId)
    if (uErr) throw new Error(`approveProposal update failed: ${uErr.message}`)
    await recordVersion(
      accountId,
      {
        id: proposal.skill_file_id,
        path: proposal.path,
        content: proposal.proposed_content,
        version: nextVersion,
      },
      'overwrite',
      'agent',
    )
  } else {
    // Proposal targeted a not-yet-existing file → create it.
    const { data: skill } = await svc
      .from('content_skills')
      .select('slug')
      .eq('account_id', accountId)
      .eq('id', proposal.skill_id)
      .single()
    if (skill) {
      await createSkillFile(
        accountId,
        skill.slug as string,
        proposal.path,
        proposal.proposed_content,
      )
    }
  }

  const { error: pErr } = await svc
    .from('content_skill_edit_proposals')
    .update({ status: 'approved', resolved_at: new Date().toISOString() })
    .eq('id', proposalId)
    .eq('account_id', accountId)
  if (pErr) throw new Error(`approveProposal resolve failed: ${pErr.message}`)
}

export async function rejectProposal(
  accountId: string,
  proposalId: string,
): Promise<void> {
  const { error } = await supabaseService()
    .from('content_skill_edit_proposals')
    .update({ status: 'rejected', resolved_at: new Date().toISOString() })
    .eq('id', proposalId)
    .eq('account_id', accountId)
    .eq('status', 'pending')
  if (error) throw new Error(`rejectProposal failed: ${error.message}`)
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
 * model knows what exists and can pull the full SKILL.md + references on demand.
 */
export async function buildSkillsIndexNote(accountId: string): Promise<string> {
  const skills = await listSkills(accountId)
  if (skills.length === 0) {
    return 'AVAILABLE SKILLS: (none yet). You can create one with create_skill.'
  }
  const lines = skills.map(
    (s) => `- ${s.slug}: ${s.description ?? s.name}`,
  )
  return `AVAILABLE SKILLS (call read_skill with the slug to open one, then read_skill_file for its references before writing):\n${lines.join('\n')}`
}
