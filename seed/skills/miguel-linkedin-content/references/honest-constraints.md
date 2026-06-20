# Honest Constraints

This file exists because Miguel has repeatedly violated these guardrails. They are not "best practices" — they are non-negotiables for his specific situation. Every draft must be read against this list before shipping.

## The biggest one: Miguel has no shipped customers

Miguel is at design-partner stage. He has NOT built and deployed AI agents for paying customers. He has NOT had clients renew. He has NOT generated case study results.

This means specific language is forbidden in any post, DM, or comment:

### Forbidden phrases

- **"We've built this for 10+ companies"** — false. No.
- **"The pattern we keep seeing across our clients"** — implies a client base.
- **"Median outcome for operators running our stack"** — implies aggregated results.
- **"Most of our customers report..."** — implies customer base.
- **"Last quarter, three operators using our system..."** — invents traction.
- **"A portfolio in Lisbon cut response time from 4 hours to 12 minutes"** — Miguel does not have a Lisbon portfolio customer. This exact claim was made in 3 separate DMs and is the single most damaging recurring violation.
- **"€60k ops hire avoided"** — invented number.
- **"Recovered 40 hours/month from the existing team"** — invented number.
- **Any specific dollar/euro/hours saved claim attributed to a real customer** — invented.

### Permitted language that says the same thing

- **"In businesses like yours, the bottleneck is usually..."** — observation, not customer claim
- **"Two agents that would fix this..."** — forward-looking, not retrospective
- **"This is the kind of work we'd map for a company like yours"** — proposal, not history
- **"The pattern I've seen across every agent build I've worked on..."** — defensible (covers personal builds + partner work)
- **"Industry benchmarks suggest 30-50% of mid-tier operator time goes to coordination overhead"** — defensible if backed by real industry research
- **"We're in design-partner phase, working with our first cohort"** — completely honest and respected by senior buyers
- **"My research suggests..."** — accurate expert positioning
- **"From what I've observed reproducing benchmarks and building prototypes..."** — defensible for his actual background

The trick: speak about methodology and your view of their business, not about clients you don't have.

## The Fundraisr / Waldi conflict

Miguel works at Fundraisr (an AI fintech startup) and is also building Waldi (an AI agents company) on the side. This creates real risk that every viral post amplifies:

### What to never do in a public post

- Never attack any service category that overlaps with Fundraisr's offering
- Never mention Fundraisr by name in posts that could be read as competitive positioning
- Never publish claims about Waldi customers or revenue that Fundraisr leadership doesn't already know about
- Never position Waldi as something Miguel does "full-time" if Fundraisr employs him full-time

### What to flag if it comes up

Every time the topic of Miguel's "current work," "what we're building," or "shipping for customers" appears in a draft, pause and ask:

1. Is Fundraisr aware of this Waldi work?
2. Does this draft conflict with Fundraisr's employment agreement (non-compete, moonlighting, IP assignment)?
3. Would a Fundraisr customer reading this be confused about which company Miguel works for?

If any answer is uncertain, the safer framing is "AI products inside operating companies" rather than naming Waldi explicitly, OR vice versa — naming Waldi but using the "I'm currently building" framing that doesn't imply paid customers.

This concern has been raised at least five times in conversation. It will be raised every time it's relevant. The skill enforces it because Miguel has repeatedly downplayed the risk.

## The engagement-farming ban

CTAs that gate value behind comments / reposts / connections are forbidden. Examples of forbidden patterns:

- "Comment TEAM and I'll send the playbook"
- "Like and comment REI to get the full pack"
- "Repost for priority access"
- "Connect with me + comment X"

Why these are forbidden:

1. Lucas's posts and the "6 MCPs" post both use this pattern. Miguel has publicly attacked this exact category of behavior in his AI strategist post.
2. The audience that responds to these CTAs is not Miguel's ICP. SMB founders at $1-50M scroll past them. The replies come from people who comment on every "comment X" post — not buyers.
3. They contradict the brand Miguel has built around "ship working systems, not engagement bait."

