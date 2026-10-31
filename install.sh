#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_DEST="$HOME/Library/LaunchAgents/com.nightly.sweep.plist"
LEGACY_PLISTS=(
  "$HOME/Library/LaunchAgents/com.agy.nightly.plist"
  "$HOME/Library/LaunchAgents/com.chrys.agy.nightly.plist"
)

echo "=================================================="
echo "🚀 Installing Nightly Autonomous Sweep..."
echo "=================================================="

# 1. Prerequisite verification: git and gh
if ! command -v git >/dev/null 2>&1; then
  echo "❌ Error: git is not installed or not in PATH." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "⚠️  Warning: GitHub CLI ('gh') was not found in PATH."
  echo "   Please install it via: brew install gh && gh auth login"
fi

# 2. Select AI Engine
CHOSEN_ENGINE="${ENGINE:-}"
if [[ -z "$CHOSEN_ENGINE" ]]; then
  if [[ -t 0 ]]; then
    echo ""
    echo "Select your default AI engine:"
    echo "  1) agy      (Google Antigravity CLI)"
    echo "  2) claude   (Anthropic Claude Code CLI)"
    echo "  3) opencode (OpenCode CLI)"
    read -r -p "Enter choice [1-3] (Default: 1): " ENGINE_CHOICE
    case "$ENGINE_CHOICE" in
      2|claude)   CHOSEN_ENGINE="claude" ;;
      3|opencode) CHOSEN_ENGINE="opencode" ;;
      *)          CHOSEN_ENGINE="agy" ;;
    esac
  else
    CHOSEN_ENGINE="agy"
  fi
fi

echo "Selected Engine: $CHOSEN_ENGINE"

# Verify CLI availability for chosen engine
case "$CHOSEN_ENGINE" in
  agy)
    if ! command -v agy >/dev/null 2>&1; then
      echo "⚠️  Note: 'agy' CLI was not found on your current PATH."
      echo "   Ensure ~/.gemini/bin or your Antigravity installation is in PATH."
    else
      echo "✅ Found 'agy' executable."
    fi
    ;;
  claude)
    if ! command -v claude >/dev/null 2>&1; then
      echo "⚠️  Note: 'claude' CLI was not found on your current PATH."
      echo "   Install Claude Code via: npm install -g @anthropic-ai/claude-code"
    else
      echo "✅ Found 'claude' executable."
    fi
    ;;
  opencode)
    if ! command -v opencode >/dev/null 2>&1; then
      echo "⚠️  Note: 'opencode' CLI was not found on your current PATH."
      echo "   Install OpenCode CLI via npm/pip or your package manager."
    else
      echo "✅ Found 'opencode' executable."
    fi
    ;;
esac

# 3. Create or update repos.conf
if [[ ! -f "$ROOT_DIR/repos.conf" ]]; then
  sed "s/^ENGINE=\"agy\"/ENGINE=\"$CHOSEN_ENGINE\"/" "$ROOT_DIR/repos.conf.example" > "$ROOT_DIR/repos.conf"
  echo "✅ Created repos.conf with ENGINE=\"$CHOSEN_ENGINE\"."
  echo "   Edit $ROOT_DIR/repos.conf to add your local Git repository paths."
else
  echo "ℹ️  repos.conf already exists, keeping existing configuration."
fi

# 4. Ensure executable permissions
chmod +x "$ROOT_DIR/bin/nightly_sweep.sh"

# 5. Generate and load macOS LaunchAgent
mkdir -p "$HOME/Library/LaunchAgents"

# Unload legacy agy launch agents if present
for OLD_PLIST in "${LEGACY_PLISTS[@]}"; do
  if [[ -f "$OLD_PLIST" ]]; then
    launchctl unload "$OLD_PLIST" 2>/dev/null || true
    rm -f "$OLD_PLIST"
  fi
done

sed "s|__INSTALL_DIR__|$ROOT_DIR|g" "$ROOT_DIR/launchd/com.nightly.sweep.plist.template" > "$PLIST_DEST"

launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"

echo "✅ Loaded macOS LaunchAgent at $PLIST_DEST (Scheduled for 02:00 AM daily)"
echo ""
echo "Next steps:"
echo "  1. Edit $ROOT_DIR/repos.conf and add your local Git repository paths."
echo "     (Optional: override engine per-repo with '/path/to/repo:claude')"
echo "  2. Test a manual run anytime with: $ROOT_DIR/bin/nightly_sweep.sh"
echo "  3. Check execution logs in: ~/logs/nightly-sweep/<date>/"
