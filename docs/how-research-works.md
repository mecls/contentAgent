# How Research Works

A plain-language guide to how the Miraside Content agent finds fresh, *relevant*
things for you to post about — and how to control what it looks for.

---

## The one-sentence version

Every day the system searches the web (and Hacker News, and LinkedIn) for news on
**your specific topics**, throws away anything off-topic, and hands you a clean
feed of source material to draft posts from.

The trick to keeping it relevant is a small, **editable list of your topics** — the
*Research Focus* — that drives both *what it searches for* and *what it keeps*.

---

## The mental model

Think of it as a four-step funnel that runs once a day per account:

```
   ┌─────────────────┐
   │ 1. RESEARCH      │   your topics + things to avoid
   │    FOCUS         │   (auto-built from your skill + profile, editable)
   └────────┬─────────┘
            │ turns topics into search queries
            ▼
   ┌─────────────────┐
   │ 2. SEARCH        │   Exa (web/blogs) · Hacker News · LinkedIn
   │    SOURCES       │   all run in parallel
   └────────┬─────────┘
            │ raw items (some have no summary yet)
            ▼
   ┌─────────────────┐
   │ 3. ENRICH +      │   Jina reads articles to fill missing summaries
   │    FILTER        │   then an LLM drops anything off-niche
   └────────┬─────────┘
            │ only on-topic items
            ▼
   ┌─────────────────┐
   │ 4. STORE +       │   saved to your Research feed; also feeds
   │    USE           │   idea generation and "plan my week"
   └─────────────────┘
```

The whole thing lives in `lib/integrations/run-research.ts` —
`runResearchForAccount()` is the funnel from top to bottom.

---

## Step 1 — The Research Focus (the steering wheel)

This is the single source of truth for *what's relevant to you*. It's two short
lists:

- **Topics to research** — the specific subjects you post about
  (e.g. *"AI-driven client onboarding dashboards for real-estate brokerages"*).
- **Avoid (off-niche)** — adjacent themes to keep out
  (e.g. *"venture capital fundraising"*, *"consumer AI chatbots"*).

**Where it comes from:** the first time it's needed, the system **auto-builds** it
by reading your *skill* (audience, positioning, what's worked) plus your
onboarding *profile*, and asking the LLM for 5–8 concrete topics + a few
exclusions. That's `deriveResearchFocus()` in
`lib/integrations/research-focus.ts`. It's then saved so it's instant next time.

**You can edit it.** On the **Research** page there's a *Research focus* panel
where you can:

- **click any chip to edit** its text, ×-to-remove, or type to add
- hit **Save** (marks it as yours), or
- **Regenerate from profile** to rebuild it from scratch

> **Where it's stored:** in the shared `config` table under the key
> `research_focus` — no special database table needed. See
> `getResearchFocus` / `setResearchFocus` in `lib/db/profile.ts`.

The more precise your topics, the more relevant your feed — vague topics like
"AI" pull in vague results.

---

## Step 2 — The sources (all free except LinkedIn)

The focus topics get turned into search queries (`deriveResearchQueries()`), which
fan out to several sources **at the same time** (so the run is as fast as the
slowest source, not the sum of all of them):

| Source | What it gives | How | Cost |
|---|---|---|---|
| **Web / blogs** | News & articles with AI summaries | Exa (`lib/integrations/exa.ts`) | Free tier (20k/mo) |
| **Hacker News** | What the tech community is discussing | Algolia HN API (`lib/integrations/hackernews.ts`) | **Free, no key** |
| **LinkedIn** | Top-performing posts on your topics | Apify actor (`lib/integrations/apify-sources.ts`) | Paid (Apify) |

> We **removed the old paid Reddit and X scrapers** this session and replaced that
> "community signal" with the free Hacker News API. Each source is isolated — if
> one fails, the others still return (`Promise.allSettled`).

---

## Step 3 — Enrich, then filter

Two clean-up passes before anything is saved:

1. **Enrich missing summaries.** Some items (mainly Hacker News link posts) arrive
   as just a title + URL. **Jina Reader** (`https://r.jina.ai`) reads the linked
   article and extracts clean text to use as a summary — free, no key needed. See
   `enrichSummaries()` in `lib/integrations/jina.ts`. It's capped and best-effort:
   if a page can't be read, the item just keeps a blank summary.

2. **Drop off-niche items.** One batched LLM call (`filterRelevantItems()`) looks
   at every fetched item against your topics + exclusions and keeps only the ones
   that are genuinely useful for *your* posts. A typical run might keep ~22 of ~40.

> **Fail-open by design.** If your focus is empty, the LLM hiccups, or it somehow
> decides to keep nothing, the filter keeps **everything** rather than wipe a whole
> run. Relevance is improved aggressively, but never at the risk of an empty feed.

---

## Step 4 — Where the results show up

Filtered items are saved to your **Research** feed (`/app/research`), where you can
filter by source, search, and click **"Draft post in chat"** on any item.

The same fresh research also powers:

- **Idea generation** — the daily batch of post ideas is built from it.
- **"Plan my content for next week"** — that chat shortcut runs research first,
  then drafts a week of posts grounded in what it found.

---

## When does it run?

- **Automatically, once a day** — the cron at `app/api/cron/daily/route.ts`
  (research → then ideas) for every onboarded account.
- **On demand** — the **Run research now** button on the Research page.
- **Smart reuse** — on-demand flows (like "plan my week") call
  `runResearchIfStale()`, which **reuses** research from the last 24h instead of
  re-paying for a fresh run. Click twice in a row and the second is instant.

---

## What you need configured

| Thing | Needed? | Notes |
|---|---|---|
| `EXA_API_KEY` | For web search | Free tier covers ~20k searches/month |
| `APIFY_TOKEN` | For the LinkedIn source | Paid |
| `JINA_API_KEY` | **Optional** | Jina works with no key (rate-limited); a key just raises the limit |
| Hacker News | Nothing | Fully free, no key |

---

## Troubleshooting

- **"fetch failed" / connect-timeout errors in the logs.** These are network
  reachability problems (your machine couldn't reach Exa / Jina / Hacker News /
  Supabase at that moment), not data corruption. Every source is fail-open, so a
  run just stores whatever succeeded. If it persists, it's environment-level
  (VPN / firewall / connection).
- **Feed has irrelevant items.** Tighten your **Research focus** — make topics more
  specific and add the noisy themes to *Avoid*. Then **Run research now**.
- **Feed is too narrow / empty.** Broaden the topics or remove exclusions, or click
  **Regenerate from profile**.

---

## File map

| Concern | File |
|---|---|
| The funnel (run + reuse + filter + query-building) | `lib/integrations/run-research.ts` |
| Build/cache the Research Focus | `lib/integrations/research-focus.ts` |
| Store the focus (`research_focus` config) | `lib/db/profile.ts` |
| Shared skill digest (used by focus + ideas) | `lib/skills/digest.ts` |
| Sources | `lib/integrations/exa.ts`, `hackernews.ts`, `jina.ts`, `apify-sources.ts` |
| Editable focus panel (with click-to-edit) | `components/research/research-focus-panel.tsx` |
| Save / regenerate / run-now actions | `app/actions/research.ts` |
| Research page | `app/app/research/page.tsx` |
| Daily cron (research → ideas) | `app/api/cron/daily/route.ts` |
