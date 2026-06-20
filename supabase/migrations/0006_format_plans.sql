-- contentAgent: format axis + weekly content plans.
--
-- Adds the structural FORMAT dimension (carousel / short text / poll / reel …)
-- on top of the existing topic axis (tags) and narrative axis (archetype), plus
-- a weekly content plan that bundles N ideas — each assigned a format + a day —
-- so the agent can recommend a balanced *combination* of posts, not just topics.
--
-- Same tenancy conventions as 0001/0005: account_id FK, RLS enabled, tenant_read
-- select policy via app.account_ids_for_current_user(); all writes go through the
-- service-role client which re-checks account_id in application code. Competitor
-- format classification lives inside the existing content_competitor_posts.features
-- JSONB (features.format_key) — no column needed for that.

-- ── own posts: the structural format used (normalized catalog key) ────────────
alter table public.content_posts
  add column format text;

-- ── weekly content plans ──────────────────────────────────────────────────────
create table public.content_content_plans (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.accounts(id) on delete cascade,
  platform     text not null default 'linkedin',
  horizon_days integer,
  summary      text,                                  -- LLM rationale for the mix
  trends       jsonb not null default '[]'::jsonb,    -- FormatTrend[] snapshot used
  created_at   timestamptz not null default now()
);
create index content_content_plans_account_created_idx
  on public.content_content_plans(account_id, created_at desc);

-- ── ideas gain a format + platform + planned day + plan grouping ──────────────
alter table public.content_post_ideas
  add column format      text,
  add column platform    text,
  add column planned_for date,
  add column plan_id      uuid references public.content_content_plans(id) on delete set null;
create index content_post_ideas_account_plan_idx
  on public.content_post_ideas(account_id, plan_id);

-- ── RLS: tenant-scoped reads; writes via service-role only ────────────────────
alter table public.content_content_plans enable row level security;
create policy tenant_read on public.content_content_plans
  for select to authenticated
  using (account_id in (select app.account_ids_for_current_user()));
