#!/usr/bin/env bash
set -euo pipefail

# Ensure Homebrew, Node/NPM, uv, gh, agy, claude, opencode are on PATH for macOS launchd
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$HOME/.gemini/bin:$HOME/.npm-global/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="${NIGHTLY_CONFIG:-${AGY_NIGHTLY_CONFIG:-$ROOT_DIR/repos.conf}}"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Error: Configuration file not found at $CONFIG_FILE" >&2
  echo "Run ./install.sh or copy repos.conf.example to repos.conf" >&2
  exit 1
fi

# Load user configuration
source "$CONFIG_FILE"

GLOBAL_ENGINE="${ENGINE:-agy}"
DEFAULT_BASE_BRANCH="${DEFAULT_BASE_BRANCH:-main}"
MAX_OPEN_PRS="${MAX_OPEN_PRS:-3}"
TEST_COMMAND="${TEST_COMMAND:-}"

# Antigravity models (fallback to legacy WEEKDAY_MODEL/SUNDAY_MODEL if present)
AGY_WEEKDAY_MODEL="${AGY_WEEKDAY_MODEL:-${WEEKDAY_MODEL:-Gemini 3.8 Flash (High)}}"
AGY_SUNDAY_MODEL="${AGY_SUNDAY_MODEL:-${SUNDAY_MODEL:-Gemini 4 Argon (Medium)}}"

# Claude Code models
CLAUDE_WEEKDAY_MODEL="${CLAUDE_WEEKDAY_MODEL:-}"
CLAUDE_SUNDAY_MODEL="${CLAUDE_SUNDAY_MODEL:-}"

# OpenCode models
OPENCODE_WEEKDAY_MODEL="${OPENCODE_WEEKDAY_MODEL:-}"
OPENCODE_SUNDAY_MODEL="${OPENCODE_SUNDAY_MODEL:-}"

DATE_STAMP=$(date +%Y-%m-%d)
IS_SUNDAY=$([[ $(date +%u) -eq 7 ]] && echo "1" || echo "0")
LOG_DIR="${LOG_DIR:-$HOME/logs/nightly-sweep/$DATE_STAMP}"
mkdir -p "$LOG_DIR"

detect_repo_context() {
  local stack=""
  local test_cmd=""
  local lint_cmd=""

  # Python ecosystems
  if [[ -f "uv.lock" || (-f "pyproject.toml" && -d ".venv") ]]; then
    stack="Python (uv package manager)"
    test_cmd="uv run pytest -q --tb=short"
    lint_cmd="uv run ruff check ."
  elif [[ -f "poetry.lock" ]]; then
    stack="Python (Poetry package manager)"
    test_cmd="poetry run pytest -q --tb=short"
    lint_cmd="poetry run ruff check . || poetry run flake8"
  elif [[ -f "Pipfile" ]]; then
    stack="Python (Pipenv)"
    test_cmd="pipenv run pytest -q"
    lint_cmd="flake8"
  elif [[ -f "pyproject.toml" || -f "requirements.txt" || -f "setup.py" ]]; then
    stack="Python"
    test_cmd="pytest -q --tb=short"
    lint_cmd="ruff check . || flake8"
  fi

  # Django check
  if [[ -f "manage.py" ]]; then
    stack="${stack:+$stack / }Django"
    lint_cmd="${lint_cmd:-python manage.py check}"
  fi

  # JavaScript / TypeScript / Node ecosystems
  if [[ -f "pnpm-lock.yaml" ]]; then
    stack="${stack:+$stack / }Node.js (pnpm)"
    test_cmd="${test_cmd:-pnpm test}"
    lint_cmd="${lint_cmd:-pnpm lint}"
  elif [[ -f "yarn.lock" ]]; then
    stack="${stack:+$stack / }Node.js (yarn)"
    test_cmd="${test_cmd:-yarn test}"
    lint_cmd="${lint_cmd:-yarn lint}"
  elif [[ -f "bun.lockb" || -f "bun.lock" ]]; then
    stack="${stack:+$stack / }Bun"
    test_cmd="${test_cmd:-bun test}"
  elif [[ -f "package-lock.json" || -f "package.json" ]]; then
    stack="${stack:+$stack / }Node.js (npm)"
    test_cmd="${test_cmd:-npm test}"
    lint_cmd="${lint_cmd:-npm run lint}"
  fi

  # Rust
  if [[ -f "Cargo.toml" ]]; then
    stack="${stack:+$stack / }Rust (Cargo)"
    test_cmd="${test_cmd:-cargo test}"
    lint_cmd="${lint_cmd:-cargo clippy}"
  fi

  # Go
  if [[ -f "go.mod" ]]; then
    stack="${stack:+$stack / }Go"
    test_cmd="${test_cmd:-go test ./...}"
    lint_cmd="${lint_cmd:-golangci-lint run}"
  fi

  # If user explicitly configured TEST_COMMAND, honor it
  if [[ -n "${TEST_COMMAND:-}" ]]; then
    test_cmd="$TEST_COMMAND"
  fi

  if [[ -n "$stack" || -n "$test_cmd" ]]; then
    printf "Detected Stack: %s\nSuggested Test Runner: %s\nSuggested Lint Command: %s\n" \
      "${stack:-Generic}" "${test_cmd:-None auto-detected}" "${lint_cmd:-None auto-detected}"
  else
    printf "Generic repository structure. Identify project test runners before executing.\n"
  fi
}

