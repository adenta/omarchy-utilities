import QtQuick
import Quickshell.Io

// /proc/uptime counts suspended time and does not follow wall-clock changes.
// Read freshly at each decision; never authorize from cached file contents.
Item {
  id: root
  property bool readSucceeded: false

  FileView {
    id: uptimeFile
    path: "/proc/uptime"
    blockAllReads: true
    printErrors: false
    onLoaded: root.readSucceeded = true
    onLoadFailed: root.readSucceeded = false
  }

  function readMs() {
    readSucceeded = false
    uptimeFile.reload()
    uptimeFile.waitForJob()
    var text = uptimeFile.text().trim()
    if (!readSucceeded || !/^[0-9]+\.[0-9]+\s+[0-9]+\.[0-9]+$/.test(text)) return NaN
    var now = Number(text.split(/\s+/)[0]) * 1000
    return Number.isFinite(now) && now >= 0 ? now : NaN
  }
}
