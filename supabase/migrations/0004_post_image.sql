-- contentAgent: the creative/image attached to a post.
--
-- Stores the URL of the image used in a post so it can be shown as a thumbnail in
-- the Posts table/cards — making posts recognizable at a glance. For published
-- posts the weekly LinkedIn scrape captures it automatically; for drafts the user
-- can paste an image URL in the Posts UI.
--
-- RLS: content_posts already enables RLS + the tenant_read policy in 0001; adding
-- a column needs no new policy (the policy covers all columns), so none here.

alter table public.content_posts
  add column if not exists image_url text;
