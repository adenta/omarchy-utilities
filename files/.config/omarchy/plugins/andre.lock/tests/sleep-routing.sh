#!/bin/bash
set -euo pipefail
plugin=$(cd "$(dirname "$0")/.." && pwd)
stage=$(mktemp -d /tmp/unlock-routing.XXXXXXXX)
trap 'rm -rf -- "$stage"' EXIT
mkdir -p "$stage/plugin/sleep-ipc" "$stage/stock/bin"
cp "$plugin/sleep-dispatch" "$stage/plugin/"
# Substitute only the terminal IPC executable, so no live lock is requested.
sed "s|/usr/bin/omarchy-shell|$stage/record-ipc|g" "$plugin/sleep-ipc/omarchy-shell" > "$stage/plugin/sleep-ipc/omarchy-shell"
cat > "$stage/record-ipc" <<'EOF'
#!/bin/bash
printf '%s\n' "$*"
EOF
cat > "$stage/stock/bin/omarchy-system-lid-close" <<'EOF'
#!/bin/bash
omarchy-shell lock lock
omarchy-shell lock status
EOF
cat > "$stage/stock/bin/omarchy-system-sleep-monitor" <<'EOF'
#!/bin/bash
# Nested exec models the inherited PATH through systemd-inhibit and its monitor.
exec bash -c 'omarchy-shell lock lock; omarchy-shell lock isLocked'
EOF
chmod +x "$stage/record-ipc" "$stage/plugin/sleep-ipc/omarchy-shell" "$stage/stock/bin/"*
before=$PATH
[[ $(OMARCHY_PATH="$stage/stock" "$stage/plugin/sleep-dispatch" lid) == $'lock lockForSleep\nlock status' ]]
[[ $(OMARCHY_PATH="$stage/stock" "$stage/plugin/sleep-dispatch" monitor) == $'lock lockForSleep\nlock isLocked' ]]
[[ $PATH == "$before" ]]
if "$stage/plugin/sleep-dispatch" invalid >/dev/null 2>&1; then exit 1; fi
echo 'PASS: sleep-only IPC translation, nested environment, unchanged status calls and parent PATH'
