# Changelog

All notable changes, architectural features, and pipeline improvements implemented for `nightly_prompts`.

---

## [2026-11-02]

### Added
- **Per-Repository Destination Branch Support:**
  - Added ability to configure custom base/destination branches per repository in `repos.conf` using `:branch` or `@branch` syntax (e.g. `"/path/to/repo:develop"`).
  - Enables targeting different base branches across projects (e.g. `VPlanner2` &rarr; `main`, `YourPlanner` &rarr; `develop`).
  - Supports combined branch and engine overrides in any order (e.g. `"/path/to/repo:develop:claude"`).
- **Git Remote Auto-Detection:**
  - Dynamically discovers the repository's active remote name (e.g., `github`, `origin`, or primary remote) instead of hardcoding `origin`.
  - Enables out-of-the-box compatibility with projects like `YourPlanner` whose GitHub remote is named `github`.
- **Automatic Tech Stack & Test Runner Detection (`detect_repo_context`):**
  - Auto-detects project runtime, lockfiles, and package managers before invoking the agent:
    - **Python:** `uv` (`uv.lock`), `poetry` (`poetry.lock`), `pipenv` (`Pipfile`), `pytest`, `Django` (`manage.py`).
    - **Node.js:** `npm` (`package-lock.json`), `pnpm` (`pnpm-lock.yaml`), `yarn` (`yarn.lock`), `bun` (`bun.lockb`).
    - **Rust:** `cargo` (`Cargo.toml`).
    - **Go:** `go` (`go.mod`).
  - Injects detected runtime, suggested test command, and lint command into the agent's prompt context under `### REPOSITORY ENVIRONMENT & COMMANDS`, skipping exploratory cold-start turns.
- **Embedded Git Commit Documentation:**
  - When committing changes, the orchestrator passes both the title and the structured report (`git commit -m "$PR_TITLE" -m "$REPORT_BODY"`).
  - Automatically inspects the commit body if the agent committed directly and auto-amends missing commit bodies with `NIGHTLY_REPORT.md` so that `Change-Fingerprint`, `Target-Scope`, risk assessments, and baseline metrics persist in `git log` and `git blame`.
- **Target-First Discipline & Anti-Polling Rules:**
  - Updated `templates/nightly_prompt.md` to enforce the Target-First workflow: scan code first, select ONE issue, run targeted tests on the affected module during development, and run the full test suite synchronously only during final verification.
  - Added strict anti-polling constraints to eliminate wasteful LLM idle turns (*"Waiting for pytest to finish"*).

---

## [2026-10-31]

### Added
- **Multi-Engine AI Architecture:**
  - Decoupled the orchestrator from `agy` to support three leading agentic coding CLIs:
    - **Google Antigravity (`agy`)**
    - **Anthropic Claude Code (`claude`)**
    - **OpenCode (`opencode`)**
  - Configurable globally via `ENGINE="agy"` in `repos.conf` or per repository via `"/path/to/repo:engine"`.
  - Configurable engine-specific model schedules (`AGY_WEEKDAY_MODEL`, `CLAUDE_WEEKDAY_MODEL`, `OPENCODE_WEEKDAY_MODEL`, etc.).
- **Dual Commit & Working-Tree Change Detection:**
  - Resolved the "pre-committed code" bug by checking both working tree diffs (`git status --porcelain`) and commit history ahead of remote (`git rev-list --count $REMOTE/$BASE_BRANCH..HEAD`).
  - If the agent commits directly during its turn, the orchestrator detects the commit, extracts the agent's headline for the PR title, pushes the branch, and opens the PR.
- **PR Backlog Throttling (`MAX_OPEN_PRS`):**
  - Added configurable open PR threshold (default: `MAX_OPEN_PRS=3`) in `repos.conf`.
  - Automatically queries open PRs across `nightly-sweep` and legacy `nightly-agy` labels; pauses new sweeps for that repo if the threshold is met to prevent review queue accumulation.
- **Automated Test Verification Gate (`TEST_COMMAND`):**
  - Added optional pre-push test gate in `repos.conf`. When specified, modified branches must pass the test command; failing runs discard the branch and prevent broken PRs.
- **Interactive Setup (`install.sh`):**
  - Added interactive prompt during installation to select the preferred AI engine.
  - Verifies prerequisites (`git`, `gh`, and the chosen engine's CLI executable).
  - Unloads and cleans up legacy `com.agy.nightly.plist` and `com.chrys.agy.nightly.plist` LaunchAgents.
  - Loads the unified macOS LaunchAgent at `~/Library/LaunchAgents/com.nightly.sweep.plist`.
- **Engine-Agnostic Naming:**
  - Transitioned from `nightly-agy` to `nightly-sweep` label on GitHub while maintaining full backward-compatible queries for the Do-Not-Repeat ledger.
  - Normalized branch naming to `nightly/YYYY-MM-DD` and worktrees to `/tmp/nightly-worktrees/...`.

---

## [2026-10-30]

### Added
- **Initial Pipeline Architecture (`nightly_prompts`):**
  - Automated nightly engineering pipeline for macOS scheduled via `launchd` for 02:00 AM daily.
  - **5 Specialized Engineering Personas:** Security, Performance, Code Health, Cleanup, and Testing.
  - **Zero-Disruption Git Worktrees:** Executes all agent operations in temporary worktrees under `/tmp/` without altering active local IDE branches or uncommitted edits.
  - **GitHub-Backed "Do-Not-Repeat" Memory Ledger:** Queries closed/unmerged PRs and reviewer rejection notes to dynamically exclude previously declined suggestions from future prompts.
  - **Permanent Exclusion Ledger:** Supports `.nightly-ignore.md` / `.agy-ignore.md` inside repositories for permanent file/path guardrails.
  - **Per-Project Prompt Overrides:** Supports custom `.agents/nightly_prompt.md` per repository with fallback to global templates.
  - **Smart Quota Scheduling:** Configured fast models (`Gemini 3.8 Flash`) on weekdays and deep-reasoning models (`Gemini 4 Argon`) on Sundays.
