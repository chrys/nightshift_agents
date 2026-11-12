#!/usr/bin/env bash
set -euo pipefail

# Ensure standard tools and AI CLIs are on PATH
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$HOME/.gemini/bin:$HOME/.npm-global/bin:$HOME/.cargo/bin:/usr/bin:/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="${NIGHTLY_CONFIG:-${AGY_NIGHTLY_CONFIG:-$ROOT_DIR/repos.conf}}"
TASKS_FILE="$ROOT_DIR/tasks/tasks.json"

if [[ ! -f "$TASKS_FILE" ]]; then
  echo "Error: Tasks file not found at $TASKS_FILE" >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <TASK_ID>" >&2
  exit 1
fi

TASK_ID="$1"

# Extract task details from tasks.json
TASK_JSON=$(jq -r --arg id "$TASK_ID" '.[] | select(.id == $id)' "$TASKS_FILE")
if [[ -z "$TASK_JSON" || "$TASK_JSON" == "null" ]]; then
  echo "Error: Task with ID '$TASK_ID' not found in $TASKS_FILE" >&2
  exit 1
fi

REPO_PATH=$(echo "$TASK_JSON" | jq -r '.repoPath')
TASK_PROMPT=$(echo "$TASK_JSON" | jq -r '.prompt')
TASK_MODEL=$(echo "$TASK_JSON" | jq -r '.model // empty')
TASK_ENGINE=$(echo "$TASK_JSON" | jq -r '.engine // empty')

if [[ ! -d "$REPO_PATH/.git" ]]; then
  echo "Error: Git repository not found at $REPO_PATH" >&2
  exit 1
fi

# Load global configuration if available
if [[ -f "$CONFIG_FILE" ]]; then
  source "$CONFIG_FILE"
fi

GLOBAL_ENGINE="${ENGINE:-agy}"
ACTIVE_ENGINE="${TASK_ENGINE:-$GLOBAL_ENGINE}"
TEST_COMMAND="${TEST_COMMAND:-}"
DEFAULT_BASE_BRANCH="${DEFAULT_BASE_BRANCH:-main}"

# Default model resolution
if [[ -z "$TASK_MODEL" ]]; then
  if [[ "$ACTIVE_ENGINE" == "agy" ]]; then
    TASK_MODEL="${AGY_WEEKDAY_MODEL:-Gemini 3.8 Flash (High)}"
  fi
fi

DATE_STAMP=$(date +%Y-%m-%d)
LOG_DIR="${LOG_DIR:-$HOME/logs/nightly-sweep/$DATE_STAMP}"
mkdir -p "$LOG_DIR"

REPO_NAME=$(basename "$REPO_PATH")
LOG_FILE="$LOG_DIR/${REPO_NAME}-task-${TASK_ID}.log"
BRANCH_NAME="task/${DATE_STAMP}-${TASK_ID}"
WORKTREE_DIR="/tmp/nightly-worktrees/${REPO_NAME}-task-${TASK_ID}"

echo "==================================================" | tee -a "$LOG_FILE"
echo "[$(date)] Starting One-Time Task: $TASK_ID for $REPO_NAME" | tee -a "$LOG_FILE"
echo "[$(date)] Engine: $ACTIVE_ENGINE | Model: ${TASK_MODEL:-default}" | tee -a "$LOG_FILE"

# Helper to update task in tasks.json
update_task_json() {
  local updates_json="$1"
  local tmp_file="${TASKS_FILE}.tmp.$$"
  jq --arg id "$TASK_ID" --argjson updates "$updates_json" \
    'map(if .id == $id then (. + $updates) else . end)' "$TASKS_FILE" > "$tmp_file"
  mv "$tmp_file" "$TASKS_FILE"
}

# Mark task as running
update_task_json "{\"status\": \"running\", \"logPath\": \"$LOG_FILE\"}"

cd "$REPO_PATH"

# Auto-detect git remote
GIT_REMOTE="origin"
if git remote | grep -qx "origin"; then
  GIT_REMOTE="origin"
elif git remote | grep -qx "github"; then
  GIT_REMOTE="github"
elif [[ -n $(git remote | head -n 1) ]]; then
  GIT_REMOTE=$(git remote | head -n 1)
fi

BASE_BRANCH=$(git symbolic-ref "refs/remotes/$GIT_REMOTE/HEAD" 2>/dev/null | sed "s@^refs/remotes/$GIT_REMOTE/@@" || echo "$DEFAULT_BASE_BRANCH")
echo "[$(date)] Target base branch: $BASE_BRANCH (remote: $GIT_REMOTE)" | tee -a "$LOG_FILE"
git fetch "$GIT_REMOTE" "$BASE_BRANCH" >> "$LOG_FILE" 2>&1

