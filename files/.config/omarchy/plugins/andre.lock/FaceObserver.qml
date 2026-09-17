import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Services.Pam
import "Observation.js" as Observation

// Deliberately receives no password, lock object, or authorization callback.
Item {
  id: root
  required property string userName
  property bool allowed: false
  property bool observationEnabled: true
  property bool autoOnReturn: true
  property var state: Observation.fresh()
  property var conversation: null
  property bool enrolled: false
  property bool servicePresent: false
  property bool wantAutomatic: false
  property string upstream: "unknown"
  property var records: []
  property int recordRevision: 0
  property var writeQueue: []
  property string logStatus: ""
  readonly property bool checking: state.pending !== 0
  readonly property string outcome: !observationEnabled ? "disabled" : state.outcome
  readonly property string statusText: Observation.label(outcome)
  readonly property string helper: Qt.resolvedUrl("observation-log").toString().replace("file://", "")
  readonly property string checker: Qt.resolvedUrl("check-upstream").toString().replace("file://", "")
  property double lastActivity: 0

  function refresh() {
    if (!enrollmentCheck.running) enrollmentCheck.running = true
    if (!upstreamCheck.running) upstreamCheck.running = true
    if (!historyRead.running && !historyWrite.running && writeQueue.length === 0) historyRead.running = true
    pamFile.reload()
  }
  function resetCycle() {
    cancel()
    state = Observation.rearm(state)
    wantAutomatic = false
    refresh()
  }
  function activity() {
    lastActivity = Date.now()
    if (!allowed || !observationEnabled || !autoOnReturn || state.attempted || checking) return
    wantAutomatic = true
    if (enrollmentCheck.running) return
    start(true)
  }
  function retry() {
    if (!allowed || !observationEnabled || checking || conversation) return
    wantAutomatic = false
    // Refresh enrollment when the user explicitly retries after enrolling.
    retryPending = true
    if (!enrollmentCheck.running) enrollmentCheck.running = true
  }
  property bool retryPending: false
  function start(automatic) {
    wantAutomatic = false
    if (!allowed || !observationEnabled || conversation) return
    var next = Observation.begin(state, Date.now(), automatic)
    if (!next) return
    state = next
    if (!enrolled || !servicePresent) { complete(next.pending, "unavailable"); return }
    conversation = pamFactory.createObject(root, { attemptId: next.pending })
    watchdog.restart()
    if (!conversation.start()) complete(next.pending, "unavailable")
  }
  function complete(id, result) {
    var next = Observation.finish(state, id, result, Date.now())
    if (!next) return
    var elapsed = Math.max(0, Date.now() - state.started)
    state = next // invalidate before abort(), which may emit a completion
    watchdog.stop()
    var old = conversation
    conversation = null
    if (old) { if (old.active) old.abort(); old.destroy() }
    var entry = { timestamp: new Date().toISOString(), attempt: id, outcome: next.outcome, duration_ms: elapsed }
    recordRevision += 1
    records = [entry].concat(records).slice(0, 10)
    writeQueue = writeQueue.concat([entry])
    flushLog()
  }
  function cancel() {
    retryPending = false
    wantAutomatic = false
    if (checking) complete(state.pending, "cancelled")
  }
  function flushLog() {
    if (historyWrite.running || !writeQueue.length) return
    var entry = writeQueue[0]
    writeQueue = writeQueue.slice(1)
    historyWrite.command = ["timeout", "2s", helper, "append", JSON.stringify(entry)]
    historyWrite.running = true
  }
  onAllowedChanged: {
    if (allowed) resetCycle()
    else cancel()
  }
  onObservationEnabledChanged: { if (!observationEnabled) cancel() }
  Component.onCompleted: refresh()
  Component.onDestruction: { if (conversation && conversation.active) conversation.abort() }

  Component {
    id: pamFactory
    PamContext {
      required property int attemptId
      config: "omarchy-face-observe"
      user: root.userName
      // Even PamResult.Success is only telemetry. No credential/session calls.
      onCompleted: function(result) {
        root.complete(attemptId, result === PamResult.Success ? "accepted" : (result === PamResult.Failed || result === PamResult.MaxTries ? "rejected" : "unavailable"))
      }
      onError: root.complete(attemptId, "unavailable")
      // This lane is face-only; never answer a password prompt.
      onResponseRequiredChanged: if (responseRequired) root.complete(attemptId, "unavailable")
    }
  }
  Timer { id: watchdog; interval: 10000; onTriggered: root.complete(root.state.pending, "timeout") }
  FileView {
    id: pamFile
    path: "/etc/pam.d/omarchy-face-observe"
    watchChanges: true
    printErrors: false
    onLoaded: root.servicePresent = true
    onLoadFailed: root.servicePresent = false
    onFileChanged: reload()
  }
  Process {
    id: enrollmentCheck
    command: ["timeout", "2s", "facelock", "is-enrolled", "--quiet"]
    onExited: function(code) {
      root.enrolled = code === 0
      if (root.retryPending) { root.retryPending = false; root.start(false) }
      else if (root.wantAutomatic && Date.now() - root.lastActivity < 2500) root.start(true)
      else root.wantAutomatic = false
    }
  }
  Process {
    id: upstreamCheck
    command: ["timeout", "2s", root.checker]
    stdout: StdioCollector { id: upstreamOutput; waitForEnd: true }
    onExited: function(code) {
      var result = upstreamOutput.text.trim()
      root.upstream = code === 0 && (result === "current" || result === "changed") ? result : "unknown"
    }
  }
  Process {
    id: historyRead
    property int revision: 0
    onRunningChanged: if (running) revision = root.recordRevision
    command: ["timeout", "2s", root.helper, "read"]
    stdout: StdioCollector { id: historyOutput; waitForEnd: true }
    onExited: function(code) {
      if (code !== 0) { root.logStatus = "History unavailable"; return }
      // Do not overwrite a result produced while the read was in flight.
      if (root.recordRevision !== revision || root.checking || root.writeQueue.length || historyWrite.running) return
      try { root.records = JSON.parse(historyOutput.text); root.logStatus = "" } catch (e) { root.logStatus = "History unavailable" }
    }
  }
  Process {
    id: historyWrite
    onExited: function(code) {
      root.logStatus = code === 0 ? "" : "Could not save observation"
      Qt.callLater(root.flushLog)
    }
  }
}
