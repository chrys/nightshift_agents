# Nightly Prompts (`nightly_prompts`)

An autonomous nightly engineering sweep pipeline for macOS supporting **Antigravity (`agy`)**, **Claude Code (`claude`)**, and **OpenCode (`opencode`)**.

Wake up every morning to clean, test-verified Pull Requests on GitHub across five specialized engineering personas—without polluting your local working tree or repeating declined suggestions.

---

## ✨ Features

- **Multi-Engine AI Support:**
  - 🤖 **Antigravity (`agy`):** Google's agentic CLI with Gemini models and sandboxed execution.
  - 🧠 **Claude Code (`claude`):** Anthropic's agentic coding CLI with Sonnet/Opus models.
  - 💻 **OpenCode (`opencode`):** Open-source terminal agent with multi-provider model routing.
  - Choose globally or mix-and-match per repository.
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
- **Smart Model Scheduling:**
  - Run fast, quota-friendly models on weekdays and deeper-reasoning models on Sundays.

---

## 🚀 Quick Start (macOS)

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

Edit `repos.conf` to add your local repositories. You can use your global default engine or override it per repository:

```bash
# Global engine: "agy" | "claude" | "opencode"
ENGINE="agy"

# Repositories to scan
REPOS=(
  "$HOME/Projects/backend-service"               # Uses global engine (agy)
  "$HOME/Projects/frontend-app:claude"          # Overrides to Claude Code
  "$HOME/Projects/internal-tool:opencode"       # Overrides to OpenCode
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
  The installer automatically registers a macOS LaunchAgent at `~/Library/LaunchAgents/com.nightly.sweep.plist` scheduled for **2:00 AM daily**.
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
To override the default prompt for a specific project, place a custom `nightly_prompt.md` inside `.agents/nightly_prompt.md` in that repository.


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

Edit `repos.conf` to add your local repositories. You can use your global default engine or override it per repository:

```bash
# Global engine: "agy" | "claude" | "opencode"
ENGINE="agy"

# Repositories to scan
REPOS=(
  "$HOME/Projects/backend-service"               # Uses global engine (agy)
  "$HOME/Projects/frontend-app:claude"          # Overrides to Claude Code
  "$HOME/Projects/internal-tool:opencode"       # Overrides to OpenCode
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
  The installer automatically registers a macOS LaunchAgent at `~/Library/LaunchAgents/com.nightly.sweep.plist` scheduled for **2:00 AM daily**.
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
To override the default prompt for a specific project, place a custom `nightly_prompt.md` inside `.agents/nightly_prompt.md` in that repository.