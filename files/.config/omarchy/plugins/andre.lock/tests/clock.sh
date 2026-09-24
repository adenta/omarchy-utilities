#!/bin/bash
set -euo pipefail
plugin=$(cd "$(dirname "$0")/.." && pwd)
stage=$(mktemp -d /tmp/unlock-clock.XXXXXXXX)
trap 'rm -rf -- "$stage"' EXIT
mkdir -m 700 "$stage/runtime"
cp "$plugin/BootClock.qml" "$stage/"
cat > "$stage/shell.qml" <<'EOF'
import QtQuick
import Quickshell
ShellRoot {
  id: root
  property double first: -1
  BootClock { id: clock }
  Component.onCompleted: first = clock.readMs()
  Timer {
    interval: 250; running: true
    onTriggered: {
      var second = clock.readMs()
      var ok = Quickshell.env("EXPECT_CLOCK") === "valid"
          ? Number.isFinite(root.first) && second >= root.first + 150
          : !Number.isFinite(root.first) && !Number.isFinite(second)
      console.log(ok ? "PASS: clock" : "FAIL: clock", root.first, second)
      Qt.quit()
    }
  }
}
EOF
for mode in valid missing malformed; do
  cp "$plugin/BootClock.qml" "$stage/BootClock.qml"
  if [[ $mode != valid ]]; then
    sed -i "s|/proc/uptime|$stage/uptime|g" "$stage/BootClock.qml"
    [[ $mode != malformed ]] || printf 'invalid\n' > "$stage/uptime"
  fi
  EXPECT_CLOCK=$mode XDG_RUNTIME_DIR="$stage/runtime" QT_QPA_PLATFORM=offscreen \
    QT_QPA_PLATFORMTHEME=basic QT_QUICK_BACKEND=software timeout 8s quickshell -p "$stage" > "$stage/log" 2>&1
  if ! rg -q 'PASS: clock' "$stage/log"; then cat "$stage/log"; exit 1; fi
  echo "PASS: clock $mode"
done
