import Link from 'next/link'
import { Download, Plus, Wrench } from 'lucide-react'
import { requireAccountId } from '@/lib/auth/session'
import {
  listSkills,
  listSkillFiles,
  listFileVersions,
  listProposals,
} from '@/lib/skills/store'
import { SkillFileRow } from '@/components/skills/skill-file-row'
import { ProposalCard } from '@/components/skills/proposal-card'

export default async function SkillsPage() {
  const { accountId } = await requireAccountId()
  const skills = await listSkills(accountId)
  const proposals = await listProposals(accountId, 'pending')
  const slugById = new Map(skills.map((s) => [s.id, s.slug]))

  const skillBlocks = await Promise.all(
    skills.map(async (skill) => {
      const files = await listSkillFiles(accountId, skill.slug)
      const filesWithVersions = await Promise.all(
        files.map(async (f) => ({
          ...f,
          versions: await listFileVersions(accountId, f.id),
        })),
      )
      return { skill, files: filesWithVersions }
    }),
  )

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Skills</h1>
            <p className="mt-1 text-sm text-neutral-500">
              The skills the agent writes from — and how they evolve. Appends apply
              automatically; overwrites wait here for your approval.
            </p>
          </div>
          <Link
            href="/onboarding?force=1"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add a skill
          </Link>
        </header>

        {/* Pending proposals */}
        {proposals.length > 0 ? (
          <section className="mb-8">
            <h2 className="mb-2 text-sm font-medium text-neutral-900">
              Pending approvals ({proposals.length})
            </h2>
            <div className="flex flex-col gap-3">
              {proposals.map((p) => (
                <ProposalCard
                  key={p.id}
                  id={p.id}
                  slug={slugById.get(p.skill_id) ?? '?'}
                  path={p.path}
                  rationale={p.rationale ?? ''}
                  proposedContent={p.proposed_content}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* Skills + files */}
        {skillBlocks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">
              <Wrench className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-sm text-neutral-500">
              No skills seeded yet. They&rsquo;re created automatically on first
              sign-in.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {skillBlocks.map(({ skill, files }) => (
              <section
                key={skill.id}
                className="rounded-2xl border border-neutral-200 bg-white p-4"
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-neutral-900">
                      {skill.name}
                    </h2>
                    <p className="font-mono text-xs text-neutral-400">{skill.slug}</p>
                    {skill.description ? (
                      <p className="mt-1.5 line-clamp-3 text-sm text-neutral-500">
                        {skill.description}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={`/api/skills/export?slug=${skill.slug}`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)]"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Export .skill
                  </Link>
                </div>

                <div className="flex flex-col gap-1.5">
                  {files.map((f) => (
                    <SkillFileRow
                      key={f.id}
                      slug={skill.slug}
                      path={f.path}
                      version={f.version}
                      content={f.content}
                      versions={f.versions.map((v) => ({
                        id: v.id,
                        version: v.version,
                        change_type: v.change_type,
                        author: v.author,
                        created_at: v.created_at,
                      }))}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
