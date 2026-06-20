-- contentAgent: proactive content engine.
--
-- Four tables that let the agent gather outside signal and turn it into
-- ready-to-pick post ideas:
--   - content_research_items   : daily web/reddit/x/linkedin research (summaries)
--   - content_competitors      : the user-curated list of LinkedIn creators to study
--   - content_competitor_posts : their scraped posts + LLM-extracted features
--   - content_post_ideas       : generated ideas the user selects to draft
--
-- Same tenancy conventions as 0001: account_id FK, RLS enabled, tenant_read
-- select policy via app.account_ids_for_current_user(); all writes go through the
-- service-role client which re-checks account_id in application code.

-- ── daily research ────────────────────────────────────────────────────────────
create table public.content_research_items (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.accounts(id) on delete cascade,
  source       text not null,            -- 'web' | 'reddit' | 'x' | 'linkedin'
  topic        text,                     -- the pillar/query this came from
  title        text,
  url          text not null,
  summary      text,
  key_points   jsonb not null default '[]'::jsonb,
  author       text,
  score        numeric,                  -- engagement/relevance signal (source-specific)
  published_at timestamptz,
  fetched_at   timestamptz not null default now()
);
create unique index content_research_items_account_url_uq
  on public.content_research_items(account_id, url);
create index content_research_items_account_fetched_idx
  on public.content_research_items(account_id, fetched_at desc);

-- ── competitor seed list ──────────────────────────────────────────────────────
create table public.content_competitors (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.accounts(id) on delete cascade,
  profile_url text not null,
  name        text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index content_competitors_account_url_uq
  on public.content_competitors(account_id, profile_url);

-- ── competitor posts + extracted features ─────────────────────────────────────
create table public.content_competitor_posts (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.accounts(id) on delete cascade,
  competitor_id uuid references public.content_competitors(id) on delete cascade,
  source_url    text not null,
  content       text,
  posted_at     timestamptz,
  metrics       jsonb not null default '{}'::jsonb,   -- {reactions, comments, reposts}
  features      jsonb not null default '{}'::jsonb,   -- {hook, tone, structure, topic, cta, voice, format, ...}
  scraped_at    timestamptz not null default now()
);
create unique index content_competitor_posts_account_url_uq
  on public.content_competitor_posts(account_id, source_url);
create index content_competitor_posts_account_competitor_idx
  on public.content_competitor_posts(account_id, competitor_id);

-- ── generated post ideas ──────────────────────────────────────────────────────
create table public.content_post_ideas (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  topic      text not null,
  angle      text,
  structure  text,                       -- suggested archetype/structure
  hook       text,
  rationale  text,
  sources    jsonb not null default '[]'::jsonb,   -- refs to research/competitor items
  status     text not null default 'pending',      -- 'pending' | 'written' | 'dismissed'
  post_id    uuid references public.content_posts(id) on delete set null,
  created_at timestamptz not null default now()
);
create index content_post_ideas_account_status_idx
  on public.content_post_ideas(account_id, status, created_at desc);

-- ── RLS: tenant-scoped reads; writes via service-role only ────────────────────
alter table public.content_research_items   enable row level security;
alter table public.content_competitors      enable row level security;
alter table public.content_competitor_posts enable row level security;
alter table public.content_post_ideas       enable row level security;

create policy tenant_read on public.content_research_items
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));
create policy tenant_read on public.content_competitors
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));
create policy tenant_read on public.content_competitor_posts
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));
create policy tenant_read on public.content_post_ideas
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));