# Ensure tracking labels exist on GitHub
gh label create "nightly-task" --color "1D76DB" --description "User-scheduled one-time nightly task" --force >> "$LOG_FILE" 2>&1 || true

# Read permanent ignore rules
STATIC_IGNORES="None"
if [[ -f "$REPO_PATH/.nightly-ignore.md" ]]; then
  STATIC_IGNORES=$(cat "$REPO_PATH/.nightly-ignore.md")
elif [[ -f "$REPO_PATH/.agy-ignore.md" ]]; then
  STATIC_IGNORES=$(cat "$REPO_PATH/.agy-ignore.md")
fi

# Create isolated Git Worktree
rm -rf "$WORKTREE_DIR"
git worktree prune
git worktree add -B "$BRANCH_NAME" "$WORKTREE_DIR" "$GIT_REMOTE/$BASE_BRANCH" >> "$LOG_FILE" 2>&1
cd "$WORKTREE_DIR"

# Exclude metadata files in worktree
EXCLUDE_FILE=$(git rev-parse --git-path info/exclude 2>/dev/null || true)
if [[ -n "$EXCLUDE_FILE" ]]; then
  mkdir -p "$(dirname "$EXCLUDE_FILE")"
  for IGNORE_PATTERN in ".nightly_pr_meta.env" ".agy_pr_meta.env" "NIGHTLY_REPORT.md"; do
    if ! grep -qxF "$IGNORE_PATTERN" "$EXCLUDE_FILE" 2>/dev/null; then
      echo "$IGNORE_PATTERN" >> "$EXCLUDE_FILE"
    fi
  done
fi

detect_repo_context() {
  local stack=""
  local test_cmd=""
  local lint_cmd=""

  if [[ -f "uv.lock" || (-f "pyproject.toml" && -d ".venv") ]]; then
    stack="Python (uv)"
    test_cmd="uv run pytest -q --tb=short"
    lint_cmd="uv run ruff check ."
  elif [[ -f "poetry.lock" ]]; then
    stack="Python (Poetry)"
    test_cmd="poetry run pytest -q --tb=short"
  elif [[ -f "package-lock.json" || -f "package.json" ]]; then
    stack="Node.js (npm)"
    test_cmd="npm test"
  elif [[ -f "Cargo.toml" ]]; then
    stack="Rust (Cargo)"
    test_cmd="cargo test"
  fi

  if [[ -n "${TEST_COMMAND:-}" ]]; then
    test_cmd="$TEST_COMMAND"
  fi

  if [[ -n "$stack" || -n "$test_cmd" ]]; then
    printf "Detected Stack: %s\nSuggested Test Runner: %s\n" "${stack:-Generic}" "${test_cmd:-None}"
  else
    printf "Generic repository structure.\n"
  fi
}

DETECTED_ENV=$(detect_repo_context)

PROMPT="You are executing an autonomous, targeted one-time engineering task requested by the repository owner.

### REPOSITORY ENVIRONMENT & COMMANDS
${DETECTED_ENV}

### PERMANENT REPOSITORY EXCLUSIONS
${STATIC_IGNORES}

### YOUR TASK MISSION
${TASK_PROMPT}

### EXECUTION REQUIREMENTS
1. Implement the requested task accurately, cleanly, and completely.
2. Run targeted tests or lint checks to verify your changes.
3. You may optionally create .nightly_pr_meta.env with PR_TITLE=\"task: <concise summary>\" and NIGHTLY_REPORT.md with your summary.
4. Keep all changes focused strictly on this task."

echo "[$(date)] Invoking $ACTIVE_ENGINE..." | tee -a "$LOG_FILE"

case "$ACTIVE_ENGINE" in
  agy)
    if [[ -n "$TASK_MODEL" ]]; then
      agy --model "$TASK_MODEL" --sandbox --dangerously-skip-permissions -p "$PROMPT" >> "$LOG_FILE" 2>&1 || true
    else
      agy --sandbox --dangerously-skip-permissions -p "$PROMPT" >> "$LOG_FILE" 2>&1 || true
    fi
    ;;
  claude)
    if [[ -n "$TASK_MODEL" ]]; then
      claude --model "$TASK_MODEL" --dangerously-skip-permissions -p "$PROMPT" >> "$LOG_FILE" 2>&1 || true
    else
      claude --dangerously-skip-permissions -p "$PROMPT" >> "$LOG_FILE" 2>&1 || true
    fi
    ;;
  opencode)
    if [[ -n "$TASK_MODEL" ]]; then
      opencode run -m "$TASK_MODEL" "$PROMPT" >> "$LOG_FILE" 2>&1 || true
    else
      opencode run "$PROMPT" >> "$LOG_FILE" 2>&1 || true
    fi
    ;;
