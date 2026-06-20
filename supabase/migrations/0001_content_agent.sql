-- contentAgent schema.
--
-- Runs on the SAME Supabase project as EmailAgent, so every table is namespaced
-- `content_*` to avoid colliding with EmailAgent's tables (it already owns
-- `messages`, `threads`, `briefs`, etc.). We REUSE the shared tenancy tables
-- (`accounts`, `account_members`, `config`) and the existing RLS helper
-- `app.account_ids_for_current_user()` created by EmailAgent's 0002_tenancy.sql.
--
-- Tenancy pattern (identical to EmailAgent): RLS `select` for authenticated users
-- scoped to their account; all writes go through the service-role client, which
-- bypasses RLS and re-checks `account_id` in application code.

-- ── skills ───────────────────────────────────────────────────────────────────
create table public.content_skills (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.accounts(id) on delete cascade,
  slug        text not null,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (account_id, slug)
);
create index content_skills_account_idx on public.content_skills(account_id);

-- Individual files inside a skill (SKILL.md + references/*.md). Progressive
-- disclosure maps onto these rows; the agent reads them on demand.
create table public.content_skill_files (
  id         uuid primary key default gen_random_uuid(),
  skill_id   uuid not null references public.content_skills(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  path       text not null,            -- e.g. 'SKILL.md', 'references/audience-and-data.md'
  content    text not null default '',
  version    int  not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (skill_id, path)
);
create index content_skill_files_account_skill_idx
  on public.content_skill_files(account_id, skill_id);

-- Append-only audit trail of every edit (self-improvement history + rollback).
create table public.content_skill_file_versions (
  id            uuid primary key default gen_random_uuid(),
  skill_file_id uuid not null references public.content_skill_files(id) on delete cascade,
  account_id    uuid not null references public.accounts(id) on delete cascade,
  path          text not null,
  content       text not null,
  version       int  not null,
  change_type   text not null,         -- append | overwrite | create | rollback
  author        text not null default 'agent',  -- agent | user
  created_at    timestamptz not null default now()
);
create index content_skill_file_versions_file_idx
  on public.content_skill_file_versions(skill_file_id, version desc);

-- Pending self-edits that require human approval (overwrite/delete of existing
-- content). Appends bypass this; overwrites land here until approved.
create table public.content_skill_edit_proposals (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references public.accounts(id) on delete cascade,
  skill_id         uuid not null references public.content_skills(id) on delete cascade,
  skill_file_id    uuid references public.content_skill_files(id) on delete cascade,
  path             text not null,
  proposed_content text not null,
  base_version     int,
  change_type      text not null default 'overwrite',
  rationale        text,
  status           text not null default 'pending',  -- pending | approved | rejected
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);
create index content_skill_proposals_account_status_idx
  on public.content_skill_edit_proposals(account_id, status, created_at desc);

-- ── chat ─────────────────────────────────────────────────────────────────────
create table public.content_conversations (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  title      text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_conversations_account_idx
  on public.content_conversations(account_id, updated_at desc);

create table public.content_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.content_conversations(id) on delete cascade,
  account_id      uuid not null references public.accounts(id) on delete cascade,
  role            text not null,       -- user | assistant
  content         text not null default '',
  reasoning       text,
  tool_calls      jsonb,
  created_at      timestamptz not null default now()
);
create index content_messages_conversation_idx
  on public.content_messages(conversation_id, created_at);

-- ── posts ────────────────────────────────────────────────────────────────────
create table public.content_posts (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references public.accounts(id) on delete cascade,
  conversation_id uuid references public.content_conversations(id) on delete set null,
  hook            text,
  body            text not null,
  archetype       text,
  status          text not null default 'draft',  -- draft | approved | posted
  skill_slug      text,
  metrics         jsonb not null default '{}'::jsonb,  -- {impressions,reactions,comments,engagement_rate}
  source          text not null default 'agent',  -- agent | user
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  posted_at       timestamptz
);
create index content_posts_account_idx
  on public.content_posts(account_id, created_at desc);

-- ── integrations (Phase 2 — Apify; schema now, scraping later) ────────────────
create table public.content_integrations (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  provider   text not null default 'apify',
  name       text not null,
  actor_id   text,
  config     jsonb not null default '{}'::jsonb,
  status     text not null default 'inactive',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_integrations_account_idx
  on public.content_integrations(account_id);

create table public.content_scraped_posts (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references public.accounts(id) on delete cascade,
  integration_id uuid references public.content_integrations(id) on delete cascade,
  source_url     text,
  author         text,
  content        text,
  metrics        jsonb not null default '{}'::jsonb,
  scraped_at     timestamptz not null default now()
);
create index content_scraped_posts_account_idx
  on public.content_scraped_posts(account_id, integration_id);

-- ── RLS: tenant-scoped reads; writes via service-role only ───────────────────
alter table public.content_skills               enable row level security;
alter table public.content_skill_files          enable row level security;
alter table public.content_skill_file_versions  enable row level security;
alter table public.content_skill_edit_proposals enable row level security;
alter table public.content_conversations        enable row level security;
alter table public.content_messages             enable row level security;
alter table public.content_posts                enable row level security;
alter table public.content_integrations         enable row level security;
alter table public.content_scraped_posts        enable row level security;

create policy tenant_read on public.content_skills
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));

create policy tenant_read on public.content_skill_files
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));

create policy tenant_read on public.content_skill_file_versions
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));

create policy tenant_read on public.content_skill_edit_proposals
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));

create policy tenant_read on public.content_conversations
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));

create policy tenant_read on public.content_messages
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));

create policy tenant_read on public.content_posts
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));

create policy tenant_read on public.content_integrations
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));

create policy tenant_read on public.content_scraped_posts
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));
