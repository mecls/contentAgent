# How Formats & Weekly Planning Work

A plain-language guide to the agent's newest capability: spotting which **post
formats** are working right now, and turning that into a **weekly plan** — a
balanced mix of posts, each with a format and a day.

---

## The one-sentence version

The system looks at the competitor posts it already scrapes, figures out which
**structural formats** (carousel, short text, poll, video…) are getting the most
engagement lately, cross-references the formats *you* personally win at, and
builds you a **weekly content plan** where every suggested post comes with a
format and a slot in the week.

---

## First, what's a "format"?

Every post has three independent dimensions. Keeping them separate is the whole
idea:

| Axis | Question it answers | Example | Where it lived before |
|---|---|---|---|
| **Topic** | *What is it about?* | "AI hiring" | tags |
| **Archetype** | *What's the narrative angle?* | "Contrarian take" | the skill |
| **Format** ⭐ | *What's the container/shape?* | "Carousel" | **new** |

"Viral formats" are the **Format** axis — the platform-specific container that
goes in and out of fashion (carousels, text-only hooks, polls, reels…). That's
the new thing this feature reasons about.

The list of known formats per platform lives in `lib/formats/catalog.ts`. It's
plain reference data (not a database table) so it's easy to read and extend.
LinkedIn is fully fleshed out today; the other platforms have starter sets ready
for when their scrapers exist.

---

## The mental model

```
   ┌──────────────────────┐
   │ COMPETITOR POSTS     │   already scraped weekly (the data we reuse)
   └──────────┬───────────┘
              │ each post gets tagged with a normalized FORMAT
              ▼
   ┌──────────────────────┐        ┌──────────────────────┐
   │ TRENDING FORMATS     │        │ YOUR OWN FORMAT       │
   │ what's working NOW   │        │ PERFORMANCE           │
   │ (recency-weighted    │        │ what YOU win at       │
   │  engagement, rising/ │        │ (your posts, grouped  │
   │  steady/falling)     │        │  by format)           │
   └──────────┬───────────┘        └───────────┬──────────┘
              └─────────────┬──────────────────┘
                            ▼
              ┌──────────────────────────────┐
              │ WEEKLY PLAN                  │   one LLM call, grounded in
              │ N posts, each with a         │   the two signals above +
              │ format + topic + day,        │   your research, topics & skill
              │ + one "explore" slot         │
              └──────────────────────────────┘
```

The key principle: **the rankings are real, not invented.** Trending formats come
from actual scraped engagement (pure math, no AI). The AI only steps in at the
final step to assemble the plan — and even then it can only pick formats from the
catalog and topics from your real research.

---

## Step 1 — Tagging posts with a format

- **Competitor posts:** when the weekly competitor analysis runs, the same LLM
  pass that already extracts "why this post worked" now also picks a
  `format_key` from the platform's catalog. Stored inside the existing
  `features` data — no new table. (`lib/integrations/run-competitors.ts`)
- **Your posts:** when the agent saves a post, it records the format too. The
  `save_post` tool gained a `format` field, and when you draft a post *from a
  plan slot* the agent carries that slot's format through automatically.

Free-text labels get mapped onto clean catalog keys by `normalizeFormatKey`
(e.g. `"carousel-caption"` → `carousel`, `"long-form"` → `text-long`), so the
numbers actually group together.

---

## Step 2 — Trending formats (what's working now)

`analyzeFormatTrends()` (`lib/integrations/analyze-formats.ts`) groups every
classified competitor post by format and computes, per format:

- **recent vs. prior engagement** (last 30 days vs. the 30 before) → a
  **rising / steady / falling** direction,
- its **share** of recent posts, and
- a ranking by recent engagement.

It's deterministic — just aggregation over data you already have, so it's
instant and free. The signal source is pluggable, so external "trend scrapers"
can be slotted in later without changing anything downstream.

`formatPerformance()` (`lib/db/posts.ts`) does the mirror image over **your own**
posts — which formats *you* personally get the most reactions/comments on.

---

## Step 3 — The weekly plan (the combination)

`suggestPostMixForAccount()` (`lib/integrations/suggest-mix.ts`) is the payoff.
One grounded LLM call takes:

