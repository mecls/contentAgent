# contentAgent — setup

Miraside's content agent: a ChatGPT-style studio that drafts, critiques, and
plans LinkedIn content using a versioned **skill**, and **self-improves** by
updating that skill over time. Built on Next.js 16 + Supabase, with an
open-source model served via **Ollama Cloud** (OpenAI-compatible).

## 1. Install

```bash
cd contentAgent
npm install
```

## 2. Environment

`.env.local` is already populated (shared Supabase + Ollama Cloud key). Key vars:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — shared Supabase (same project as EmailAgent).
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — service role (server only).
- `LLM_BASE_URL=https://ollama.com/v1`, `LLM_API_KEY`, `LLM_MODEL=gpt-oss:120b` — the agent model (must support tool calling).

## 3. Apply the database migration

The app shares EmailAgent's Supabase project and reuses its tenancy tables
(`accounts`, `account_members`, `config`) and the `app.account_ids_for_current_user()`
RLS helper. It adds its own `content_*` tables.

Apply `supabase/migrations/0001_content_agent.sql` once — via the Supabase
dashboard **SQL editor** (paste + run), or the Supabase CLI:

```bash
supabase db push   # if the project is linked
```

## 4. Auth: disable email confirmation (internal tool)

In the Supabase dashboard → **Authentication → Providers → Email**, turn **off**
"Confirm email" so sign-up logs you straight in. (If you leave it on, sign-up
sends a confirmation email and you sign in afterwards.)

## 5. Run

```bash
npm run dev
# http://localhost:3000
```

Sign up with email/password. On first sign-in your account is provisioned and the
`miguel-linkedin-content` skill is seeded into the DB from `seed/skills/`.

## How it works

- **Chat** (`/app`): streaming agent. Before writing, it reads the skill
  (`read_skill` → `read_skill_file`) and follows its constraints. Finished posts
  are saved via `save_post` and appear under **Posts**.
- **Self-improvement:** the agent **appends** lessons/patterns to the skill
  automatically (e.g. `references/improvement-log.md`). To **overwrite** existing
  guidance it raises a proposal you approve in chat or on the **Skills** page.
  Every change is versioned and restorable.
- **Posts** (`/app/posts`): the library. Edit, log real metrics, mark as posted.
- **Integrations** (`/app/integrations`): Apify scrapers — Phase 2 (stubbed).
- **Skills** (`/app/skills`): inspect skill files, version history, pending
  approvals; restore any prior version; export back to a `.skill` bundle.

## Phase 2 (planned)

Connect Apify to scrape top LinkedIn posts → store in `content_scraped_posts` →
an `analyze_against_ours` tool compares them to our posts and proposes skill
improvements.
