// One-off data step: give a skill a new SKILL.md and collapse every skill to that
// single file.
//
// Dry run by default: guard → backup → print what would change, writing nothing
// to the database. Only --apply writes. Run it after the read-only code is
// deployed, so nothing can re-create a reference file afterwards.
//
//   node --env-file=.env.local scripts/collapse-skills.mjs \
//     --skill-id <uuid> --seed <path/to/SKILL.md> --name <skill-slug> \
//     [--require <text the file must contain>] [--backup <path.json>] [--apply]
//
// The seed file and the backup hold personal content: keep both outside git
// (the default backup path is under the gitignored private/ folder). Each run
// writes a new timestamped backup and refuses to overwrite an existing file.
//
// Deleting a file row cascades to its version rows AND to any
// content_skill_edit_proposals rows that point at it (both FKs are on delete
// cascade), so the backup is the only copy of those rows afterwards.
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const SKILL_FILE = 'SKILL.md'
const TABLES = [
  'content_skills',
  'content_skill_files',
  'content_skill_file_versions',
  'content_skill_edit_proposals',
]
const PAGE = 1000

const log = (msg) => console.log(`[collapse] ${msg}`)

function die(msg) {
  log(msg)
  process.exit(1)
}

async function step(name, fn) {
  try {
    return await fn()
  } catch (e) {
    die(`any failure in ${name}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ── arguments ──────────────────────────────────────────────────────────────────
const USAGE =
  'usage: node --env-file=.env.local scripts/collapse-skills.mjs --skill-id <uuid> --seed <SKILL.md path> --name <skill-slug> [--require <text>] [--backup <path>] [--apply]'

function parseArgs(argv) {
  const out = { apply: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--apply') {
      out.apply = true
    } else if (['--skill-id', '--seed', '--name', '--require', '--backup'].includes(arg)) {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) die(`usage error: ${arg} needs a value. ${USAGE}`)
      out[arg.slice(2)] = value
      i++
    } else {
      die(`usage error: unexpected argument ${arg}. ${USAGE}`)
    }
  }
  for (const required of ['skill-id', 'seed', 'name']) {
    if (!out[required]) die(`usage error: --${required} is required. ${USAGE}`)
  }
  // One file per run, never overwritten: a re-run must not replace the backup taken
  // before an earlier --apply.
  out.backup ??= `private/archive/skills-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  return out
}

const args = parseArgs(process.argv.slice(2))
const APPLY = args.apply
const SKILL_ID = args['skill-id']

// ── guard: runs before any network call ────────────────────────────────────────
async function guard() {
  let seed
  try {
    seed = await fs.readFile(args.seed, 'utf8')
  } catch (e) {
    die(`guard failed: cannot read ${args.seed}: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!seed.startsWith('---')) die(`guard failed: ${args.seed} does not start with frontmatter (---)`)
  const fm = seed.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!fm) die(`guard failed: ${args.seed} has no closing frontmatter (---)`)
  const name = fm[1].match(/^name:\s*(.+)$/m)?.[1].trim()
  if (name !== args.name) {
    die(`guard failed: frontmatter name is ${JSON.stringify(name ?? null)}, expected ${args.name}`)
  }
  if (args.require && !seed.includes(args.require)) {
    die(`guard failed: ${args.seed} does not contain "${args.require}"`)
  }
  // Single-line `description:`, the same shape onboarding writes.
  const description = fm[1].match(/^description:\s*(.+)$/m)?.[1].trim() ?? ''
  if (!description) die('guard failed: frontmatter has no single-line description')
  log(`guard ok: ${args.seed} (${Buffer.byteLength(seed)} bytes)`)
  return { seed, description }
}

// ── database helpers ───────────────────────────────────────────────────────────
function connect() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    die('any failure in setup: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (use --env-file=.env.local)')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

async function selectAll(db, table) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(table)
      .select('*')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) return rows
  }
}

async function countRows(db, table) {
  const { count, error } = await db.from(table).select('id', { count: 'exact', head: true })
  if (error) throw new Error(`${table}: ${error.message}`)
  return count
}

// ── backup: verified before anything could be deleted ──────────────────────────
async function backup(db) {
  const tables = {}
  for (const t of TABLES) tables[t] = await selectAll(db, t)
  await fs.mkdir(path.dirname(args.backup), { recursive: true })
  // 'wx' fails if the file exists, so an explicit --backup path can't clobber an older backup either.
  await fs.writeFile(args.backup, JSON.stringify({ taken_at: new Date().toISOString(), tables }, null, 2), {
    flag: 'wx',
  })

  const reread = JSON.parse(await fs.readFile(args.backup, 'utf8'))
  const counts = {}
  for (const t of TABLES) {
    const inFile = reread.tables[t].length
    const inDb = await countRows(db, t)
    if (inFile !== inDb) die(`backup mismatch: ${t} file=${inFile} db=${inDb}`)
    counts[t] = inDb
  }
  log(
    `backup verified: skills=${counts.content_skills} files=${counts.content_skill_files} ` +
      `versions=${counts.content_skill_file_versions} proposals=${counts.content_skill_edit_proposals} -> ${args.backup}`,
  )
}

// ── port: the skill's SKILL.md becomes the seed file, as a user-authored version ──
async function port(db, { seed, description }) {
  const { data: file, error } = await db
    .from('content_skill_files')
    .select('id, account_id, version, content')
    .eq('skill_id', SKILL_ID)
    .eq('path', SKILL_FILE)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!file) throw new Error(`no ${SKILL_FILE} row for skill ${SKILL_ID}`)

  if (file.content === seed) {
    // A previous --apply may have updated the file but died before the version row.
    const { data: ver, error: verErr } = await db
      .from('content_skill_file_versions')
      .select('id')
      .eq('skill_file_id', file.id)
      .eq('version', file.version)
      .maybeSingle()
    if (verErr) throw new Error(verErr.message)
    if (ver) {
      log(`port: ${SKILL_ID} ${SKILL_FILE} already ported`)
      return
    }
    if (!APPLY) {
      log(`port: ${SKILL_ID} ${SKILL_FILE} already ported, v${file.version} version row missing (dry run)`)
      return
    }
    await insertVersion(db, file, seed, file.version)
    log(`port: ${SKILL_ID} ${SKILL_FILE} already ported, added missing v${file.version} version row`)
    return
  }

  const next = file.version + 1
  if (!APPLY) {
    log(`port: ${SKILL_ID} ${SKILL_FILE} v${file.version} -> v${next} (dry run)`)
    return
  }
  const { error: updErr } = await db
    .from('content_skill_files')
    .update({ content: seed, version: next, updated_at: new Date().toISOString() })
    .eq('id', file.id)
    .eq('account_id', file.account_id)
  if (updErr) throw new Error(updErr.message)
  await insertVersion(db, file, seed, next)
  const { error: skillErr } = await db
    .from('content_skills')
    .update({ description, updated_at: new Date().toISOString() })
    .eq('id', SKILL_ID)
    .eq('account_id', file.account_id)
  if (skillErr) throw new Error(skillErr.message)
  log(`port: ${SKILL_ID} ${SKILL_FILE} v${file.version} -> v${next}`)
}

// Same row shape as recordVersion in lib/skills/store.ts.
async function insertVersion(db, file, content, version) {
  const { error } = await db.from('content_skill_file_versions').insert({
    skill_file_id: file.id,
    account_id: file.account_id,
    path: SKILL_FILE,
    content,
    version,
    change_type: 'overwrite',
    author: 'user',
  })
  if (error) throw new Error(error.message)
}

// ── collapse: every skill keeps only SKILL.md ──────────────────────────────────
async function collapse(db) {
  const { data: skills, error } = await db.from('content_skills').select('id').order('created_at')
  if (error) throw new Error(error.message)
  const verb = APPLY ? 'deleted' : 'would delete'

  for (const s of skills) {
    const { data: keep, error: keepErr } = await db
      .from('content_skill_files')
      .select('id')
      .eq('skill_id', s.id)
      .eq('path', SKILL_FILE)
      .maybeSingle()
    if (keepErr) throw new Error(keepErr.message)
    if (!keep) throw new Error(`skill ${s.id} has no ${SKILL_FILE}; refusing to collapse it`)

    const { data: rows, error: rowsErr } = await db
      .from('content_skill_files')
      .select('path')
      .eq('skill_id', s.id)
      .neq('path', SKILL_FILE)
      .order('path')
    if (rowsErr) throw new Error(rowsErr.message)
    if (rows.length === 0) {
      log(`collapse: ${s.id} ${verb} 0 rows`)
      continue
    }
    if (APPLY) {
      const { error: delErr } = await db
        .from('content_skill_files')
        .delete()
        .eq('skill_id', s.id)
        .neq('path', SKILL_FILE)
      if (delErr) throw new Error(delErr.message)
    }
    log(`collapse: ${s.id} ${verb} ${rows.length} rows: ${rows.map((r) => r.path).join(', ')}`)
  }
}

async function final(db) {
  const files = await countRows(db, 'content_skill_files')
  const versions = await countRows(db, 'content_skill_file_versions')
  log(`final: files=${files} versions=${versions}${APPLY ? '' : ' (dry run, nothing written)'}`)
}

const seedInfo = await guard()
const db = connect()
await step('backup', () => backup(db))
await step('port', () => port(db, seedInfo))
await step('collapse', () => collapse(db))
await step('final', () => final(db))
