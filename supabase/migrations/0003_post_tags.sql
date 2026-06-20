-- contentAgent: free-form keyword tags on posts.
--
-- Tags classify each post (topic + style keywords, e.g. "ai", "hiring",
-- "contrarian") so engagement can be compared across groups — basic A/B testing
-- of what content performs best. The agent assigns tags on save (reusing existing
-- ones for consistency); the user can edit them in the Posts UI.
--
-- RLS: content_posts already enables RLS + the tenant_read policy in 0001; adding
-- a column needs no new policy (the policy covers all columns), so none here.

-- A keyword array per post; empty by default, no backfill needed.
alter table public.content_posts
  add column if not exists tags text[] not null default '{}';

-- GIN index so filtering/aggregating by tag (tags @> '{ai}') stays fast.
create index if not exists content_posts_tags_idx
  on public.content_posts using gin (tags);
