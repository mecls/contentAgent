# How the Two-Model System Works

A plain-language guide to how the Miraside Content agent now uses **two AI models**
together — a smart "brain" that runs the conversation, and a fast "writer" that
produces the actual post text.

---

## The one-sentence version

A more capable, agentic model (**glm-5.2**) does all the thinking — reads your
skill, plans, picks the angle, decides which tools to call — and then **hands off
the actual writing** to the faster model you were already using
(**gpt-oss:120b**), which produces the post body.

Think: **glm-5.2 is the strategist, gpt-oss is the copywriter.**

---

## Why two models?

One model was doing everything: planning *and* writing. Splitting the job lets
each model do what it's best at:

- **glm-5.2** is stronger at multi-step reasoning and tool use → it's a better
  *orchestrator* (deciding what to do, reading skills, enforcing your rules).
- **gpt-oss:120b** is fast and good enough at prose → it's a fine *writer*, and
  cheaper to run for the bulk text generation.

Both run on the **same Ollama Cloud account** you already had configured — no new
provider, no new key. The only difference is *which model name* each task uses.

---

## The mental model

When you ask for a post in chat, here's the flow:

```
   You: "write me a LinkedIn post about shipping fast"
            │
            ▼
   ┌─────────────────────────────────────────────┐
   │  glm-5.2  — THE BRAIN (runs the chat loop)   │
   │                                              │
   │   • read_skill / read_skill_file             │  ← reads your voice + rules
   │   • picks archetype, angle, format           │
   │   • (optional) search_news for fresh facts   │
   │                                              │
   │   • write_content(brief, voice, constraints) │ ──┐  hands off the writing
   └─────────────────────────────────────────────┘   │
                                                       ▼
                          ┌──────────────────────────────────────┐
                          │  gpt-oss:120b — THE WRITER            │
                          │  turns the brief into a clean,        │
                          │  paste-ready post body                │
                          └───────────────────┬──────────────────┘
                                               │ returns the draft
            ┌──────────────────────────────────┘
            ▼
   ┌─────────────────────────────────────────────┐
   │  glm-5.2 reviews the draft against your rules │
   │   • fixes/regenerates if it breaks a rule     │
   │   • save_post  → goes to your Posts library    │
   └─────────────────────────────────────────────┘
```

The key idea: **glm-5.2 never writes the post itself.** It always delegates the
prose to a new tool called `write_content`, which runs on gpt-oss.

---

## The `write_content` tool (the handoff)

This is the heart of the change. The writer model is **deliberately blindfolded** —
it can't see your skill, your profile, the research, or the conversation. So the
brain has to pass it everything it needs in one tidy brief:

| What the brain passes | Why |
|---|---|
| **brief** | What the post should actually say (message, angle, key points) |
| **voice** | Your voice rules, quoted from the skill + voice-reference |
| **constraints** | Hard rules: honesty, banned words, length limits |
| **archetype / format / platform** | The shape of the post |
| **source_material** | Real facts (from news search/research) to ground it in |

Because the brain assembles this brief from your skill *every time*, the writer
stays on-voice and on-rules even though it never reads the skill directly.

> **Plain-text guarantee still applies.** The writer is told the body is pasted
> straight into LinkedIn/X/etc., so it outputs no Markdown and no stage directions
> (`[image here]`) — same rule as before, now enforced on the writer.

---

## What you'll notice (and what you won't)

- **You won't see the split.** It's invisible in chat — you ask, the post appears.
- **The post still streams in live** as it's written, and still saves to your
  Posts library exactly as before.
- **Revisions go back to the writer.** Ask "make the hook punchier" and the brain
  re-briefs gpt-oss with your note instead of rewriting by hand.
- **Background jobs are unchanged.** Research, idea generation, weekly planning,
  and the weekly analytics review still run on the fast model (gpt-oss) to keep
  automated runs cheap. Only the *interactive chat* got the smart brain.

---

## How it's configured

Three lines in `.env.local` control the whole thing:

```bash
LLM_MODEL=gpt-oss:120b        # fallback / default
LLM_MODEL_HEAVY=glm-5.2       # the brain (interactive chat)
LLM_MODEL_FAST=gpt-oss:120b   # the writer + all background tasks
```

To try a different brain (e.g. `deepseek-v4-pro`), just change `LLM_MODEL_HEAVY`
and restart — no code change needed.

> **Gotcha — model names.** At the `ollama.com/v1` endpoint the model id is the
> **bare tag** (`glm-5.2`, `deepseek-v4-pro`). Do **not** add the `:cloud` suffix
> here — that form is only for pulling a cloud model with `ollama pull`.

---

## File map

| Concern | File |
|---|---|
| The two model tiers (`LLM_MODEL_HEAVY` / `LLM_MODEL_FAST`) | `.env.local`, `lib/env.ts` |
| Model getters (`llmModelHeavy()` / `llmModelFast()`) | `lib/agent/llm.ts` |
| The writer (gpt-oss turns a brief into a post body) | `lib/agent/write-content.ts` |
| The `write_content` tool definition | `lib/agent/tools.ts` |
| Tool dispatch + streaming the draft to chat | `lib/agent/run-scoped-tool.ts` |
| The chat loop (defaults to the brain, streams the draft) | `lib/agent/agent-loop.ts` |
| The "you orchestrate, the writer drafts" rules | `lib/agent/system-prompt.ts` |
| Weekly review pinned to the fast model | `lib/integrations/weekly-review.ts` |
| "Draft post" button inherits the same split | `lib/integrations/write-idea.ts` |

---

## Quick reference

| You want… | What happens |
|---|---|
| A post written in chat | glm-5.2 plans → gpt-oss writes → glm-5.2 reviews & saves |
| To swap the smart model | Change `LLM_MODEL_HEAVY` in `.env.local`, restart |
| Cheaper automated runs | Already done — crons stay on gpt-oss |
| A revision ("punchier hook") | glm-5.2 re-briefs gpt-oss with your note |
