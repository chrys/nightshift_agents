#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OS_TYPE="$(uname -s)"

echo "=================================================="
echo "🚀 Installing Nightly Autonomous Sweep ($OS_TYPE)..."
echo "=================================================="

# 1. Prerequisite verification: git and gh
if ! command -v git >/dev/null 2>&1; then
  echo "❌ Error: git is not installed or not in PATH." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "⚠️  Warning: GitHub CLI ('gh') was not found in PATH."
  echo "   Please install it via package manager (brew/apt/dnf), then: gh auth login"
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

# 5. OS-Specific Schedule Installation
if [[ "$OS_TYPE" == "Darwin" ]]; then
  echo "🍏 Setting up macOS LaunchAgent..."
  PLIST_DEST="$HOME/Library/LaunchAgents/com.nightly.sweep.plist"
  LEGACY_PLISTS=(
    "$HOME/Library/LaunchAgents/com.agy.nightly.plist"
    "$HOME/Library/LaunchAgents/com.chrys.agy.nightly.plist"
  )
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

  # Check wake schedule
  if command -v pmset >/dev/null 2>&1; then
    if ! pmset -g sched 2>/dev/null | grep -qi "wakeorpoweron"; then
      echo ""
      echo "💡 Tip: macOS launchd jobs only trigger when your Mac is awake."
      echo "   To ensure your Mac automatically wakes at 01:58 AM for the 02:00 AM sweep, run:"
      echo "   sudo pmset repeat wakeorpoweron MTWRFSU 01:58:00"
    fi
  fi

elif [[ "$OS_TYPE" == "Linux" ]]; then
  echo "🐧 Setting up Linux Automated Schedule..."
  SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
  SERVICE_DEST="$SYSTEMD_USER_DIR/nightly-sweep.service"
  TIMER_DEST="$SYSTEMD_USER_DIR/nightly-sweep.timer"

  # Check if systemd user services are functional
  SYSTEMD_AVAILABLE=0
  if command -v systemctl >/dev/null 2>&1; then
    if systemctl --user list-units >/dev/null 2>&1; then
      SYSTEMD_AVAILABLE=1
    fi
  fi

  if [[ "$SYSTEMD_AVAILABLE" -eq 1 ]]; then
    mkdir -p "$SYSTEMD_USER_DIR"
    sed "s|__INSTALL_DIR__|$ROOT_DIR|g" "$ROOT_DIR/systemd/nightly-sweep.service.template" > "$SERVICE_DEST"
    cp "$ROOT_DIR/systemd/nightly-sweep.timer.template" "$TIMER_DEST"

    systemctl --user daemon-reload
    systemctl --user enable --now nightly-sweep.timer

    echo "✅ Loaded Linux systemd user timer at $TIMER_DEST (Scheduled for 02:00 AM daily)"
    echo "   Check timer status anytime via: systemctl --user status nightly-sweep.timer"
  else
    echo "ℹ️  systemd user instance not active (e.g. WSL or container). Falling back to cron..."
    if command -v crontab >/dev/null 2>&1; then
      CRON_CMD="0 2 * * * /bin/bash $ROOT_DIR/bin/nightly_sweep.sh >> /tmp/nightly-sweep.stdout.log 2>> /tmp/nightly-sweep.stderr.log"
      (crontab -l 2>/dev/null | grep -v "nightly_sweep.sh" || true; echo "$CRON_CMD") | crontab -
      echo "✅ Scheduled via user crontab: 02:00 AM daily"
      echo "   Check crontab via: crontab -l"
    else
      echo "⚠️  Neither systemd --user nor crontab is available. You can run manually via:"
      echo "   $ROOT_DIR/bin/nightly_sweep.sh"
    fi
  fi

else
  echo "⚠️  Unrecognized operating system: $OS_TYPE. You can run sweeps manually via:"
  echo "   $ROOT_DIR/bin/nightly_sweep.sh"
fi

echo ""
echo "Next steps:"
echo "  1. Edit $ROOT_DIR/repos.conf and add your local Git repository paths."
echo "     (e.g., '/path/to/repo:main' or '/path/to/repo:develop:claude')"
echo "  2. Test a manual run anytime with: $ROOT_DIR/bin/nightly_sweep.sh"
echo "  3. Check execution logs in: ~/logs/nightly-sweep/<date>/"
if [[ "$OS_TYPE" == "Darwin" ]]; then
  echo "  4. (macOS) To auto-wake from sleep before 02:00 AM:"
  echo "     sudo pmset repeat wakeorpoweron MTWRFSU 01:58:00"
fi
