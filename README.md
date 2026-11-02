# Nightly Prompts (`nightly_prompts`)

An autonomous nightly engineering sweep pipeline for **macOS and Linux** supporting **Antigravity (`agy`)**, **Claude Code (`claude`)**, and **OpenCode (`opencode`)**.

Wake up every morning to clean, test-verified Pull Requests on GitHub across five specialized engineering personas—without polluting your local working tree or repeating declined suggestions.

---

## ✨ Features

- **Multi-Engine AI Support:**
  - 🤖 **Antigravity (`agy`):** Google's agentic CLI with Gemini models and sandboxed execution.
  - 🧠 **Claude Code (`claude`):** Anthropic's agentic coding CLI with Sonnet/Opus models.
  - 💻 **OpenCode (`opencode`):** Open-source terminal agent with multi-provider model routing.
  - Configure a global default engine or mix-and-match per repository.
- **Per-Repository Destination Branch:**
  - Configure target branches individually per project (e.g., target `main` on one repo and `develop` on another).
- **Git Remote Auto-Detection:**
  - Dynamically discovers the repository's active remote name (e.g. `github`, `origin`, or primary upstream) rather than hardcoding `origin`.
- **Automatic Tech Stack & Test Detection:**
  - Auto-detects project ecosystems (`uv`, `poetry`, `pytest`, `Django`, `npm`, `pnpm`, `yarn`, `bun`, `cargo`, `go`) and injects test and lint commands directly into the prompt context to skip cold-start exploration.
- **Target-First & Synchronous Execution:**
  - Enforces targeted module testing during development and runs the full test suite synchronously only during final verification, eliminating idle polling loops.
- **Permanent Git History Documentation:**
  - Embeds the full `NIGHTLY_REPORT.md` (fingerprint, target scope, rationale, and measurements) directly into the Git commit body so architectural decisions persist in `git log` and `git blame`.
- **5 Specialized Engineering Personas:**
  - 🔒 **Security:** Hunts for IDOR/tenant isolation flaws, injection risks, and broken access controls.
  - ⚡ **Performance:** Eliminates N+1 queries, missing indexes, and CPU/memory bottlenecks with baseline measurements.
  - 🩺 **Code Health:** Refactors high cyclomatic complexity, duplication, and leaky abstractions.
  - 🧹 **Cleanup:** Removes dead code, unused imports, and deprecated calls.
  - 🧪 **Testing:** Closes critical unit/integration test coverage gaps and hardens edge cases.
- **GitHub-Backed "Do-Not-Repeat" Memory Ledger:**
  - Uses GitHub PR state (`nightly-sweep` and legacy `nightly-agy` labels) as a stateless database.
  - When you decline/close an automated PR (and optionally comment why), the orchestrator injects that rejected fingerprint and your review note into subsequent prompts so the agent never proposes the same change again.
- **Zero-Disruption Git Worktree Isolation:**
  - Checks out temporary branches under `/tmp/nightly-worktrees/...` so your active IDE workspace, branch checkouts, and uncommitted edits are never touched.
- **PR Backlog Throttling & Test Gate:**
  - Pauses new sweeps if unmerged automated PRs reach `MAX_OPEN_PRS` to prevent review queue accumulation.
  - Optional `TEST_COMMAND` gate ensures failing runs discard changes before opening a PR.
- **Smart Model Scheduling:**
  - Run fast, quota-friendly models on weekdays and deeper-reasoning models on Sundays.

---

## 🚀 Quick Start (macOS & Linux)

### 1. Prerequisites

Ensure you have `git`, GitHub CLI (`gh`), and at least one supported AI engine installed:

```bash
# Core tools
git --version
gh auth status

# Supported AI engines (choose one or more)
which agy       # Antigravity CLI
which claude    # Claude Code CLI (npm i -g @anthropic-ai/claude-code)
which opencode  # OpenCode CLI
```

### 2. Run Installation

Run `./install.sh`. It will prompt you to pick your default engine (`agy`, `claude`, or `opencode`), create your `repos.conf`, and register the macOS LaunchAgent:

```bash
./install.sh
```

### 3. Configure Repositories (`repos.conf`)

Edit `repos.conf` to add your local repositories. You can specify destination branches and/or engine overrides per repository:

```bash
# Global engine: "agy" | "claude" | "opencode"
ENGINE="agy"

# Repositories to scan
# Syntax: "/path/to/repo[:branch][:engine]"
REPOS=(
  "$HOME/Projects/backend-service:main"          # Targets 'main' branch
  "$HOME/Projects/frontend-app:develop"         # Targets 'develop' branch
  "$HOME/Projects/internal-tool:develop:claude" # Targets 'develop' with Claude Code
)

# Engine model schedules (weekday vs Sunday deep sweep)
AGY_WEEKDAY_MODEL="Gemini 3.8 Flash (High)"
AGY_SUNDAY_MODEL="Gemini 4 Argon (Medium)"

CLAUDE_WEEKDAY_MODEL=""   # Leave blank for Claude Code default or specify e.g. "claude-3-7-sonnet-20250219"
CLAUDE_SUNDAY_MODEL=""

OPENCODE_WEEKDAY_MODEL="" # Leave blank for OpenCode default or specify e.g. "openai/gpt-4o"
OPENCODE_SUNDAY_MODEL=""

# Quality & Backlog Controls
MAX_OPEN_PRS=3            # Skip sweep if 3 or more automated PRs are currently awaiting review
TEST_COMMAND=""           # Optional: e.g. "pytest -q" or "npm test" before opening PR
```

### 4. Test Run & Scheduling

- **Manual Test:**
  Run an immediate sweep across all configured repositories:
  ```bash
  ./bin/nightly_sweep.sh
  ```
- **Automated Schedule:**
  - **macOS (`launchd`):** Registered as a LaunchAgent at `~/Library/LaunchAgents/com.nightly.sweep.plist` (02:00 AM daily).
  - **Linux (`systemd --user`):** Registered as a systemd user timer at `~/.config/systemd/user/nightly-sweep.timer` (`systemctl --user status nightly-sweep.timer`).
  - **Linux (Cron fallback):** If systemd user services are not running (e.g. in WSL or containers), automatically configured in user `crontab` (`0 2 * * *`).
- **Logs:**
  Execution logs are stored daily in `~/logs/nightly-sweep/<YYYY-MM-DD>/<repo_name>.log`.

---

## ⚙️ Customization & Exclusions

### Permanent File Exclusions (`.nightly-ignore.md`)
Add a `.nightly-ignore.md` (or `.agy-ignore.md`) to any repository root to instruct the sweep agent to permanently skip specific modules, directories, or migration paths:

```markdown
# Repository Exclusions
- Do NOT touch `src/legacy/`
- Do NOT modify database migrations under `db/migrations/`
```

### Custom Prompts Per Repo (`.agents/nightly_prompt.md`)
To override the default prompt for a specific project, place a custom `nightly_prompt.md` inside `.agents/nightly_prompt.md` in that repository. If absent, the orchestrator automatically falls back to `templates/nightly_prompt.md`.