esac

# Parse PR metadata
PR_TITLE="task: $(echo "$TASK_PROMPT" | head -n 1 | cut -c 1-60)"
if [[ -f .nightly_pr_meta.env ]]; then
  EXTRACTED_TITLE=$(grep -v '^#' .nightly_pr_meta.env | sed -e 's/^PR_TITLE=//' -e 's/^["'"'"']//' -e 's/["'"'"']$//' | head -n 1)
  if [[ -n "$EXTRACTED_TITLE" ]]; then
    PR_TITLE="$EXTRACTED_TITLE"
  fi
  rm -f .nightly_pr_meta.env
fi

if [[ ! "$PR_TITLE" =~ ^task: ]]; then
  PR_TITLE="task: $PR_TITLE"
fi

REPORT_BODY="Automated task executed by \`$ACTIVE_ENGINE\`.\n\n### Task Prompt\n${TASK_PROMPT}"
if [[ -f NIGHTLY_REPORT.md ]]; then
  REPORT_BODY=$(cat NIGHTLY_REPORT.md)
  rm -f NIGHTLY_REPORT.md
fi

# Test verification gate
HAS_CHANGES=$([[ -n $(git status --porcelain) ]] && echo "1" || echo "0")
COMMITS_AHEAD=$(git rev-list --count "$GIT_REMOTE/$BASE_BRANCH..HEAD" 2>/dev/null || echo "0")

if [[ ("$HAS_CHANGES" -eq 1 || "$COMMITS_AHEAD" -gt 0) && -n "$TEST_COMMAND" ]]; then
  echo "[$(date)] 🧪 Running test verification gate: $TEST_COMMAND..." | tee -a "$LOG_FILE"
  if ! eval "$TEST_COMMAND" >> "$LOG_FILE" 2>&1; then
    echo "[$(date)] ❌ Test gate failed! Discarding changes." | tee -a "$LOG_FILE"
    update_task_json "{\"status\": \"failed\", \"failureReason\": \"Test gate failed: $TEST_COMMAND\", \"completedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
    cd "$REPO_PATH"
    git worktree remove --force "$WORKTREE_DIR" >> "$LOG_FILE" 2>&1
    exit 1
  fi
  echo "[$(date)] ✅ Test gate passed." | tee -a "$LOG_FILE"
fi

# Stage and commit if uncommitted
if [[ -n $(git status --porcelain) ]]; then
  git add -A
  git commit -m "$PR_TITLE" -m "$REPORT_BODY" >> "$LOG_FILE" 2>&1
fi

COMMITS_AHEAD=$(git rev-list --count "$GIT_REMOTE/$BASE_BRANCH..HEAD" 2>/dev/null || echo "0")

if [[ "$COMMITS_AHEAD" -gt 0 ]]; then
  echo "[$(date)] Pushing branch and creating PR..." | tee -a "$LOG_FILE"
  git push -u "$GIT_REMOTE" "$BRANCH_NAME" --force >> "$LOG_FILE" 2>&1

  PR_URL=$(gh pr create \
    --base "$BASE_BRANCH" \
    --head "$BRANCH_NAME" \
    --title "$PR_TITLE" \
    --label "nightly-task" \
    --body "$REPORT_BODY" 2>&1 | grep -o 'https://github.com/[^ ]*' || true)

  PR_NUMBER=""
  if [[ -n "$PR_URL" ]]; then
    PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$' || true)
  fi

  echo "[$(date)] ✅ PR Created: $PR_URL (#$PR_NUMBER)" | tee -a "$LOG_FILE"

  update_task_json "{\"status\": \"completed\", \"prNumber\": ${PR_NUMBER:-null}, \"prUrl\": \"$PR_URL\", \"prTitle\": \"$PR_TITLE\", \"prState\": \"OPEN\", \"completedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
else
  echo "[$(date)] ⚪ Agent completed with no file changes." | tee -a "$LOG_FILE"
  update_task_json "{\"status\": \"completed\", \"failureReason\": \"Agent completed with no file changes proposed\", \"completedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
fi

# Clean up worktree
cd "$REPO_PATH"
git worktree remove --force "$WORKTREE_DIR" >> "$LOG_FILE" 2>&1
echo "[$(date)] Done." | tee -a "$LOG_FILE"