run_engine() {
  local engine="$1"
  local prompt="$2"
  local log_file="$3"

  case "$engine" in
    agy)
      local model
      if [[ "$IS_SUNDAY" -eq 1 ]]; then
        model="$AGY_SUNDAY_MODEL"
      else
        model="$AGY_WEEKDAY_MODEL"
      fi
      echo "[$(date)] Invoking agy agent (model: $model)..." >> "$log_file"
      agy --model "$model" \
          --sandbox \
          --dangerously-skip-permissions \
          -p "$prompt" \
          >> "$log_file" 2>&1 || true
      ;;
    claude)
      local model
      if [[ "$IS_SUNDAY" -eq 1 ]]; then
        model="$CLAUDE_SUNDAY_MODEL"
      else
        model="$CLAUDE_WEEKDAY_MODEL"
      fi
      echo "[$(date)] Invoking Claude Code agent${model:+ (model: $model)}..." >> "$log_file"
      if [[ -n "$model" ]]; then
        claude --model "$model" --dangerously-skip-permissions -p "$prompt" >> "$log_file" 2>&1 || true
      else
        claude --dangerously-skip-permissions -p "$prompt" >> "$log_file" 2>&1 || true
      fi
      ;;
    opencode)
      local model
      if [[ "$IS_SUNDAY" -eq 1 ]]; then
        model="$OPENCODE_SUNDAY_MODEL"
      else
        model="$OPENCODE_WEEKDAY_MODEL"
      fi
      echo "[$(date)] Invoking OpenCode agent${model:+ (model: $model)}..." >> "$log_file"
      if [[ -n "$model" ]]; then
        opencode run -m "$model" "$prompt" >> "$log_file" 2>&1 || true
      else
        opencode run "$prompt" >> "$log_file" 2>&1 || true
      fi
      ;;
    *)
      echo "Error: Unknown AI engine '$engine'. Valid options: agy, claude, opencode" >> "$log_file"
      return 1
      ;;
  esac
}

fetch_declined_prs_by_label() {
  local label="$1"
  gh pr list \
    --state closed \
    --label "$label" \
    --limit 50 \
    --json number,title,body,mergedAt,comments \
    --jq '
      map(select(.mergedAt == null)) |
      map(
        "- Declined PR #\(.number): \(.title)\n" +
        "  Details: \(.body | split("\n") | map(select(startswith("Target-Scope:") or startswith("Change-Fingerprint:"))) | join(" | "))\n" +
        (if (.comments | length) > 0 then "  Reviewer Rejection Note: \(.comments | map(.body) | join("; "))" else "" end)
      ) | join("\n")
    ' 2>/dev/null || true
}

fetch_open_prs_by_label() {
  local label="$1"
  gh pr list \
    --state open \
    --label "$label" \
    --json number,title,body \
    --jq '
      map(
        "- Open PR #\(.number): \(.title) (\(.body | split("\n") | map(select(startswith("Change-Fingerprint:"))) | join("")))"
      ) | join("\n")
    ' 2>/dev/null || true
}

