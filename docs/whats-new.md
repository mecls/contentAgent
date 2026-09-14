# What's New — Session Update (2026-06-20)

A plain-language guide to the four things added to the Miraside Content agent in
this session, and how each one works under the hood.

---

## Update 2026-09-14 — Choose, model picker, real stories only

- **Choose is the home page (`/app`).** One click proposes 3 post angles from the skill and the last
  7 days of research. Each is marked "Sourced" (with its links) or "Needs your story" (with a
  question for you). Reject angles with a reason and ask for a new batch that avoids them; **Draft
  this** opens the chat with the prompt ready. Only the current batch is kept, and only your click
  calls the model.
- **The chat moved to `/app/chat`.** Old `/app?c=` links redirect.
- **Model picker.** A button in the chat composer picks the planning model from the Ollama Cloud
  models that support tools. The choice is saved for your account; post text is still written by
  the writer model.
- **Real stories only.** Drafts use only stories and events from the skill, a cited source, or what
  you say in the chat. When a post needs a story that doesn't exist, the agent asks instead of
  inventing one.
- **Saving checks the details.** Before a post is saved, every number, amount, percentage,
  duration ("three weeks"), clock time and weekday in it must appear in the skill, the research or
  search results the agent loaded in that chat, or your messages. If one doesn't, the post isn't
  saved and the agent rewrites the line. Invented details without a number or day (an invented
  object or scene) can still slip through, so read drafts before posting.

---

## Update 2026-09-13 — skill recovery

Post quality had dropped because the agent kept rewriting its own skill, so these
were removed:

- **Every skill-writing tool:** `append_skill_file`, `propose_skill_overwrite`,
  `create_skill_file`, `create_skill` and `learn_writing_style` (section 2 below).
  The agent can only read the skill now.
- **Multi-file skills and the bundled seed skill.** A skill is one `SKILL.md`, stored
  in the database under its account. No skill content ships in the repo any more; a
  one-off data step removes the old reference files from the database.
- **Ideas and Weekly Plan:** the pages, their agent tools and the cron steps that
  generated them. `/app/ideas` and `/app/plan` redirect to the chat.

You change the skill yourself on the Skills page — see `docs/self-improving-skills.md`.

---

## The one-sentence version

The agent now: writes **clean, paste-ready posts** (no stray Markdown), can **copy
another creator's writing style from a link**, lets you **edit starter prompts
before sending**, and can **search the live web for a keyword and write a post
grounded in the latest news**.

---

## 1. Posts come out as clean, paste-ready text

### What changed
Drafts used to contain Markdown (`**bold**`, `- bullets`) and stage directions
like `[Before: screenshot of the spreadsheet]`. LinkedIn (and X, Threads, etc.)
render plain text — so those showed up literally and made posts unpostable.

### How it works
The agent's system prompt now has a hard rule: the post **body** is the *exact*
text you'll paste into the platform, so it must be **plain text** — no Markdown
syntax, and **no placeholder/art-direction notes** in the body. If a visual would
help, the agent suggests it in the chat reply (or sets an image URL) instead of
putting it inside the post.

### Where it lives
`lib/agent/system-prompt.ts` → the **SAVING POSTS** section.

> Note: the model occasionally still slips a stray `**word**` in. The rule is in
> place; if you see one, ask it to "reformat as plain text" and it'll fix it.

---

## 2. Writing style by reference ("write like this person")

> **Removed on 2026-09-13 — see top.**

### What it does
You can point the agent at another creator and have your posts written in **their
voice**. In chat:

> "Update my writing style to be like https://www.linkedin.com/in/nick-saraev/"

The agent scrapes that profile's recent posts, figures out *how* they write, saves
that as a style guide, and matches it on every future draft.

### How it works

```
your link  ──►  Apify scrapes ~20 recent posts
                      │
                      ▼
              LLM distills the style
              (voice, rhythm, hooks, formatting, CTAs)
                      │
                      ▼
        saved to the skill as references/voice-reference.md
                      │
                      ▼
     agent reads it before EVERY draft = posts match that voice
```

- It **applies immediately** and tells you, in chat, whose style it captured and
  what it'll do differently.
- Re-running it (a new link) **overwrites** the file — your style follows whoever
  you last pointed it at. Old versions are kept for rollback.
- `voice-reference.md` is the **primary authority on voice** — it outranks the
  skill's default voice rules. The one thing it never overrides is **honesty**:
  the agent will copy hooks, formatting, and even comment-gated CTAs from the
  reference, but it will **not** invent customers or metrics you don't have.

### Where it lives
- Core logic: `lib/integrations/learn-style.ts` (scrape → distill → save).
- Tool wiring: `lib/agent/tools.ts` + `lib/agent/run-scoped-tool.ts`
  (`learn_writing_style`).
- Reading rule: `lib/agent/system-prompt.ts`.
- New skills are seeded with an empty `references/voice-reference.md` placeholder
  (`lib/skills/generate.ts`).

> Heads-up: your chosen reference also drives **length** and **CTA style**. If you
> set a short-form writer (like Nick Saraev), your posts will be short and may use
> "comment X" CTAs — because that's their playbook.

---

## 3. Starter prompts now autofill (instead of sending)

### What changed
On the empty chat screen, the four suggestion cards ("Draft a LinkedIn post
about…", "Plan my content for next week", etc.) used to fire straight to the AI.
Now clicking one **fills the composer** and puts the cursor at the end, so you can
tweak it (e.g. swap the topic) before hitting send.

### Where it lives
`components/app/chat/chat-panel.tsx` → the `IntroHero` cards now call `prefill`
instead of `send` (matching the "Draft a post" quick-action chip).

---

## 4. "Write a post about Cursor" → live news search

### What it does
When you ask for a post about a **specific, timely thing** — a product, company,
person, tool, or news event — the agent searches the web for the **latest news**
on it and writes the post **grounded in a real, recent article**.

> "Write a post about Cursor" → finds the June-16 SpaceX/Cursor acquisition news →
> drafts a post built on those real facts.

If you give a **generic/evergreen topic** instead ("write about delegation"), it
**skips the search** and just writes a good post from your skill.

### How it works

```
"write a post about Cursor"
        │  agent spots a concrete keyword
        ▼
  search_news("Cursor")  ──►  Exa web/news search (newest first)
        │
        ├─► saves the articles to your Research page
        ├─► shows them as source cards in chat
        ▼
  picks the most RECENT/relevant article
        │
        ▼
  reads your skill + voice → drafts the post grounded in it → saves it
```

- News-first search, with a general-web fallback if there's no news hit.
- The found articles are **saved to your Research archive** too, so they show up
  on the Research page and dedupe with future runs.
- This is separate from the daily **Research** pipeline (which searches your
  *configured topics* on a schedule) — `search_news` is **on-demand** for whatever
  keyword you name right now.

### Where it lives
- Search: reuses `exaSearch(...)` in `lib/integrations/exa.ts` (no new infra).
- Tool: `lib/agent/tools.ts` + `lib/agent/run-scoped-tool.ts` (`search_news`).
- When to use it: `lib/agent/system-prompt.ts` (keyword → search, topic → just
  write).

---

## Quick reference

| You want… | Say / do this |
|---|---|
| A clean, paste-ready post | Nothing — it's automatic now |
| Posts in someone else's voice | "Update my writing style to be like \<link\>" |
| Edit a starter prompt first | Click a starter card → it fills the box |
| A post about a current event/product | "Write a post about \<keyword\>" |
| A post on a general theme | "Write a post about \<topic\>" (no search) |
