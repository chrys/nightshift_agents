# Nightly Agy Prompts (`nightly_prompts`)

An autonomous nightly engineering pipeline for **Antigravity IDE (`agy` CLI)** on macOS. 

Wake up every morning to clean, test-verified Pull Requests on GitHub across five Google Jules-inspired engineering personas—without ever polluting your local working tree or repeating declined suggestions.

## ✨ Features

- **5 Specialized Engineering Personas:**
  - 🔒 **Security:** Hunts for IDOR/tenant isolation flaws, injection risks, and broken access controls.
  - ⚡ **Performance:** Eliminates N+1 queries, missing indexes, and CPU/memory bottlenecks with baseline measurements.
  - 🩺 **Code Health:** Refactors high cyclomatic complexity, duplication, and leaky abstractions.
  - 🧹 **Cleanup:** Removes dead code, unused imports, and deprecated calls.
  - 🧪 **Testing:** Closes critical unit/integration test coverage gaps and hardens edge cases.
- **GitHub-Backed "Do-Not-Repeat" Memory Ledger:** Uses GitHub PR state (`nightly-agy` label) as a stateless database. If you close/decline a PR (optionally leaving a comment explaining why), the orchestrator automatically injects that rejected fingerprint and your note into future prompts so the agent never proposes the same change again.
- **Zero-Disruption Git Worktree Isolation:** Checks out temporary branches in `/tmp/agy-worktrees/...` so your active local IDE workspace and uncommitted files are never touched.
- **Smart Quota Scheduling:** Uses fast, quota-friendly models (`Gemini 3.8 Flash`) on weekdays and deep-reasoning models (`Gemini 4 Argon`) on Sundays.

---

## 🚀 Quick Start (macOS)

### 1. Prerequisites
Ensure you have the Antigravity CLI (`agy`) and GitHub CLI (`gh`) installed and authenticated:
```bash
which agy
gh auth status