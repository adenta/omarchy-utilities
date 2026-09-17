#!/bin/bash
# Exercise Quickshell's real PAM helper with a private, unprivileged test stack.
# No live PAM changes or camera requests. Needs the installed Quickshell runtime.
set -euo pipefail
plugin=$(cd "$(dirname "$0")/.." && pwd)
stage=$(mktemp -d /tmp/lock-observe-runtime.XXXXXXXX)
trap 'rm -rf -- "$stage"' EXIT
cp -r -- "$plugin" "$stage/Lock"
mkdir "$stage/pam" "$stage/state"
# Replace only the test copy's PAM lookup directory.
sed -i '/config: "omarchy-face-observe"/a\      configDirectory: Quickshell.env("OBSERVE_TEST_PAM")' "$stage/Lock/FaceObserver.qml"
cat > "$stage/shell.qml" <<'QML'
import QtQuick
import Quickshell
import "Lock" as Lock
ShellRoot {
  Lock.FaceObserver { id: observer; userName: Quickshell.env("USER"); allowed: true }
  Timer {
    interval: 500; running: true
    onTriggered: { observer.enrolled = true; observer.servicePresent = true; observer.start(false) }
  }
  Timer {
    interval: 1000; running: Quickshell.env("EXPECT_OUTCOME") === "cancelled"
    onTriggered: observer.allowed = false
  }
  Timer {
    interval: 2500; running: true
    onTriggered: {
      if (observer.outcome === Quickshell.env("EXPECT_OUTCOME") && !observer.checking)
        console.log("PASS: runtime " + observer.outcome)
      else console.log("FAIL: runtime " + observer.outcome)
      Qt.quit()
    }
  }
}
QML
for result in accepted rejected cancelled; do
  case $result in
    accepted) printf 'auth required pam_permit.so\n' > "$stage/pam/omarchy-face-observe" ;;
    rejected) printf 'auth required pam_deny.so\n' > "$stage/pam/omarchy-face-observe" ;;
    cancelled) printf 'auth required pam_exec.so quiet /usr/bin/sleep 4\nauth required pam_permit.so\n' > "$stage/pam/omarchy-face-observe" ;;
  esac
  printf 'account requisite pam_deny.so\nsession requisite pam_deny.so\n' >> "$stage/pam/omarchy-face-observe"
  EXPECT_OUTCOME=$result OBSERVE_TEST_PAM="$stage/pam" XDG_STATE_HOME="$stage/state" \
    QT_QPA_PLATFORM=offscreen QT_QPA_PLATFORMTHEME=basic QT_QUICK_BACKEND=software \
    timeout 8s quickshell -p "$stage" > "$stage/output" 2>&1
  if ! rg -q "PASS: runtime $result" "$stage/output"; then cat "$stage/output"; exit 1; fi
  echo "PASS: runtime $result"
done
