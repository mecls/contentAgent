-- contentAgent: where a research item came from.
--
-- Two writers share content_research_items: the daily research run, which follows
-- the creator's research focus, and the chat's search_news tool, which follows
-- whatever post is being drafted. Choose and the chat's list_research read only
-- the daily run. They used to read the newest items of both, and a few
-- fact-checking searches for one post were enough to fill the whole list with that
-- one subject. The Research page still shows both.

alter table public.content_research_items
  add column origin text not null default 'daily'
    check (origin in ('daily', 'chat'));

-- Backfill. A daily run stores its Hacker News / LinkedIn / Reddit / X items in
-- the same write as its web results; a chat search stores web results only. So a
-- web row with no other-source row within two minutes came from a chat search.
update public.content_research_items r
set origin = 'chat'
where r.source = 'web'
  and not exists (
    select 1
    from public.content_research_items d
    where d.account_id = r.account_id
      and d.source <> 'web'
      and d.fetched_at between r.fetched_at - interval '2 minutes'
                           and r.fetched_at + interval '2 minutes'
  );
