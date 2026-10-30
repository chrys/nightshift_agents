#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_DEST="$HOME/Library/LaunchAgents/com.agy.nightly.plist"

echo "🚀 Installing Nightly Agy Sweep..."

# 1. Create repos.conf if not exists
if [[ ! -f "$ROOT_DIR/repos.conf" ]]; then
  cp "$ROOT_DIR/repos.conf.example" "$ROOT_DIR/repos.conf"
  echo "✅ Created repos.conf from template. Edit $ROOT_DIR/repos.conf to add your repo paths."
else
  echo "ℹ️  repos.conf already exists, keeping existing configuration."
fi

# 2. Ensure executable permissions
chmod +x "$ROOT_DIR/bin/nightly_agy_sweep.sh"

# 3. Generate and load macOS LaunchAgent
mkdir -p "$HOME/Library/LaunchAgents"
sed "s|__INSTALL_DIR__|$ROOT_DIR|g" "$ROOT_DIR/launchd/com.agy.nightly.plist.template" > "$PLIST_DEST"

launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"

echo "✅ Loaded macOS LaunchAgent at $PLIST_DEST (Scheduled for 02:00 AM daily)"
echo ""
echo "Next steps:"
echo "  1. Edit $ROOT_DIR/repos.conf and add your local Git repository paths."
echo "  2. Ensure '/tmp/agy-worktrees' is in your ~/.gemini/antigravity-cli/settings.json trustedWorkspaces."
echo "  3. Test a manual run anytime with: $ROOT_DIR/bin/nightly_agy_sweep.sh"
EOF

