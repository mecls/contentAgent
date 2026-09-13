# How the Skill Works

A plain-language guide to how the Miraside Content agent uses its skill — and why
it can no longer change it.

---

## The one-sentence version

The agent's knowledge of the creator lives in **one markdown file per skill,
`SKILL.md`**. The agent **reads** it before every draft and **cannot change it**.
Only you edit it, on the **Skills** page.

---

## Why it's read-only

Until 2026-09-13 the agent could append to its skill, create new skill files and
propose rewrites. Over a few weeks it rewrote `SKILL.md` again and again, bolted
four planning frameworks on as new files, and copied a scraped creator's CTAs into
a voice file that outranked the honesty rules. 47 of the 49 recorded edits were
the agent's, and the approval step approved 12 proposals out of 12. So the write
tools were removed.

## How the agent uses the skill

1. Each turn, a short list of skills (slug + description) is injected.
2. The agent calls `read_skill`, which returns that skill's `SKILL.md` — the whole
   skill.
3. It hands the voice and constraints from `SKILL.md` to the writer model through
   `write_content`, then saves the post.

## How the skill changes

- **You edit it** on the Skills page. Every save creates a new version, and any
  version can be restored.
- **Chat corrections aren't remembered** unless you add them. Tell the agent
  "never use the word unlock" and it will say it can't keep that, and give you the
  exact line to paste into `SKILL.md`.
- **The weekly review** (Monday cron) writes post metrics and a summary chat only.
  It never touches the skill.

## Where the pieces live

| Piece | File |
|---|---|
| Skill store: reads, human writes, versions, the one-file guard | `lib/skills/store.ts` |
| Agent tools (the skill tools are read-only) | `lib/agent/tools.ts`, `lib/agent/run-scoped-tool.ts` |
| System prompt | `lib/agent/system-prompt.ts` |
| Skills page: edit, history, restore | `app/app/skills/page.tsx`, `components/skills/skill-file-row.tsx` |
| Database | `content_skills`, `content_skill_files`, `content_skill_file_versions` (`supabase/migrations/0001_content_agent.sql`) |