for REPO_SPEC in "${REPOS[@]}"; do
  # Parse per-repo engine override (e.g. "/path/to/repo:claude" or "/path/to/repo")
  if [[ "$REPO_SPEC" =~ ^(.+):(agy|claude|opencode)$ ]]; then
    REPO_PATH="${BASH_REMATCH[1]}"
    ACTIVE_ENGINE="${BASH_REMATCH[2]}"
  else
    REPO_PATH="$REPO_SPEC"
    ACTIVE_ENGINE="$GLOBAL_ENGINE"
  fi

  if [[ ! -d "$REPO_PATH/.git" ]]; then
    echo "Skipping $REPO_PATH (no .git directory found)"
    continue
  fi

  REPO_NAME=$(basename "$REPO_PATH")
  LOG_FILE="$LOG_DIR/${REPO_NAME}.log"
  BRANCH_NAME="nightly/${DATE_STAMP}"
  WORKTREE_DIR="/tmp/nightly-worktrees/${REPO_NAME}-${DATE_STAMP}"

  echo "==================================================" >> "$LOG_FILE"
  echo "[$(date)] Starting Nightly Sweep for $REPO_NAME using engine: $ACTIVE_ENGINE" >> "$LOG_FILE"

  cd "$REPO_PATH"

  # Auto-detect default branch (main vs master)
  BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "$DEFAULT_BASE_BRANCH")
  git fetch origin "$BASE_BRANCH" >> "$LOG_FILE" 2>&1

  # Ensure tracking label exists on GitHub
  gh label create "nightly-sweep" --color "0E8A16" --description "Automated nightly code sweep" --force >> "$LOG_FILE" 2>&1 || true

  # 1. Fetch Declined PRs (queries both modern 'nightly-sweep' and legacy 'nightly-agy')
  DECLINED_MODERN=$(fetch_declined_prs_by_label "nightly-sweep")
  DECLINED_LEGACY=$(fetch_declined_prs_by_label "nightly-agy")
  DECLINED_PRS=$(printf "%s\n%s" "$DECLINED_MODERN" "$DECLINED_LEGACY" | sed '/^[[:space:]]*$/d')
  if [[ -z "$DECLINED_PRS" ]]; then
    DECLINED_PRS="None"
  fi

  # 2. Fetch Open PRs (queries both modern and legacy labels)
  OPEN_MODERN=$(fetch_open_prs_by_label "nightly-sweep")
  OPEN_LEGACY=$(fetch_open_prs_by_label "nightly-agy")
  OPEN_PRS=$(printf "%s\n%s" "$OPEN_MODERN" "$OPEN_LEGACY" | sed '/^[[:space:]]*$/d')
  if [[ -z "$OPEN_PRS" ]]; then
    OPEN_PRS="None"
  fi

  # Check PR Backlog Throttle (MAX_OPEN_PRS)
  OPEN_PRS_COUNT=$(printf "%s\n%s" "$OPEN_MODERN" "$OPEN_LEGACY" | grep -c '^- Open PR #' || true)
  if [[ "$MAX_OPEN_PRS" -gt 0 && "$OPEN_PRS_COUNT" -ge "$MAX_OPEN_PRS" ]]; then
    echo "[$(date)] ⏸️  Open PR backlog limit reached ($OPEN_PRS_COUNT >= $MAX_OPEN_PRS). Skipping sweep for $REPO_NAME until open PRs are reviewed." >> "$LOG_FILE"
    continue
  fi

  # 3. Read static repo-level ignore rules (.nightly-ignore.md or .agy-ignore.md)
  STATIC_IGNORES="None"
  if [[ -f "$REPO_PATH/.nightly-ignore.md" ]]; then
    STATIC_IGNORES=$(cat "$REPO_PATH/.nightly-ignore.md")
  elif [[ -f "$REPO_PATH/.agy-ignore.md" ]]; then
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

  # 6. Detect Environment and Assemble Context-Aware Prompt
  DETECTED_ENV=$(detect_repo_context)

  PROMPT="You are running an autonomous nightly code health, security, performance, and bug sweep.

### REPOSITORY ENVIRONMENT & COMMANDS
${DETECTED_ENV}

### STRICT DO-NOT-REPEAT LEDGER (DECLINED & OPEN PRS)
The repository owner has previously reviewed and DECLINED the following automated PRs, or they are currently open awaiting review.
You MUST NOT propose these changes again, touch the same target scope for the same reason, or suggest similar package upgrades/refactorings:
${DECLINED_PRS}

### CURRENTLY OPEN AUTOMATED PRS (DO NOT DUPLICATE)
${OPEN_PRS}

### PERMANENT REPOSITORY EXCLUSIONS
${STATIC_IGNORES}