- the **trending formats** (what's hot),
- **your** format performance (what you win at),
- your **research**, **topics/pillars**, **per-tag performance**, and pending ideas,

…and returns a balanced **combination**: N posts, each with a **format + topic +
angle + hook + day**. The rules it follows:

- favor formats that are **trending and/or that you over-perform in**,
- cover your topics with variety (no same format back-to-back),
- include exactly **one "explore" slot** to test a rising/under-tried format,
- never invent clients, metrics, or sources (same honesty guardrails as ideas).

The plan is saved as one plan row plus N linked "idea" rows — which means each
item is **draftable and dismissable** using the exact same machinery as the Ideas
page. Click **Write this** on a plan item and the agent drafts it through your
skill (with the slot's format baked in) and shows you a **preview** — nothing is
saved to Posts until you hit **Save to drafts** (or you can **Regenerate** /
**Discard**). See "Previewing before drafting" below.

---

## Where you see it

A new **Weekly plan** page (`/app/plan`) shows:

1. a **Trending formats** panel (each with a rising/steady/falling arrow),
2. the plan's **rationale** (why this mix), and
3. the week's **posts as cards** — format badge, day, and a *Write this* button.

There's a **Generate plan now** button to build one on demand.

---

## Previewing before drafting

You don't have to commit a post sight-unseen. **Write this** on a plan item (or an
Ideas card) now works in two steps:

1. **Generate** — the agent reads your skill and writes the post in the slot's
   format, then shows the **full draft inline as a preview**. Nothing is saved yet.
2. **Decide** — **Save to drafts** sends that exact text to your Posts library,
   **Regenerate** writes a fresh version, or **Discard** throws it away (the item
   stays in the plan so you can try again later).

Under the hood this is a "dry-run" of the normal draft path: the agent loop runs
exactly as it would when saving, but `save_post` surfaces the draft for review
instead of persisting it (`previewIdeaPost` / `saveIdeaDraft` in
`lib/integrations/write-idea.ts`, gated by a `dryRun` flag on the tool context).
So the preview is the *real* post you'd get — not an approximation.

---

## How the agent uses it in chat

Three new tools are available to the agent:

| Tool | What it does |
|---|---|
| `analyze_format_trends` | "Which formats are working right now?" (competitors) |
| `get_format_performance` | "Which formats do *I* win at?" (your posts) |
| `plan_content_week` | Build + save a weekly plan and return it |

So if you say *"plan my content for next week"* or *"what formats are trending?"*,
the agent reaches for these. Asking it to plan a week now produces a real,
format-aware plan instead of just drafting blind.

---

## When does it run?

- **Automatically, weekly** — folded into the existing Monday competitor cron
  (`app/api/cron/competitors-weekly/route.ts`): scrape competitors → refresh
  format trends → build the plan. No new cron, no new schedule.
- **On demand** — the **Generate plan now** button, or just ask in chat.

---

## What you need configured

Nothing new. It runs entirely on data you already collect:

- **Competitors** added on the Integrations page (this is the trend signal) — the
  more competitor posts scraped, the sharper the trends.
- An onboarded profile + skill (for the plan's voice and topics).

With no competitor data yet, the trends panel is simply empty and the plan leans
on your profile + best-practice formats — it degrades gracefully rather than
breaking.

---

## Multi-platform note

Everything is parameterized by `platform`, but only **LinkedIn** carries real
signal today (it's the only platform scraped). The catalog, analysis, and plan
generator all already accept other platforms — they'll start producing real
trends the moment those scrapers exist, with no rework.

---

## File map

| Concern | File |
|---|---|
| Format taxonomy + normalizer | `lib/formats/catalog.ts` |
| Trending-format analysis (deterministic) | `lib/integrations/analyze-formats.ts` |
| Your own format performance | `formatPerformance()` in `lib/db/posts.ts` |
| Weekly plan generator (the LLM call) | `lib/integrations/suggest-mix.ts` |
| Plan storage | `lib/db/plans.ts` + plan fields in `lib/db/ideas.ts` |
| Competitor format classification | `lib/integrations/run-competitors.ts` |
| Agent tools + guidance | `lib/agent/tools.ts`, `run-scoped-tool.ts`, `system-prompt.ts` |
| Plan page + cards | `app/app/plan/page.tsx`, `components/plan/*` |
| Generate-now action | `app/actions/plan.ts` |
| Weekly cron (competitors → trends → plan) | `app/api/cron/competitors-weekly/route.ts` |
| Database schema | `supabase/migrations/0006_format_plans.sql` |
