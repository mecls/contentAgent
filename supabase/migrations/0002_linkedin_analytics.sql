-- contentAgent: weekly LinkedIn analytics via Apify.
--
-- Two changes that let the weekly scrape feed real engagement back into posts:
--   1. A unique key on content_scraped_posts so re-scraping the same post each
--      week UPDATES its row (idempotent upsert) instead of inserting duplicates.
--   2. A linkedin_url column on content_posts so a published post can be matched
--      to its scraped counterpart EXACTLY (scraped.source_url == posts.linkedin_url),
--      making the metric write deterministic rather than a fuzzy text match.
--
-- RLS: both tables already enable RLS + the tenant_read policy in 0001; these
-- changes add no new columns that need separate policies (the policy covers all
-- columns of the row), so no policy work is required here.

-- 1. Idempotent upsert key for scraped posts.
create unique index if not exists content_scraped_posts_account_source_url_uq
  on public.content_scraped_posts(account_id, source_url);

-- 2. Exact-match key: the LinkedIn URL of a published post (nullable, no backfill).
alter table public.content_posts
  add column if not exists linkedin_url text;
