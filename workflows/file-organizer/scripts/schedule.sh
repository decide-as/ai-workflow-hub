#!/usr/bin/env bash
# schedule.sh — install / remove / inspect the File Organizer launchd agent.
#
# The desktop app's Enable/Disable buttons call this, and you can run it directly.
#
# Subcommands:
#   enable    write the LaunchAgent plist and load it (runs organize.py on a timer)
#   disable   unload the agent and delete its plist
#   status    print one line of JSON: {installed, loaded, lastRunAt, ...}
#
# Configuration via environment (the app sets these; defaults otherwise):
#   FO_TARGET        folder to organize           (default: ~/Downloads)
#   FO_INTERVAL      seconds between runs          (default: 3600)
#   FO_MIN_AGE_DAYS  only move files older than N   (default: 7; 0 = everything)
#   FO_LABEL         launchd label                 (default: as.decide.workflow-hub.file-organizer)
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORGANIZE="$DIR/organize.py"

TARGET="${FO_TARGET:-$HOME/Downloads}"
TARGET="${TARGET/#\~/$HOME}"
INTERVAL="${FO_INTERVAL:-3600}"
MIN_AGE_DAYS="${FO_MIN_AGE_DAYS:-7}"
LABEL="${FO_LABEL:-as.decide.workflow-hub.file-organizer}"

PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/workflow-hub"
LOG="$LOG_DIR/$LABEL.log"
DOMAIN="gui/$(id -u)"

# Previous label used before the project was renamed from ai-workflow-hub.
LEGACY_LABEL="as.decide.ai-workflow-hub.file-organizer"
LEGACY_LOG="$HOME/Library/Logs/ai-workflow-hub/$LEGACY_LABEL.log"

py_bin() { command -v python3 || command -v python || echo /usr/bin/python3; }

cmd_enable() {
  local python
  python="$(py_bin)"
  mkdir -p "$(dirname "$PLIST")" "$LOG_DIR"

  # Retire the legacy job from the pre-rename era if it is still loaded.
  if launchctl print "$DOMAIN/$LEGACY_LABEL" >/dev/null 2>&1; then
    launchctl bootout "$DOMAIN/$LEGACY_LABEL" 2>/dev/null || true
    rm -f "$HOME/Library/LaunchAgents/$LEGACY_LABEL.plist"
    echo "retired legacy job $LEGACY_LABEL"
  fi
  cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>$python</string>
        <string>$ORGANIZE</string>
        <string>$TARGET</string>
        <string>--execute</string>
        <string>--min-age-days</string>
        <string>$MIN_AGE_DAYS</string>
    </array>
    <key>StartInterval</key>
    <integer>$INTERVAL</integer>
    <key>RunAtLoad</key>
    <false/>
    <key>ProcessType</key>
    <string>Background</string>
    <key>StandardOutPath</key>
    <string>$LOG</string>
    <key>StandardErrorPath</key>
    <string>$LOG</string>
</dict>
</plist>
PLIST_EOF
  # Replace any stale instance, then load.
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  launchctl bootstrap "$DOMAIN" "$PLIST"
  echo "enabled $LABEL — every ${INTERVAL}s on $TARGET (files older than ${MIN_AGE_DAYS}d)"
}

cmd_disable() {
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "disabled $LABEL"
}

cmd_status() {
  local installed=false loaded=false last_run=null effective_log="$LOG"
  [ -f "$PLIST" ] && installed=true
  launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1 && loaded=true

  # Use the current log if it exists; fall back to the legacy log from
  # the pre-rename era so the Logs button shows history before Enable is clicked.
  if [ -f "$LOG" ]; then
    last_run="\"$(stat -f %Sm -t %Y-%m-%dT%H:%M:%S "$LOG")\""
  elif [ -f "$LEGACY_LOG" ]; then
    effective_log="$LEGACY_LOG"
    last_run="\"$(stat -f %Sm -t %Y-%m-%dT%H:%M:%S "$LEGACY_LOG")\""
  fi

  printf '{"installed":%s,"loaded":%s,"lastRunAt":%s,"target":"%s","intervalSeconds":%s,"minAgeDays":%s,"logPath":"%s"}\n' \
    "$installed" "$loaded" "$last_run" "$TARGET" "$INTERVAL" "$MIN_AGE_DAYS" "$effective_log"
}

case "${1:-}" in
  enable)  cmd_enable ;;
  disable) cmd_disable ;;
  status)  cmd_status ;;
  *) echo "usage: $0 {enable|disable|status}" >&2; exit 64 ;;
esac