### YOUR MISSION
${TASK_INSTRUCTIONS}"

  # 7. Execute chosen engine
  run_engine "$ACTIVE_ENGINE" "$PROMPT" "$LOG_FILE"

  # 8. Safely parse PR metadata (.nightly_pr_meta.env or legacy .agy_pr_meta.env)
  PR_TITLE="chore(nightly): automated code health & security sweep ($DATE_STAMP) [via $ACTIVE_ENGINE]"
  META_FILE=""
  if [[ -f .nightly_pr_meta.env ]]; then
    META_FILE=".nightly_pr_meta.env"
  elif [[ -f .agy_pr_meta.env ]]; then
    META_FILE=".agy_pr_meta.env"
  fi

  if [[ -n "$META_FILE" ]]; then
    EXTRACTED_TITLE=$(grep -v '^#' "$META_FILE" | sed -e 's/^PR_TITLE=//' -e 's/^["'"'"']//' -e 's/["'"'"']$//' | head -n 1)
    if [[ -n "$EXTRACTED_TITLE" ]]; then
      PR_TITLE="$EXTRACTED_TITLE"
    fi
    rm -f "$META_FILE"
  fi

  REPORT_BODY="Automated nightly sweep executed by \`$ACTIVE_ENGINE\`."
  if [[ -f NIGHTLY_REPORT.md ]]; then
    REPORT_BODY=$(cat NIGHTLY_REPORT.md)
    rm -f NIGHTLY_REPORT.md
  fi

  # Preserve clean working tree from ignore files
  git checkout -- .nightly-ignore.md .agy-ignore.md 2>/dev/null || true

  # 9. Automated Test Verification Gate (if test command is configured)
  HAS_UNCOMMITTED_CHANGES=$([[ -n $(git status --porcelain) ]] && echo "1" || echo "0")
  COMMITS_AHEAD=$(git rev-list --count "origin/$BASE_BRANCH..HEAD" 2>/dev/null || echo "0")

  if [[ ("$HAS_UNCOMMITTED_CHANGES" -eq 1 || "$COMMITS_AHEAD" -gt 0) && -n "$TEST_COMMAND" ]]; then
    echo "[$(date)] 🧪 Running automated test verification gate: $TEST_COMMAND..." >> "$LOG_FILE"
    if ! eval "$TEST_COMMAND" >> "$LOG_FILE" 2>&1; then
      echo "[$(date)] ❌ Test gate failed! Changes did not pass verification. Discarding changes and skipping PR." >> "$LOG_FILE"
      cd "$REPO_PATH"
      git worktree remove --force "$WORKTREE_DIR" >> "$LOG_FILE" 2>&1
      continue
    fi
    echo "[$(date)] ✅ Test gate passed successfully." >> "$LOG_FILE"
  fi

  # 10. Stage and commit uncommitted changes if left behind by agent
  if [[ -n $(git status --porcelain) ]]; then
    echo "[$(date)] Changes detected in working tree. Committing with report body..." >> "$LOG_FILE"
    git add -A
    git commit -m "$PR_TITLE" -m "$REPORT_BODY" >> "$LOG_FILE" 2>&1
  fi

  # Re-evaluate commits ahead of origin/$BASE_BRANCH
  COMMITS_AHEAD=$(git rev-list --count "origin/$BASE_BRANCH..HEAD" 2>/dev/null || echo "0")

  # 11. Push and open PR if the branch contains new commits
  if [[ "$COMMITS_AHEAD" -gt 0 ]]; then
    echo "[$(date)] Branch has $COMMITS_AHEAD commit(s) ahead of origin/$BASE_BRANCH. Opening PR..." >> "$LOG_FILE"

    # If the latest commit has an empty commit body, amend it with the report body
    LATEST_COMMIT_BODY=$(git log -1 --format=%b | tr -d '[:space:]')
    if [[ -z "$LATEST_COMMIT_BODY" && -n "$REPORT_BODY" ]]; then
      echo "[$(date)] Amending commit to include detailed report body..." >> "$LOG_FILE"
      EXISTING_SUBJECT=$(git log -1 --format=%s)
      if [[ ! "$PR_TITLE" =~ ^chore\(nightly\):[[:space:]]automated ]]; then
        SUBJECT_TO_USE="$PR_TITLE"
      else
        SUBJECT_TO_USE="$EXISTING_SUBJECT"
      fi
      git commit --amend -m "$SUBJECT_TO_USE" -m "$REPORT_BODY" >> "$LOG_FILE" 2>&1
    fi

    # If PR_TITLE is still the generic default, use the agent's latest commit message
    if [[ "$PR_TITLE" =~ ^chore\(nightly\):[[:space:]]automated ]]; then
      LATEST_COMMIT_MSG=$(git log -1 --format=%s)
      if [[ -n "$LATEST_COMMIT_MSG" ]]; then
        PR_TITLE="$LATEST_COMMIT_MSG"
      fi
    fi

    git push -u origin "$BRANCH_NAME" --force >> "$LOG_FILE" 2>&1

    gh pr create \
      --base "$BASE_BRANCH" \
      --head "$BRANCH_NAME" \
      --title "$PR_TITLE" \
      --label "nightly-sweep" \
      --body "$REPORT_BODY" >> "$LOG_FILE" 2>&1
    echo "[$(date)] PR created successfully." >> "$LOG_FILE"
  else
    echo "[$(date)] No actionable changes outside the ignore ledger. Skipping PR." >> "$LOG_FILE"
  fi

  # 12. Clean up worktree
  cd "$REPO_PATH"
  git worktree remove --force "$WORKTREE_DIR" >> "$LOG_FILE" 2>&1
done
