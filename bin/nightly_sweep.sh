#!/usr/bin/env bash
set -euo pipefail

# Ensure Homebrew, uv, gh, and agy are on PATH for macOS launchd
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$HOME/.gemini/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="${AGY_NIGHTLY_CONFIG:-$ROOT_DIR/repos.conf}"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Error: Configuration file not found at $CONFIG_FILE" >&2
  echo "Run ./install.sh or copy repos.conf.example to repos.conf" >&2
  exit 1
fi

# Load user configuration
source "$CONFIG_FILE"

WEEKDAY_MODEL="${WEEKDAY_MODEL:-Gemini 3.8 Flash (High)}"
SUNDAY_MODEL="${SUNDAY_MODEL:-Gemini 4 Argon (Medium)}"
DEFAULT_BASE_BRANCH="${DEFAULT_BASE_BRANCH:-main}"

DATE_STAMP=$(date +%Y-%m-%d)
LOG_DIR="${LOG_DIR:-$HOME/logs/agy-nightly/$DATE_STAMP}"
mkdir -p "$LOG_DIR"

for REPO_PATH in "${REPOS[@]}"; do
  if [[ ! -d "$REPO_PATH/.git" ]]; then
    echo "Skipping $REPO_PATH (no .git directory found)"
    continue
  fi

  REPO_NAME=$(basename "$REPO_PATH")
  LOG_FILE="$LOG_DIR/${REPO_NAME}.log"
  BRANCH_NAME="agy/nightly-${DATE_STAMP}"
  WORKTREE_DIR="/tmp/agy-worktrees/${REPO_NAME}-${DATE_STAMP}"

  echo "==================================================" >> "$LOG_FILE"
  echo "[$(date)] Starting Nightly Sweep for $REPO_NAME" >> "$LOG_FILE"

  cd "$REPO_PATH"

  # Auto-detect default branch (main vs master)
  BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "$DEFAULT_BASE_BRANCH")
  git fetch origin "$BASE_BRANCH" >> "$LOG_FILE" 2>&1

  # Ensure the tracking label exists on GitHub
  gh label create "nightly-agy" --color "0E8A16" --description "Automated nightly sweep by agy" --force >> "$LOG_FILE" 2>&1 || true

  # 1. Fetch Declined PRs (Closed WITHOUT being merged)
  DECLINED_PRS=$(gh pr list \
    --state closed \
    --label "nightly-agy" \
    --limit 50 \
    --json number,title,body,mergedAt,comments \
    --jq '
      map(select(.mergedAt == null)) |
      map(
        "- Declined PR #\(.number): \(.title)\n" +
        "  Details: \(.body | split("\n") | map(select(startswith("Target-Scope:") or startswith("Change-Fingerprint:"))) | join(" | "))\n" +
        (if (.comments | length) > 0 then "  Reviewer Rejection Note: \(.comments | map(.body) | join("; "))" else "" end)
      ) | join("\n")
    ' 2>/dev/null || echo "None")

  # 2. Fetch Currently Open PRs (Prevent duplicates)
  OPEN_PRS=$(gh pr list \
    --state open \
    --label "nightly-agy" \
    --json number,title,body \
    --jq '
      map(
        "- Open PR #\(.number): \(.title) (\(.body | split("\n") | map(select(startswith("Change-Fingerprint:"))) | join("")))"
      ) | join("\n")
    ' 2>/dev/null || echo "None")

  # 3. Read static repo-level ignore rules if present
  STATIC_IGNORES="None"
  if [[ -f "$REPO_PATH/.agy-ignore.md" ]]; then
    STATIC_IGNORES=$(cat "$REPO_PATH/.agy-ignore.md")
  fi

  # 4. Read project-specific prompt or fall back to global template
  if [[ -f "$REPO_PATH/.agents/nightly_prompt.md" ]]; then
    TASK_INSTRUCTIONS=$(cat "$REPO_PATH/.agents/nightly_prompt.md")
  else
    TASK_INSTRUCTIONS=$(cat "$ROOT_DIR/templates/nightly_prompt.md")
  fi

  # 5. Create isolated Git Worktree
  rm -rf "$WORKTREE_DIR"
  git worktree prune
  git worktree add -B "$BRANCH_NAME" "$WORKTREE_DIR" "origin/$BASE_BRANCH" >> "$LOG_FILE" 2>&1
  cd "$WORKTREE_DIR"

  # 6. Assemble Context-Aware Prompt
  PROMPT="You are running an autonomous nightly code health, security, performance, and bug sweep.

### STRICT DO-NOT-REPEAT LEDGER (DECLINED & OPEN PRS)
The repository owner has previously reviewed and DECLINED the following automated PRs, or they are currently open awaiting review.
You MUST NOT propose these changes again, touch the same target scope for the same reason, or suggest similar package upgrades/refactorings:
${DECLINED_PRS:-None}

### CURRENTLY OPEN AUTOMATED PRS (DO NOT DUPLICATE)
${OPEN_PRS:-None}

### PERMANENT REPOSITORY EXCLUSIONS (.agy-ignore.md)
${STATIC_IGNORES}

### YOUR MISSION
${TASK_INSTRUCTIONS}"

  # 7. Select model and run agy headless
  if [[ $(date +%u) -eq 7 ]]; then
    NIGHTLY_MODEL="$SUNDAY_MODEL"
  else
    NIGHTLY_MODEL="$WEEKDAY_MODEL"
  fi

  echo "[$(date)] Invoking agy agent with model: $NIGHTLY_MODEL..." >> "$LOG_FILE"
  agy --model "$NIGHTLY_MODEL" \
      --sandbox \
      --dangerously-skip-permissions \
      -p "$PROMPT" \
      >> "$LOG_FILE" 2>&1 || true

  # 8. Safely parse PR metadata
  PR_TITLE="chore(nightly): automated code health & security sweep ($DATE_STAMP)"
  if [[ -f .agy_pr_meta.env ]]; then
    EXTRACTED_TITLE=$(grep -v '^#' .agy_pr_meta.env | sed -e 's/^PR_TITLE=//' -e 's/^["'"'"']//' -e 's/["'"'"']$//' | head -n 1)
    if [[ -n "$EXTRACTED_TITLE" ]]; then
      PR_TITLE="$EXTRACTED_TITLE"
    fi
    rm -f .agy_pr_meta.env
  fi

  REPORT_BODY="Automated nightly sweep by \`agy\`."
  if [[ -f NIGHTLY_REPORT.md ]]; then
    REPORT_BODY=$(cat NIGHTLY_REPORT.md)
    rm -f NIGHTLY_REPORT.md
  fi

  git checkout -- .agy-ignore.md 2>/dev/null || true

  # 9. Commit, push, and open PR if changes exist
  if [[ -n $(git status --porcelain) ]]; then
    echo "[$(date)] Changes detected. Committing and opening PR..." >> "$LOG_FILE"
    git add -A
    git commit -m "$PR_TITLE" >> "$LOG_FILE" 2>&1
    git push -u origin "$BRANCH_NAME" --force >> "$LOG_FILE" 2>&1

    gh pr create \
      --base "$BASE_BRANCH" \
      --head "$BRANCH_NAME" \
      --title "$PR_TITLE" \
      --label "nightly-agy" \
      --body "$REPORT_BODY" >> "$LOG_FILE" 2>&1
    echo "[$(date)] PR created successfully." >> "$LOG_FILE"
  else
    echo "[$(date)] No actionable changes outside the ignore ledger. Skipping PR." >> "$LOG_FILE"
  fi

  # 10. Clean up worktree
  cd "$REPO_PATH"
  git worktree remove --force "$WORKTREE_DIR" >> "$LOG_FILE" 2>&1
done
EOF

