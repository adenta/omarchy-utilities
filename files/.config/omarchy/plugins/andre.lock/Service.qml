import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Services.Pam
import Quickshell.Wayland
import qs.Commons

Item {
  id: root

  property var shell: null
  property string omarchyPath: ""

  readonly property string home: Quickshell.env("HOME")
  readonly property string stateHome: home + "/.local/state"
  readonly property string userName: Quickshell.env("USER") || Quickshell.env("LOGNAME")
  readonly property string currentBackgroundLink: stateHome + "/omarchy/current/background"

  // Authentication clones intentionally receive no idleConfig capability, so
  // watch the same user shell.json that drives the idle service. Missing or
  // invalid configuration matches Omarchy's conservative five-minute default.
  property int unlockWindowSeconds: 300
  function unlockWindowSecondsFromConfig(raw) {
    try {
      var parsed = JSON.parse(String(raw || ""))
      var configured = parsed && parsed.version === 1 && parsed.idle
          ? Number(parsed.idle.lock) : NaN
      return Number.isFinite(configured) && configured >= 0 ? Math.floor(configured) : 300
    } catch (error) {
      return 300
    }
  }
  FileView {
    path: root.home + "/.config/omarchy/shell.json"
    watchChanges: true
    printErrors: false
    onLoaded: root.unlockWindowSeconds = root.unlockWindowSecondsFromConfig(text())
    onLoadFailed: root.unlockWindowSeconds = 300
    onFileChanged: reload()
  }

  // Memory-only: a shell restart/recovery always requires authentication.
  readonly property double unlockWindowDurationMs: unlockWindowSeconds * 1000
  property double unlockWindowStartedMs: -1
  property double unlockWindowDeadlineMs: 0
  readonly property double unlockConfirmationDurationMs: 5000
  property double unlockConfirmationDeadlineMs: 0
  property bool unlockWindowAvailable: false
  property bool unlockWindowVisualReady: false
  property bool enterHeld: false
  property bool displayBlanked: false
  property string unlockNotice: ""
  BootClock { id: bootClock }

  function cancelUnlockConfirmation() {
    unlockConfirmationDeadlineMs = 0
    unlockNotice = ""
  }

  function refreshUnlockWindow() {
    if (unlockWindowDeadlineMs <= 0) {
      unlockWindowAvailable = false
      return NaN
    }
    var now = bootClock.readMs()
    if (!Number.isFinite(now) || now < unlockWindowStartedMs || now >= unlockWindowDeadlineMs) {
      var expiredWhileConfirming = unlockConfirmationDeadlineMs > 0 &&
          Number.isFinite(now) && now >= unlockWindowDeadlineMs
      clearUnlockWindow()
      if (expiredWhileConfirming) unlockNotice = "Unlock window ended — enter password"
      return NaN
    }
    unlockWindowAvailable = lockRequested && sessionLock.secure
    if (unlockConfirmationDeadlineMs > 0 && now >= unlockConfirmationDeadlineMs)
      cancelUnlockConfirmation()
    return now
  }

  function handleEnterPressed(value, autoRepeat) {
    if (autoRepeat || enterHeld) return
    enterHeld = true
    if (!lockRequested || authenticatingPassword) return
    var password = String(value || "")
    enteredPassword = ""
    submitPassword(password)
  }

  function handleEnterReleased(autoRepeat) {
    if (!autoRepeat) enterHeld = false
  }

  Timer {
    interval: 100
    repeat: true
    running: root.lockRequested && !root.displayBlanked && root.unlockWindowDeadlineMs > 0
    onTriggered: root.refreshUnlockWindow()
  }

  function clearUnlockWindow() {
    cancelUnlockConfirmation()
    unlockWindowAvailable = false
    unlockWindowVisualReady = false
    unlockWindowStartedMs = -1
    unlockWindowDeadlineMs = 0
  }

  function tryPasswordlessUnlock() {
    if (!lockRequested || !sessionLock.secure || authenticating) return false
    var now = refreshUnlockWindow()
    if (!unlockWindowAvailable || !Number.isFinite(now)) return false
    if (unlockConfirmationDeadlineMs <= 0) {
      failureMessage = ""
      unlockConfirmationDeadlineMs = Math.min(now + unlockConfirmationDurationMs, unlockWindowDeadlineMs)
      return false
    }
    logEvent("unlock-window-used")
    finishUnlock()
    return true
  }

  property bool lockRequested: false
  property bool pendingSessionLock: false
  property bool authenticatingPassword: false
  property bool fingerprintAuthenticating: false
  property bool passwordPamConfigured: false
  property bool fingerprintConfigured: false
  property string enteredPassword: ""
  property string pendingPassword: ""
  property string failureMessage: ""
  property int failedAttempts: 0
  property string backgroundPath: ""
  property int backgroundVersion: 0
  property string lastEvent: "init"
  property string lastEventAt: ""
  property bool strandedLock: false
  property bool strandedLockResolved: false

  readonly property bool locked: lockRequested || sessionLock.locked || sessionLock.secure
  readonly property bool authenticating: authenticatingPassword || fingerprintAuthenticating

  property var observeSettings: ({enabled: true, autoOnReturn: true, topMargin: 20})
  FileView {
    path: root.home + "/.config/omarchy/face-observe.json"
    watchChanges: true
    printErrors: false
    onLoaded: {
      try { var parsed = JSON.parse(text()); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("expected object"); root.observeSettings = parsed } catch (e) { console.warn("andre.lock: invalid face-observe.json; using defaults") }
    }
    onFileChanged: reload()
  }
  FaceObserver {
    id: faceObserver
    userName: root.userName
    allowed: root.lockRequested && sessionLock.secure
    observationEnabled: root.observeSettings.enabled !== false
    autoOnReturn: root.observeSettings.autoOnReturn !== false
  }

  function realScreenCount() {
    var screens = Quickshell.screens || []
    var count = 0

    for (var i = 0; i < screens.length; i++) {
      var screen = screens[i]
      if (screen && screen.name && screen.width > 0 && screen.height > 0) count += 1
    }

    return count
  }

  function hasRealScreen() {
    return realScreenCount() > 0
  }

  function queueSessionLock() {
    pendingSessionLock = true
    if (!sessionLockStabilizeTimer.running) logEvent("lock-pending: screen-stabilizing")
    sessionLockStabilizeTimer.restart()
    if (!pendingSessionLockTimer.running) pendingSessionLockTimer.start()
  }

  function requestSessionLock() {
    if (!lockRequested || sessionLock.locked || sessionLock.secure) return
    if (sessionLockStabilizeTimer.running) return

    if (!hasRealScreen()) {
      if (!pendingSessionLock || lastEvent !== "lock-pending: no-real-screen") logEvent("lock-pending: no-real-screen")
      pendingSessionLock = true
      if (!pendingSessionLockTimer.running) pendingSessionLockTimer.start()
      return
    }

    pendingSessionLock = false
    pendingSessionLockTimer.stop()
    sessionLock.locked = true
  }

  // ext-session-lock outlives its client, and a restart carries no lock over, so
  // a session locked this early is an orphan behind Hyprland's failsafe. Outputs
  // are often still absent here, so ask until the answer means something.
  function checkStrandedLock() {
    if (strandedLockResolved || strandedLockCheckProc.running) return

    // A lock this shell took is nobody's orphan.
    if (locked || lockRequested) {
      strandedLockResolved = true
      return
    }

    strandedLockCheckProc.running = true
  }

  function recoverStrandedLock() {
    if (!strandedLock || locked || !passwordPamConfigured) return

    strandedLock = false
    logEvent("lock-stranded: recovering")
    beginLock()
  }

  function refreshBackground() {
    if (!readlinkProc.running) readlinkProc.running = true
  }

  function refreshFingerprintStatus() {
    if (!fingerprintCheckProc.running) fingerprintCheckProc.running = true
  }

  function logEvent(event) {
    lastEvent = event
    lastEventAt = new Date().toISOString()
    console.log("omarchy lock " + lastEventAt + " " + event)
  }

  function resetAuthenticationState() {
    enteredPassword = ""
    pendingPassword = ""
    failureMessage = ""
    failedAttempts = 0
    authenticatingPassword = false
    fingerprintAuthenticating = false
    fingerprintRetryTimer.stop()
    if (passwordPam.active) passwordPam.abort()
    if (fingerprintPam.active) fingerprintPam.abort()
  }

  function beginLock(allowPasswordlessUnlock) {
    if (!passwordPamConfigured) {
      logEvent("lock-denied: missing-pam")
      return false
    }

    clearUnlockWindow()
    if (allowPasswordlessUnlock === true) {
      var now = bootClock.readMs()
      if (Number.isFinite(now) && now >= 0) {
        unlockWindowStartedMs = now
        unlockWindowDeadlineMs = now + unlockWindowDurationMs
      }
    }
    resetAuthenticationState()
    lockRequested = true
    displayBlanked = false
    enterHeld = false
    refreshUnlockWindow()
    armBlankTimer()
    logEvent("lock-requested")
    queueSessionLock()

    Qt.callLater(function() {
      root.refreshBackground()
      root.refreshFingerprintStatus()
    })

    return true
  }

  function finishUnlock() {
    if (!root.locked && !lockRequested) return

    clearUnlockWindow()
    lockRequested = false
    pendingSessionLock = false
    sessionLockStabilizeTimer.stop()
    pendingSessionLockTimer.stop()
    resetAuthenticationState()
    idleBlankTimer.stop()
    sessionLock.locked = false
    logEvent("unlocked")
    runWake()
  }

  function armBlankTimer() {
    idleBlankTimer.armedAt = Date.now()
    idleBlankTimer.restart()
  }

  function runWake() {
    refreshUnlockWindow()
    displayBlanked = false
    // The hint stays hidden until eligibility has been checked against a fresh
    // boot-clock reading. This prevents a pre-suspend state from flashing on
    // screen while the output is returning.
    unlockWindowVisualReady = true
    if (!wakeProcess.running) wakeProcess.running = true
    if (lockRequested) armBlankTimer()
  }

  function runBlank() {
    cancelUnlockConfirmation()
    unlockWindowVisualReady = false
    displayBlanked = true
    faceObserver.resetCycle() // release camera; next real activity may observe again
    if (!blankProcess.running) blankProcess.running = true
  }

  function submitPassword(value) {
    var password = String(value || "")
    if (!lockRequested || authenticatingPassword) return
    if (password.length === 0) {
      tryPasswordlessUnlock()
      return
    }

    cancelUnlockConfirmation()
    runWake()
    pendingPassword = password
    failureMessage = ""
    authenticatingPassword = true

    if (!passwordPam.start()) {
      handlePasswordFailure()
      return
    }

    Qt.callLater(respondToPasswordPrompt)
  }

  function respondToPasswordPrompt() {
    if (!authenticatingPassword || !passwordPam.active || !passwordPam.responseRequired) return
    passwordPam.respond(pendingPassword)
  }

  function handlePasswordFailure() {
    if (!lockRequested) return

    authenticatingPassword = false
    enteredPassword = ""
    pendingPassword = ""
    failedAttempts += 1
    failureMessage = "Authentication failed (" + failedAttempts + ")"
    runWake()
  }

  function startFingerprint() {
    if (!lockRequested || !sessionLock.secure || !fingerprintConfigured) return
    if (fingerprintPam.active || fingerprintAuthenticating) return

    fingerprintAuthenticating = true
    if (!fingerprintPam.start()) {
      fingerprintAuthenticating = false
    }
  }

  function handleFingerprintFinished(result) {
    fingerprintAuthenticating = false

    if (!lockRequested) return
    if (result === PamResult.Success) {
      finishUnlock()
    } else if (fingerprintConfigured) {
      fingerprintRetryTimer.restart()
    }
  }

  WlSessionLock {
    id: sessionLock

    locked: false

    onSecureStateChanged: {
      root.logEvent("secure=" + secure)
      root.refreshUnlockWindow()
      if (secure) {
        root.pendingSessionLock = false
        sessionLockStabilizeTimer.stop()
        pendingSessionLockTimer.stop()
        root.startFingerprint()
      }
    }

    onLockStateChanged: {
      root.logEvent("session-locked=" + locked)

      if (locked) {
        root.pendingSessionLock = false
        sessionLockStabilizeTimer.stop()
        pendingSessionLockTimer.stop()
      }

      if (!locked && root.lockRequested) {
        root.clearUnlockWindow()
        root.lockRequested = false
        root.pendingSessionLock = false
        sessionLockStabilizeTimer.stop()
        pendingSessionLockTimer.stop()
        root.resetAuthenticationState()
        root.runWake()
      }
    }

    WlSessionLockSurface {
      id: lockSurface
      color: Color.background

      LockView {
        id: lockView
        anchors.fill: parent
        backgroundPath: root.backgroundPath
        backgroundVersion: root.backgroundVersion
        fingerprintConfigured: root.fingerprintConfigured
        authenticatingPassword: root.authenticatingPassword
        failureMessage: root.failureMessage
        failedAttempts: root.failedAttempts
        inputEnabled: root.lockRequested
        loadBackground: root.locked
        passwordText: root.enteredPassword
        unlockWindowAvailable: root.unlockWindowAvailable
        unlockWindowHintVisible: root.unlockWindowVisualReady && root.unlockWindowAvailable
        unlockConfirmationPending: root.unlockConfirmationDeadlineMs > 0
        unlockNotice: root.unlockNotice
        onPasswordTextEdited: function(password) {
          if (password.length > 0) root.cancelUnlockConfirmation()
          root.enteredPassword = password
        }
        onEnterPressed: function(password, autoRepeat) { root.handleEnterPressed(password, autoRepeat) }
        onEnterReleased: function(autoRepeat) { root.handleEnterReleased(autoRepeat) }
        onOtherKeyPressed: root.cancelUnlockConfirmation()
        onClearFailureRequested: root.failureMessage = ""
        faceOutcome: faceObserver.outcome
        faceUpstream: faceObserver.upstream
        faceEnrolled: faceObserver.enrolled
        faceChecking: faceObserver.checking
        faceRecords: faceObserver.records
        faceLogStatus: faceObserver.logStatus
        faceEnabled: faceObserver.observationEnabled
        faceTopMargin: Math.max(8, Math.min(120, Number(root.observeSettings.topMargin) || 20))
        onFaceRetryRequested: { root.runWake(); faceObserver.retry() }
        onFaceDetailsRequested: { root.cancelUnlockConfirmation(); root.runWake(); faceObserver.refresh() }
        onWakeRequested: { root.runWake(); faceObserver.activity() }
      }

    }
  }

  PamContext {
    id: passwordPam
    config: "omarchy-lock-password"
    user: root.userName

    onResponseRequiredChanged: root.respondToPasswordPrompt()
    onPamMessage: root.respondToPasswordPrompt()

    onCompleted: function(result) {
      root.authenticatingPassword = false
      root.pendingPassword = ""

      if (!root.lockRequested) return
      if (result === PamResult.Success) root.finishUnlock()
      else root.handlePasswordFailure()
    }

    onError: function(error) {
      root.handlePasswordFailure()
    }
  }

  PamContext {
    id: fingerprintPam
    config: "omarchy-lock-fingerprint"
    user: root.userName

    onCompleted: function(result) {
      root.handleFingerprintFinished(result)
    }

    onError: function(error) {
      root.fingerprintAuthenticating = false
      if (root.lockRequested && root.fingerprintConfigured) fingerprintRetryTimer.restart()
    }
  }

  Timer {
    id: fingerprintRetryTimer
    interval: 250
    repeat: false
    onTriggered: root.startFingerprint()
  }

  Process {
    id: readlinkProc
    command: ["readlink", "-f", root.currentBackgroundLink]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var next = String(text || "").trim()
        if (next !== root.backgroundPath) {
          root.backgroundPath = next
          root.backgroundVersion += 1
        }
      }
    }
  }

  Process {
    id: fingerprintCheckProc
    command: ["bash", "-c", "if [[ -f /etc/pam.d/omarchy-lock-fingerprint ]] && command -v fprintd-list >/dev/null 2>&1 && fprintd-list \"$USER\" 2>/dev/null | grep -qi finger; then echo yes; else echo no; fi"]
    stdout: StdioCollector { id: fingerprintCheckStdout; waitForEnd: true }
    onExited: {
      root.fingerprintConfigured = String(fingerprintCheckStdout.text || "").trim() === "yes"
      if (root.lockRequested && root.fingerprintConfigured) root.startFingerprint()
      else if (!root.fingerprintConfigured && fingerprintPam.active) fingerprintPam.abort()
    }
  }

  Process {
    id: strandedLockCheckProc
    command: ["bash", "-c", "omarchy-hyprland-session-locked"]
    onExited: function(exitCode) {
      // No output to read the lock off yet.
      if (exitCode === 2) return

      root.strandedLockResolved = true

      // A lock taken while this was in flight is this shell's own.
      root.strandedLock = exitCode === 0 && !root.locked && !root.lockRequested
      root.recoverStrandedLock()
    }
  }

  Process {
    id: wakeProcess
    command: ["bash", "-c", "omarchy-system-wake"]
  }

  Process {
    id: blankProcess
    command: ["bash", "-c", "omarchy-brightness-keyboard off; omarchy-brightness-display off"]
  }

  Timer {
    id: idleBlankTimer
    interval: 60000
    repeat: false
    property double armedAt: 0
    onTriggered: {
      // A countdown frozen by suspend fires right after resume, which would
      // blank the freshly woken unlock screen under the user. Wall-clock time
      // exposes the gap: take a fresh run-up instead of blanking.
      if (Date.now() - armedAt > interval + 2000) {
        root.armBlankTimer()
        return
      }
      // Only a password check in flight should hold the display up. The
      // fingerprint PAM stays armed for the whole lock, so gating on
      // `authenticating` here would keep the panel lit until unlock.
      if (root.lockRequested && !root.authenticatingPassword) root.runBlank()
    }
  }

  Timer {
    id: sessionLockStabilizeTimer
    interval: 500
    repeat: false
    onTriggered: root.requestSessionLock()
  }

  Timer {
    id: pendingSessionLockTimer
    interval: 100
    repeat: true
    onTriggered: root.requestSessionLock()
  }

  Timer {
    id: strandedLockRetryTimer
    interval: 500
    repeat: true
    // Covers the compositor settling; screens coming back re-arm it.
    readonly property int budget: 20
    property int remaining: 20
    running: !root.strandedLockResolved && remaining > 0

    function rearm() {
      if (!root.strandedLockResolved) remaining = budget
    }

    onTriggered: {
      remaining -= 1
      root.checkStrandedLock()
    }
  }

  Connections {
    target: Quickshell
    function onScreensChanged() {
      root.requestSessionLock()

      // An output returning after suspend is the earliest reliable wake cue.
      // Refresh while the visual gate is still closed, then reveal only the
      // current state.
      if (root.lockRequested) root.runWake()

      // A monitor still coming up has no workspace, so cannot answer yet.
      strandedLockRetryTimer.rearm()
      root.checkStrandedLock()
    }
  }

  onAuthenticatingPasswordChanged: {
    if (!authenticatingPassword) enterHeld = false
    if (!lockRequested) return
    if (authenticatingPassword) idleBlankTimer.stop()
    else armBlankTimer()
  }

  FileView {
    path: "/etc/pam.d/omarchy-lock-password"
    watchChanges: true
    printErrors: false
    onLoaded: root.passwordPamConfigured = true
    onLoadFailed: root.passwordPamConfigured = false
    onFileChanged: reload()
  }

  // No lock before PAM is known good. An answer from before then may be stale --
  // the failsafe can be cleared from a TTY -- so re-ask rather than act on it.
  onPasswordPamConfiguredChanged: {
    if (!passwordPamConfigured) return

    strandedLock = false
    strandedLockResolved = false
    strandedLockRetryTimer.rearm()
    checkStrandedLock()
  }

  Component.onCompleted: {
    refreshBackground()
    refreshFingerprintStatus()
    checkStrandedLock()
  }

  IpcHandler {
    target: "lock"

    function lock(): string {
      faceObserver.resetCycle()
      // Explicit/manual and ordinary idle locks revoke any existing window.
      root.clearUnlockWindow()
      if (!root.passwordPamConfigured) return "missing-pam"
      if (!root.locked && !root.beginLock()) return "failed"
      return "ok"
    }

    function lockForSleep(): string {
      faceObserver.resetCycle()
      root.cancelUnlockConfirmation()
      // PrepareForSleep invokes this even if the lid-close request already
      // acquired the lock. Close the presentation gate again immediately
      // before suspend so an old hint cannot be composited on resume.
      root.unlockWindowVisualReady = false
      if (!root.passwordPamConfigured) return "missing-pam"
      // Intentional policy quirk: a new lid/sleep lock starts a fresh window
      // even if the open-lid idle cycle was already underway. With a 15-minute
      // policy this can allow nearly 30 minutes since the last activity.
      // Duplicate lid/sleep requests never extend or grant an existing lock.
      if (!root.locked && !root.beginLock(true)) return "failed"
      return "ok"
    }

    function isLocked(): string {
      return root.locked ? "true" : "false"
    }

    function status(): string {
      return JSON.stringify({
        customization: "andre.lock",
        customizationVersion: "1.4.0",
        unlockWindowAvailable: root.unlockWindowAvailable,
        unlockConfirmationPending: root.unlockConfirmationDeadlineMs > 0,
        unlockWindowDeadlineMs: root.unlockWindowDeadlineMs,
        unlockWindowDurationMs: root.unlockWindowDurationMs,
        faceObservation: faceObserver.outcome,
        faceEnrolled: faceObserver.enrolled,
        upstream: faceObserver.upstream,
        locked: root.locked,
        requested: root.lockRequested,
        pending: root.pendingSessionLock,
        sessionLocked: sessionLock.locked,
        secure: sessionLock.secure,
        realScreens: root.realScreenCount(),
        passwordPam: root.passwordPamConfigured,
        fingerprint: root.fingerprintConfigured,
        authenticating: root.authenticating,
        lastEvent: root.lastEvent,
        lastEventAt: root.lastEventAt
      })
    }

  }
}
