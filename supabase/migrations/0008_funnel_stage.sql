-- contentAgent: which funnel stage a post serves.
--
-- Every post written from now on belongs to one of three stages: tofu (reach people who
-- have never heard of us), mofu (show it works for a business like theirs), bofu (give
-- someone ready to decide a reason to call). The app balances them 60/30/10 over a
-- rolling window, so the value has to be readable per post and countable per week.
--
-- Nullable on purpose, and NOT backfilled. The posts that already exist — including
-- every LinkedIn post imported by lib/integrations/sync-posts.ts, which sets no
-- archetype, format or tags either — were never written against a stage. Guessing one
-- would poison the very mix this column exists to measure, so they stay null and are
-- skipped, the way formatPerformance already skips posts with no format.
--
-- No RLS change needed: content_posts already has the tenant_read policy from 0001, and
-- every write goes through the service-role client, which re-checks account_id in
-- application code.

alter table public.content_posts
  add column funnel_stage text
    check (funnel_stage is null or funnel_stage in ('tofu', 'mofu', 'bofu'));
