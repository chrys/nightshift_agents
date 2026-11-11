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
- **Daily Persona Rotation Schedule:**
  - Eliminates category bias (e.g. repeated security IDOR findings) by rotating focus each day of the week:
    - ⚡ **Monday:** Performance (N+1 queries, indexes, caching, memory/CPU bottlenecks)
    - 🔒 **Tuesday:** Security (IDOR/tenant isolation, input validation, CSRF/XSS)
    - 🧪 **Wednesday:** Testing & Reliability (closing critical coverage gaps, error handling)
    - 🩺 **Thursday:** Code Health (cyclomatic complexity, DRY refactoring, domain modeling)
    - 🧹 **Friday:** Cleanup & Dead Code (pruning obsolete code, stale flags, unused imports)
    - 🧪 **Saturday:** Edge Cases & Hardening (stress testing, boundary guards, race conditions)
    - 🛡️ **Sunday:** Deep Architectural Audit (comprehensive audit paired with deep reasoning models)
- **macOS Sleep Prevention & Wake Scheduling:**
  - Self-wraps execution with `caffeinate -dimsu` on macOS to prevent display, idle, disk, and system sleep while sweeps and test suites run.
  - Setup guidance for configuring automatic system wake before scheduled 02:00 AM runs (`pmset repeat wakeorpoweron`).
- **Self-Learning Architectural Memory:**
  - Before each sweep, the orchestrator inspects newly closed/rejected PRs with comments.
  - Automatically runs an AI distillation query on reviewer feedback to detect permanent architectural boundaries or technology constraints (e.g. *"no plans for cross-tenant functionality"*).
  - Automatically appends extracted rules to the local `.nightly-ignore.md` (e.g. `### Architectural Rule (from PR #91)`), permanently preventing future sweeps from proposing rejected architectural patterns across the entire codebase.
- **Clean Worktree Isolation & Metadata Exclusion:**
  - Checks out temporary branches under `/tmp/nightly-worktrees/...` so your active IDE workspace, branch checkouts, and uncommitted edits are never touched.
  - Automatically excludes orchestrator metadata (`.nightly_pr_meta.env`, `NIGHTLY_REPORT.md`) via `.git/info/exclude` to guarantee no unwanted files or cleanup commits pollute the repository history.
- **PR Backlog Throttling & Test Gate:**
  - Pauses new sweeps if unmerged automated PRs reach `MAX_OPEN_PRS` to prevent review queue accumulation.
  - Optional `TEST_COMMAND` gate ensures failing runs discard changes before opening a PR.
- **Cross-Platform Electron Desktop Cockpit:**
  - Complete native desktop app for macOS, Linux, and Windows.
  - Visually manage repositories, view PR activity feeds and Do-Not-Repeat ledgers, edit architectural rules, inspect historical logs, and trigger manual sweeps with live streaming terminal output.
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
PERSONA_ROTATION=true     # Daily rotation: Mon=Perf, Tue=Sec, Wed=Test, Thu=Health, Fri=Clean, Sat=Harden, Sun=Arch
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
    > **Note on macOS Sleep:** `launchd` only triggers jobs while the system is awake. To wake your Mac automatically before the 02:00 AM sweep, set a wake schedule:
    > ```bash
    > sudo pmset repeat wakeorpoweron MTWRFSU 01:58:00
    > ```
    > Once started, `nightly_sweep.sh` automatically keeps your Mac awake using `caffeinate -dimsu` until the entire sweep completes.
  - **Linux (`systemd --user`):** Registered as a systemd user timer at `~/.config/systemd/user/nightly-sweep.timer` (`systemctl --user status nightly-sweep.timer`).
  - **Linux (Cron fallback):** If systemd user services are not running (e.g. in WSL or containers), automatically configured in user `crontab` (`0 2 * * *`).
- **Logs:**
  Execution logs are stored daily in `~/logs/nightly-sweep/<YYYY-MM-DD>/<repo_name>.log`.

---

## 🖥️ Electron Desktop Cockpit (macOS, Linux, Windows)

A modern desktop application is included under `ui/` to monitor, configure, and trigger sweeps visually.

```bash
cd ui
npm install
npm run build
npm start
```

For live development with hot reload:
```bash
npm run dev
```

### Features
* **Project Sidebar:** Add or remove local Git repositories via native directory picker; configure target branch and engine overrides visually.
* **PR Activity & Do-Not-Repeat Ledger:** Inspect open, merged, and rejected PRs with full Change-Fingerprints, Target-Scopes, and reviewer comments.
* **Architectural Rules Viewer/Editor:** View static guardrails and auto-distilled architectural rules learned from rejected PRs, with live in-app editing of `.nightly-ignore.md`.
* **Historical Logs & Live Terminal:** Browse historical execution logs or watch live sweep progress with colored ANSI terminal output.
* **Interactive Sweep Launcher:** Trigger an immediate sweep on a single project or run a full batch across all repositories, with the ability to safely abort running sweeps.

---

## ⚙️ Customization & Exclusions

### Permanent File Exclusions (`.nightly-ignore.md`)
Add a `.nightly-ignore.md` (or `.agy-ignore.md`) to any repository root to instruct the sweep agent to permanently skip specific modules, directories, or migration paths. 

The orchestrator also **automatically learns and updates** this file when you reject a PR and leave a review comment specifying an architectural constraint:

```markdown
# Repository Exclusions
- Do NOT touch `src/legacy/`
- Do NOT modify database migrations under `db/migrations/`

### Architectural Rule (from PR #91)
- **No Multi-Tenancy / Cross-Tenant Scope:** There are no plans for cross-tenant functionality in this application. Do NOT propose cross-tenant isolation, tenant-scoping, or multi-tenant IDOR refactorings.
```

### Custom Prompts Per Repo (`.agents/nightly_prompt.md`)
To override the default prompt for a specific project, place a custom `nightly_prompt.md` inside `.agents/nightly_prompt.md` in that repository. If absent, the orchestrator automatically falls back to `templates/nightly_prompt.md`.
