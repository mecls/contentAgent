# How the Agent Improves Itself

A plain-language guide to how the Miraside Content agent learns over time and
safely updates its own instructions ("skills").

---

## The one-sentence version

The agent's knowledge lives in **editable markdown files** (called *skills*).
The agent can **read** those files to do its job, and **write back** to them to
record what it learns — with safe additions applied instantly and risky rewrites
held for your approval.

That feedback loop is what makes it get better the more you use it.

---

## The mental model

Think of a skill as a **living playbook** stored in the database:

```
miguel-linkedin-content/            ← a skill (one playbook)
├── SKILL.md                        ← the main instructions + index
└── references/
    ├── audience-and-data.md        ← who the audience is, real numbers
    ├── post-archetypes.md          ← the post types that work
    ├── honest-constraints.md       ← hard "never do this" rules
    ├── tactical-execution.md       ← timing, cadence, mechanics
    └── improvement-log.md          ← running record of real results ← grows over time
```

Each file is **versioned** — every change is saved as a new version, so nothing
is ever truly lost and any change can be rolled back.

> **Where it lives:** the playbook ships in the repo under `seed/skills/`, but on
> your first login it's copied into the database (one private copy per account).
> From then on the agent reads and edits *your* database copy — the repo copy
> stays a clean starting template. See `lib/skills/seed.ts`.

---

## How the agent uses a skill (the read path)

Every time it drafts, edits, critiques, or plans content, the agent follows a
"open the book before you write" rule, built into its system prompt:

1. **See what's available.** Each turn, a short list of skills (name + description)
   is injected automatically, so the agent always knows what playbooks exist.
2. **Open the right one** → `read_skill` returns the `SKILL.md` plus a list of its
   reference files.
3. **Read the references it needs** → `read_skill_file`, especially the
   constraints file ("where the most damage happens").
4. **Only then write**, following the playbook's patterns and rules.

This "load only what you need, when you need it" approach is called *progressive
disclosure* — it keeps the agent focused and its context small.

---

## How the agent improves a skill (the write path)

This is the heart of self-improvement. The agent can edit its own playbook, but
**not all edits carry the same risk**, so they're handled differently. The
governing rule is **"add, don't overwrite."**

| What the agent does | Tool | Applied… | Why it's safe |
|---|---|---|---|
| Add new notes to the end of a file (e.g. log a result, record a proven pattern) | `append_skill_file` | **Instantly** | Only adds — never deletes existing guidance |
| Add a brand-new reference file | `create_skill_file` | **Instantly** | Adds, doesn't destroy (fails if the file already exists) |
| Create a whole new skill | `create_skill` | **Instantly** | Nothing existing is touched |
| **Rewrite** an existing, non-empty file | `propose_skill_overwrite` | **Only after you approve** | Replacing working guidance is risky — a human checks first |

So additive learning happens **automatically and immediately**, while anything
that could erase good guidance becomes a **pending proposal** you review in the
Skills page or as a card in chat. (Logic lives in `lib/skills/store.ts`.)

---

## The improvement loop (how it actually gets smarter)

The agent doesn't improve in the abstract — it improves by feeding **real
results** back into the playbook:

```
   ┌─────────────────────────────────────────────────────────┐
   │                                                         │
   ▼                                                         │
1. Agent drafts a post using the skill        → save_post    │
2. You publish it and share the real numbers  → update_post_metrics
3. Agent logs the result + a one-line lesson  → append_skill_file
   into references/improvement-log.md  (applied instantly)   │
4. After enough entries, patterns emerge:                    │
   • new winning pattern  → append it (instant)              │
   • old guidance is wrong → propose_skill_overwrite (you approve)
                                                             │
   └──────────────  the playbook is now sharper  ────────────┘
```

Over time the `improvement-log.md` accumulates real performance data, so the
skill's advice and predictions get measurably more accurate — the file itself
even states the goal: *"After 6 months of entries here, the skill will be
significantly more accurate than it is today."*

---

## Safety: nothing changes silently or dangerously

Three guardrails keep self-editing trustworthy:

- **Human approval for rewrites.** Overwriting existing guidance never takes
  effect until you approve the proposal (approve/reject in `app/actions/skills.ts`).
- **Full version history + rollback.** Every applied change writes an immutable
  version row. You can roll any file back to an earlier version at any time.
- **Strict tenancy + injection defense.** Every read and write is scoped to your
  account on the server (the model can't change whose data it touches), and skill
  contents are always treated as *data*, never as new instructions to the agent.

---

## The pieces, and where to find them

| Piece | What it does | File |
|---|---|---|
| **Skill store** | Reads/writes/versions skills; enforces append-vs-propose rule | `lib/skills/store.ts` |
| **Tool definitions** | The verbs the agent can call (read/append/propose/…) | `lib/agent/tools.ts` |
| **Tool dispatcher** | Runs each tool, account-scoped; emits UI cards | `lib/agent/run-scoped-tool.ts` |
| **Agent loop** | Multi-turn reason→call-tools→read-results loop | `lib/agent/agent-loop.ts` |
| **System prompt** | Teaches the read rule + the improvement loop | `lib/agent/system-prompt.ts` |
| **Seeder** | Imports the starter playbook into your account once | `lib/skills/seed.ts` |
| **Approvals UI** | Approve/reject proposals, roll back versions | `app/actions/skills.ts`, `app/app/skills/page.tsx` |
| **Database** | `content_skills`, `content_skill_files`, `content_skill_file_versions`, `content_skill_edit_proposals` | `supabase/migrations/0001_content_agent.sql` |

---

## TL;DR

- Skills are **versioned markdown playbooks** the agent reads before working.
- The agent **learns by appending real results and proven patterns** — applied
  instantly because adding is safe.
- **Rewrites of existing guidance require your approval**, and everything is
  versioned and rollback-able.
- The loop — *draft → measure → log the lesson → refine* — is what makes the
  agent sharper every week.
