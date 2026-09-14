#!/usr/bin/env bash
# Free checks for the skill-recovery build: read-only skill, no Ideas/Plan, no
# personal content in the repo. No paid calls and no running server.
# `next build` downloads Google Fonts (free).
set -euo pipefail
cd "$(dirname "$0")/.."

ok() { echo "ok: $1"; }
fail() {
  echo "FAIL: $1"
  if [ -n "${2:-}" ]; then echo "$2"; fi
  exit 1
}

# Run a command; pass when it exits 0.
run() {
  local name="$1"; shift
  local out
  if out=$("$@" 2>&1); then ok "$name"; else fail "$name" "$out"; fi
}

# A search that must find nothing: exit 1 (no match) passes; 0 (matches) or 2 (error) fails.
no_match() {
  local name="$1"; shift
  local out status=0
  out=$("$@" 2>&1) || status=$?
  case "$status" in
    1) ok "$name" ;;
    0) fail "$name" "$out" ;;
    *) fail "$name" "search error ($status): $out" ;;
  esac
}

# Build and static checks
run "typecheck" npm run typecheck
run "lint (app components lib scripts next.config.ts)" npx eslint app components lib scripts next.config.ts
run "build" npm run build

# Removed code is really gone
no_match "no removed tools" grep -rnE "append_skill_file|propose_skill_overwrite|create_skill_file|create_skill\b|learn_writing_style|read_skill_file|list_ideas|generate_ideas|plan_content_week" app components lib
no_match "no ideas/plans readers" grep -rnE "content_post_ideas|content_content_plans|db/ideas|db/plans|suggest-mix|run-ideas|write-idea|draft-preview|dryRun|postPreview|Proposal" app components lib
no_match "no agent-reachable skill writers" grep -rnE "writeSkillFile|createSkillFile|createSkill\b|appendSkillFile|proposeOverwrite" lib/agent lib/integrations app/api
no_match "no other skill files named" grep -nE "references/|voice-reference|preferences\.md|improvement-log|constraints file|approved overwrite" lib/agent/system-prompt.ts lib/agent/tools.ts lib/skills/store.ts lib/integrations/weekly-review.ts lib/skills/generate.ts

expected_tools="analyze_format_trends get_format_performance get_post get_tag_performance list_competitor_insights list_posts list_research list_skills read_skill reconcile_analytics run_research save_post search_news set_post_url update_post_metrics write_content"
actual_tools=$(grep -oE "name: '[a-z_]+'" lib/agent/tools.ts | sed -E "s/name: '([a-z_]+)'/\1/" | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')
if [ "$actual_tools" = "$expected_tools" ]; then ok "tool list is exactly the 16"; else fail "tool list is exactly the 16" "got: $actual_tools"; fi

guards=$(grep -cF 'only ${SKILL_FILE} is allowed in a skill' lib/skills/store.ts || true)
if [ "$guards" = "2" ]; then ok "store guard present twice"; else fail "store guard present twice" "found $guards"; fi

bullet=$(grep -c "cannot change the skill" lib/agent/system-prompt.ts || true)
if [ "$bullet" -ge 1 ]; then ok "prompt bullet present"; else fail "prompt bullet present" "found $bullet"; fi
no_match "style-by-reference section gone" grep -nE "WRITING STYLE BY REFERENCE" lib/agent/system-prompt.ts

no_match "daily cron has no ideas import" grep -n "run-ideas" app/api/cron/daily/route.ts
no_match "competitor cron has no plan import" grep -n "suggest-mix" app/api/cron/competitors-weekly/route.ts
run "vercel.json unchanged" git diff --quiet main -- vercel.json

for f in \
  app/app/ideas/page.tsx app/app/plan/page.tsx app/actions/ideas.ts app/actions/plan.ts \
  components/ideas/idea-card.tsx components/ideas/generate-button.tsx \
  components/plan/plan-item-card.tsx components/plan/generate-plan-button.tsx components/plan/format-trends-panel.tsx \
  lib/integrations/run-ideas.ts lib/integrations/suggest-mix.ts lib/integrations/write-idea.ts \
  lib/agent/draft-preview.ts lib/db/ideas.ts lib/db/plans.ts \
  lib/integrations/learn-style.ts components/skills/proposal-card.tsx docs/how-formats-and-planning-work.md \
  lib/skills/seed.ts app/api/dev/seed/route.ts seed; do
  if [ -e "$f" ]; then fail "deleted files gone" "still exists: $f"; fi
done
ok "deleted files gone"

missing=""
for rule in \
  "source: '/app/ideas', destination: '/app', permanent: false" \
  "source: '/app/plan', destination: '/app', permanent: false" \
  "source: '/app', has: [{ type: 'query', key: 'c' }], destination: '/app/chat', permanent: false" \
  "source: '/app', has: [{ type: 'query', key: 'prompt' }], destination: '/app/chat', permanent: false"; do
  grep -qF "$rule" next.config.ts || missing="$missing $rule;"
done
if [ -z "$missing" ]; then ok "redirects declared"; else fail "redirects declared" "missing:$missing"; fi

# Nothing personal is tracked
tracked=$(git ls-files private tasks archive seed)
if [ -z "$tracked" ]; then ok "no private, tasks, archive or seed files tracked"; else fail "no private, tasks, archive or seed files tracked" "$tracked"; fi
run "private/ ignored" git check-ignore -q private/anything

# Personal markers live outside the repo: one extended regex per line in private/personal-markers.txt.
if [ -f private/personal-markers.txt ]; then
  no_match "no personal markers in tracked files" git grep -n -I -E -f private/personal-markers.txt -- . ':!convex'
else
  echo "skip: no private/personal-markers.txt, personal-marker scan not run"
fi

echo "ALL CHECKS PASSED"