### Permitted closes

- "Which one are you on?" (forces self-categorization)
- "What workflow at your company would you put first?" (invites real input)
- "Curious how others are thinking about this." (low-friction)
- "Open to disagreement in the comments." (invites genuine debate)
- "If this is the gap you're working on, my DMs are open." (offers without gating)
- No close at all — just let the thesis land.

## The rage-bait cadence guardrail

Looking at real performance data: Miguel's "AI strategist" post got 772 impressions because it was posted too close to the senior engineer post (which hit 15k). The algorithm and the audience both punished the same-shape-same-topic cadence.

### Hard rules

- **No more than one rage-bait or identity-threat post per 14 days.**
- **Never two posts on adjacent topics back-to-back** (e.g., "senior engineers are cooked" then "AI strategists are cooked" within the same 7 days)
- **After a rage-bait, the next post should be Builder Learnings, Value Framework, or Resonance** — not another rage-bait. These convert the audience the rage-bait attracted.

### Why this matters

Brand drift is real. The audience that follows Miguel because of the senior engineer post is also evaluating whether his profile is just rage-bait. If they click through and see four rage-bait posts in two weeks, they unfollow. If they see one rage-bait every two weeks surrounded by substance, they engage.

## The fact-checking rule

Every claim with a number, year, or proper name in any post must be verifiable. Examples of past mistakes that this rule prevents:

- "Claude-level AI for €20 a month and a VPS" — was misleading; Claude Pro has always been €20/month and a VPS doesn't get you Claude.
- "GPT-5.5" in a draft — needs verification this is the current model name before posting
- "Microsoft Diffusion Report" attribution — needs verification that the linked source actually contains the cited stats

### Process

Before any post goes live with a specific claim:

1. Identify every number, date, product name, or company name
2. Verify each one with a quick web search if memory isn't 100% certain
3. If any claim can't be verified, either find a source or remove the claim

This adds 5 minutes per post. It saves the brand cost of being publicly corrected in the comments.

## The audience-attack rule

Never publicly attack a group that contains Miguel's actual buyers.

Examples of safe targets:
- AI strategists, AI consultants, AI thought leaders (not Miguel's buyers)
- Engineers refusing to use AI (not Miguel's buyers — Miguel's buyers are operators, not engineers)
- "AI experts" who were crypto experts 18 months ago (not Miguel's buyers)
- Vendors selling decks instead of systems (not Miguel's buyers)

Examples of unsafe targets:
- SMB founders ("most SMB founders are idiots" → kills Waldi pipeline)
- Operations leaders ("ops people don't get AI" → kills Waldi pipeline)
- Specific industries Miguel sells into (real estate ops, multifamily, flex workspace, etc.)
- People using ChatGPT or Gemini ("you picked the wrong tool" → insults the buying audience)

If a draft is attacking a group, check whether that group overlaps with Miguel's ICP. If yes, rewrite the target.

## The "match their vocabulary" rule

When writing about specific industries or roles, use the prospect's vocabulary, not Miguel's product taxonomy.

### Translation table

| Generic product taxonomy (avoid) | Industry-specific vocabulary (use) |
|---|---|
| Onboarding agent | Tenant onboarding agent / Member onboarding agent / Client onboarding agent |
| Pipeline autopilot | Deal sourcing agent / Leasing pipeline agent / Investor pipeline agent |
| Communication agent | Tenant communication agent / Member intelligence agent / Resident retention agent |
| Reporting agent | Owner reporting agent / Investor reporting agent / Compliance briefing agent |
| Triage agent | Maintenance dispatch / Incident routing / Regulatory triage |

The vocabulary swap signals you understand the prospect's world. The wrong vocabulary signals you're a SaaS vendor blasting templates.

## The improvement protocol

When a post fails or violates one of these constraints, update this file. Add the failure pattern, the specific phrase or behavior that caused it, and the safer alternative. Do not overwrite — append.

The skill gets sharper as more failures get documented.
