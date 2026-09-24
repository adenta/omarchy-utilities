import QtQuick
import QtQuick.Effects
import qs.Commons
import qs.Ui

Item {
  id: root

  property string backgroundPath: ""
  property int backgroundVersion: 0
  property bool fingerprintConfigured: false
  property bool authenticatingPassword: false
  property string failureMessage: ""
  property int failedAttempts: 0
  property bool inputEnabled: true
  property bool loadBackground: true
  property string passwordText: ""
  property bool syncingPasswordText: false

  property string faceOutcome: "ready"
  property string faceUpstream: "unknown"
  property bool faceEnrolled: false
  property bool faceChecking: false
  property bool faceEnabled: true
  property var faceRecords: []
  property string faceLogStatus: ""
  property int faceTopMargin: 20
  signal faceRetryRequested()
  signal faceDetailsRequested()

  property bool unlockWindowAvailable: false
  property bool unlockWindowHintVisible: false
  property bool unlockConfirmationPending: false
  property string unlockNotice: ""
  readonly property string placeholderText: unlockConfirmationPending ? "Press Enter again to unlock" : "Enter password"
  readonly property int fieldWidth: 381
  readonly property int fieldHeight: 67
  readonly property int outlineThickness: 3
  readonly property int fieldFontSize: Math.round(Style.font.heading * 1.125)
  readonly property int passwordDotFontSize: Math.round(Style.font.heading * 1.33)
  readonly property int passwordDotLetterSpacing: Math.round(Style.font.heading * 0.19)
  // Space to keep clear on each side of the field for the fingerprint icon
  // (icon width plus a gap) so the centered dots never run under it.
  readonly property real fingerprintReserve: fingerprintConfigured ? Math.round(fingerprintIcon.implicitWidth + 12) : 0
  // Shrink the dots to fit once the password outgrows the field, so every
  // keystroke stays visible — otherwise long passwords clip with no feedback.
  readonly property real passwordDotScale: dotMetrics.advanceWidth > 0
    ? Math.min(1, (passwordInput.width - 4) / dotMetrics.advanceWidth)
    : 1
  readonly property bool showPasswordCursor: inputEnabled && !authenticatingPassword && failureMessage.length === 0
  readonly property bool errorState: failureMessage.length > 0
  readonly property var inputBorderSpec: errorState
    ? Border.surfaceSpec("lock", "border-error", Color.lock.borderError, root.outlineThickness, "border-alpha")
    : Border.surfaceSpec("lock", "border-active", Color.lock.borderActive, root.outlineThickness, "border-alpha")

  signal enterPressed(string password, bool autoRepeat)
  signal enterReleased(bool autoRepeat)
  signal otherKeyPressed()
  signal passwordTextEdited(string password)
  signal clearFailureRequested()
  signal wakeRequested()

  // Cache-busts the lock background by appending `?v=`. Adding a query
  // string keeps Image's loader happy while forcing it to reload when the
  // user picks a new background mid-session.
  function fileUrl(path) {
    if (!path) return ""
    var encoded = String(path).split("/").map(encodeURIComponent).join("/")
    return "file://" + encoded + "?v=" + backgroundVersion
  }

  function forcePasswordFocus() {
    passwordInput.forceActiveFocus()
  }

  function clearPassword() {
    passwordTextEdited("")
  }

  function syncPasswordText() {
    if (passwordInput.text === passwordText) return
    syncingPasswordText = true
    passwordInput.text = passwordText
    syncingPasswordText = false
  }

  onPasswordTextChanged: syncPasswordText()
  PointerMoveGate { id: pointerGate; referenceItem: root }

  onInputEnabledChanged: {
    pointerGate.reset()
    if (inputEnabled) Qt.callLater(forcePasswordFocus)
  }
  Component.onCompleted: {
    syncPasswordText()
    if (inputEnabled) Qt.callLater(forcePasswordFocus)
  }

  // Measures the masked password at full size; passwordDotScale compares this
  // against the field width to decide how far the dots must shrink to fit.
  TextMetrics {
    id: dotMetrics
    font.family: Style.font.family
    font.pixelSize: root.passwordDotFontSize
    font.letterSpacing: root.passwordDotLetterSpacing
    text: "●".repeat(passwordInput.text.length)
  }

  Rectangle {
    anchors.fill: parent
    color: Color.background

    Image {
      id: wallpaper
      anchors.fill: parent
      source: root.loadBackground ? root.fileUrl(root.backgroundPath) : ""
      fillMode: Image.PreserveAspectCrop
      asynchronous: true
      cache: false
      sourceSize.width: width
      sourceSize.height: height
    }

    MultiEffect {
      anchors.fill: wallpaper
      source: wallpaper
      autoPaddingEnabled: false
      blurEnabled: root.loadBackground && wallpaper.status === Image.Ready
      blur: 1.0
      blurMax: 128
      blurMultiplier: 1.25
      contrast: -0.08
    }

    MouseArea {
      anchors.fill: parent
      hoverEnabled: true
      onClicked: { faceStatus.close(); root.wakeRequested(); root.forcePasswordFocus() }
      onPositionChanged: function(mouse) { if (pointerGate.moved(this, mouse)) root.wakeRequested() }
    }

    BorderSurface {
      id: inputField
      width: root.fieldWidth
      height: root.fieldHeight
      anchors.centerIn: parent
      color: Color.lock.background
      borderSpec: root.inputBorderSpec
      radius: Style.cornerRadius
      clip: true

      TextInput {
        id: passwordInput
        objectName: "passwordInput"
        anchors.fill: parent
        anchors.topMargin: inputField.borderTop
        // Reserve the fingerprint icon's width on both sides so the centered
        // dots stay symmetric and never slide under the icon as they grow.
        anchors.rightMargin: inputField.borderRight + 18 + root.fingerprintReserve
        anchors.bottomMargin: inputField.borderBottom
        anchors.leftMargin: inputField.borderLeft + 18 + root.fingerprintReserve
        verticalAlignment: TextInput.AlignVCenter
        horizontalAlignment: TextInput.AlignHCenter
        activeFocusOnPress: true
        clip: true
        enabled: root.inputEnabled && !root.authenticatingPassword
        readOnly: root.authenticatingPassword
        echoMode: TextInput.Password
        passwordCharacter: "\u25CF"
        passwordMaskDelay: 0
        color: Color.lock.text
        selectionColor: Color.lock.selection
        selectedTextColor: Color.lock.text
        font.family: Style.font.family
        font.pixelSize: text.length > 0 ? Math.max(1, Math.floor(root.passwordDotFontSize * root.passwordDotScale)) : root.fieldFontSize
        font.letterSpacing: text.length > 0 ? root.passwordDotLetterSpacing * root.passwordDotScale : 0
        cursorVisible: activeFocus && root.showPasswordCursor && text.length > 0
        cursorDelegate: Rectangle {
          width: 2
          color: Color.lock.text
          visible: passwordInput.cursorVisible
        }

        onTextChanged: {
          if (!root.syncingPasswordText) root.passwordTextEdited(text)
          if (text.length > 0) {
            root.wakeRequested()
          }
          if (text.length > 0 && root.failureMessage.length > 0) root.clearFailureRequested()
        }

        Keys.onReleased: function(event) {
          if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
            root.enterReleased(event.isAutoRepeat)
            event.accepted = true
          }
        }

        Keys.onPressed: function(event) {
          if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
            event.accepted = true // prevent TextInput.accepted from submitting twice
            root.wakeRequested()
            root.enterPressed(root.passwordText, event.isAutoRepeat)
            return
          }
          root.otherKeyPressed()
          if (event.key === Qt.Key_Escape && faceStatus.opened) {
            faceStatus.close()
            event.accepted = true
            return
          }
          root.wakeRequested()
          if (event.key === Qt.Key_Escape || (event.modifiers & Qt.ControlModifier && event.key === Qt.Key_U)) {
            root.passwordTextEdited("")
            event.accepted = true
          }
        }
      }

      Text {
        objectName: "unlockPrompt"
        textFormat: Text.PlainText
        anchors.fill: passwordInput
        text: root.authenticatingPassword ? "Checking…" : (root.failureMessage.length > 0 ? root.failureMessage : root.placeholderText)
        visible: passwordInput.text.length === 0
        color: root.authenticatingPassword ? Color.lock.text : (root.failureMessage.length > 0 ? Color.lock.textError : Color.lock.placeholder)
        font.family: Style.font.family
        font.pixelSize: root.fieldFontSize
        font.italic: !root.authenticatingPassword && root.failureMessage.length > 0
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        fontSizeMode: Text.HorizontalFit
        minimumPixelSize: 12
      }

      // Fingerprint hint pinned inside the field's right edge when a sensor is
      // enrolled, so the user knows they can touch to unlock instead of typing.
      // Matches hyprlock, which draws its fingerprint icon in the same spot.
      Text {
        id: fingerprintIcon
        objectName: "fingerprintIndicator"
        anchors.right: parent.right
        anchors.rightMargin: inputField.borderRight + 18
        anchors.verticalCenter: parent.verticalCenter
        visible: root.fingerprintConfigured
        text: "󰈷"
        color: Color.lock.placeholder
        font.family: Style.font.family
        font.pixelSize: Math.round(root.fieldFontSize * 1.1)
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
      }
    }

    Text {
      objectName: "unlockNotice"
      anchors.top: inputField.bottom
      anchors.topMargin: 12
      anchors.horizontalCenter: inputField.horizontalCenter
      width: Math.min(480, parent.width - 32)
      text: root.unlockNotice.length > 0 ? root.unlockNotice : "↵ twice to unlock"
      visible: root.passwordText.length === 0 && !root.authenticatingPassword &&
        root.failureMessage.length === 0 && (root.unlockNotice.length > 0 ||
        (root.unlockWindowHintVisible && !root.unlockConfirmationPending))
      textFormat: Text.PlainText
      color: Color.lock.placeholder
      opacity: root.unlockNotice.length > 0 ? 1 : 0.62
      font.family: Style.font.family
      font.pixelSize: Math.round(root.fieldFontSize * 0.55)
      horizontalAlignment: Text.AlignHCenter
      wrapMode: Text.WordWrap
    }
  }
  FaceStatus {
    id: faceStatus
    anchors.top: parent.top
    anchors.topMargin: root.faceTopMargin
    anchors.horizontalCenter: parent.horizontalCenter
    width: Math.min(Style.space(380), parent.width - Style.spacing.md * 2)
    height: implicitHeight
    visible: root.faceEnabled && root.loadBackground
    outcome: root.faceOutcome
    upstream: root.faceUpstream
    enrolled: root.faceEnrolled
    checking: root.faceChecking
    records: root.faceRecords
    logStatus: root.faceLogStatus
    retryEnabled: root.inputEnabled
    onRetryRequested: root.faceRetryRequested()
    onDetailsRequested: root.faceDetailsRequested()
    onFocusPasswordRequested: if (root.inputEnabled) root.forcePasswordFocus()
    Keys.onEscapePressed: close()
  }

}
