import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Observation.js" as Observation

// Rendered inside the existing session-lock surface; never creates a window.
Item {
  id: root
  property string outcome: "ready"
  property string upstream: "unknown"
  property bool enrolled: false
  property bool checking: false
  property bool retryEnabled: true
  property bool opened: false
  property var records: []
  property string logStatus: ""
  property color acceptedColor: Color.accent
  property color rejectedColor: Color.urgent
  signal retryRequested()
  signal detailsRequested()
  signal focusPasswordRequested()
  implicitHeight: controls.height + (opened ? details.height + Style.spacing.sm : 0)
  readonly property color stateColor: outcome === "accepted" ? acceptedColor : (outcome === "rejected" || outcome === "timeout" ? rejectedColor : (outcome === "checking" ? Color.accent : Color.muted))
  readonly property string stateIcon: ({ready:"\uf030", checking:"\uf110", accepted:"\uf058", rejected:"\uf05e", timeout:"\uf017", unavailable:"\uf070", cancelled:"\uf04d", disabled:"\uf070"})[outcome] || "\uf070"

  function close() { opened = false; focusPasswordRequested() }
  function toggle() {
    opened = !opened
    if (opened) detailsRequested()
    focusPasswordRequested()
  }
  function loadPalette(raw) {
    var green = raw.match(/^green\s*=\s*"(#[0-9a-fA-F]{6})"/m)
    var yellow = raw.match(/^yellow\s*=\s*"(#[0-9a-fA-F]{6})"/m)
    acceptedColor = green ? green[1] : Color.accent
    rejectedColor = yellow ? yellow[1] : Color.urgent
  }
  FileView {
    id: paletteFile
    path: Quickshell.env("HOME") + "/.local/state/omarchy/current/theme/colors.toml"
    watchChanges: true
    printErrors: false
    onLoaded: root.loadPalette(text())
    onFileChanged: reload()
  }
  onVisibleChanged: { if (!visible) opened = false; else paletteFile.reload() }

  BorderSurface {
    id: controls
    anchors.horizontalCenter: parent.horizontalCenter
    width: controlRow.width + Style.spacing.sm * 2
    height: controlRow.height + Style.spacing.xs * 2
    radius: Style.cornerRadius
    color: Color.popups.background
    borderSpec: Border.surfaceSpec("popups", "border", Color.popups.border, Style.normalBorderWidth, "border-alpha")
    Row {
      id: controlRow
      anchors.centerIn: parent
      spacing: Style.spacing.xs
      PanelActionButton {
        id: scanButton
        objectName: "faceStatusButton"
        iconText: root.stateIcon
        foreground: root.stateColor
        tooltipText: Observation.label(root.outcome)
        size: Style.space(32)
        focusable: true
        onClicked: root.toggle()
        SequentialAnimation on opacity {
          running: root.checking
          loops: Animation.Infinite
          NumberAnimation { to: 0.4; duration: 450 }
          NumberAnimation { to: 1; duration: 450 }
          onStopped: scanButton.opacity = 1
        }
      }
      PanelActionButton {
        objectName: "faceRetryButton"
        iconText: "\uf01e"
        tooltipText: "Retry face check"
        enabled: root.retryEnabled && !root.checking
        size: Style.space(28)
        focusable: true
        onClicked: { root.retryRequested(); root.focusPasswordRequested() }
      }
      PanelActionButton {
        objectName: "lockUpstreamButton"
        visible: root.upstream === "changed"
        iconText: "\uf0ad"
        foreground: root.rejectedColor
        tooltipText: "Stock lock screen changed — review available"
        size: Style.space(28)
        focusable: true
        onClicked: { root.opened = true; root.detailsRequested(); root.focusPasswordRequested() }
      }
      PanelActionButton {
        objectName: "faceDetailsButton"
        iconText: root.opened ? "\uf106" : "\uf107"
        tooltipText: "Recognition details"
        size: Style.space(24)
        focusable: true
        onClicked: root.toggle()
      }
    }
  }
  BorderSurface {
    id: details
    objectName: "faceDetailsPanel"
    visible: root.opened
    anchors.top: controls.bottom
    anchors.topMargin: Style.spacing.sm
    width: parent.width
    height: Math.min(content.implicitHeight + Style.spacing.md * 2, Math.max(100, root.parent.height * 0.35))
    color: Color.popups.background
    radius: Style.cornerRadius
    borderSpec: Border.surfaceSpec("popups", "border", Color.popups.border, Style.normalBorderWidth, "border-alpha")
    // Consume panel clicks so they cannot fall through to the background.
    MouseArea { anchors.fill: parent; onClicked: root.focusPasswordRequested() }
    Flickable {
      anchors.fill: parent
      anchors.margins: Style.spacing.md
      clip: true
      contentHeight: content.implicitHeight
      boundsBehavior: Flickable.StopAtBounds
      Column {
        id: content
        width: parent.width
        spacing: Style.spacing.sm
        PanelSectionHeader { text: "FACE RECOGNITION" }
        Text {
          width: parent.width
          textFormat: Text.PlainText
          text: Observation.label(root.outcome) + "  ·  Observe only"
          color: root.stateColor
          font.family: Style.font.family
          font.pixelSize: Style.font.body
          wrapMode: Text.Wrap
        }
        Text {
          width: parent.width
          textFormat: Text.PlainText
          text: root.enrolled ? "Enrollment ready · PAM result + elapsed time" : "No usable enrollment detected"
          color: Color.popups.text
          font.family: Style.font.family
          font.pixelSize: Style.font.bodySmall
          wrapMode: Text.Wrap
        }
        PanelSeparator { }
        PanelSectionHeader { text: "RECENT OBSERVATIONS" }
        Text {
          visible: root.records.length === 0
          textFormat: Text.PlainText
          text: "No observations yet"
          color: Color.muted
          font.family: Style.font.family
          font.pixelSize: Style.font.bodySmall
        }
        Repeater {
          model: root.records
          delegate: Text {
            required property var modelData
            width: content.width
            textFormat: Text.PlainText
            text: new Date(modelData.timestamp).toLocaleTimeString(Qt.locale(), "HH:mm:ss") + "  " + Observation.label(modelData.outcome) + "  ·  " + (Number(modelData.duration_ms) / 1000).toFixed(2) + " s"
            color: modelData.outcome === "accepted" ? root.acceptedColor : Color.popups.text
            font.family: Style.font.family
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.Wrap
          }
        }
        Text {
          visible: root.logStatus !== ""
          text: root.logStatus
          textFormat: Text.PlainText
          color: root.rejectedColor
          font.family: Style.font.family
          font.pixelSize: Style.font.bodySmall
        }
        PanelSeparator { }
        Text {
          width: parent.width
          textFormat: Text.PlainText
          text: root.upstream === "changed" ? "Installed Omarchy lock code changed. Review and merge upstream changes before advancing the baseline." : (root.upstream === "current" ? "Stock lock baseline is current" : "Stock lock baseline check unavailable")
          color: root.upstream === "changed" ? root.rejectedColor : Color.muted
          font.family: Style.font.family
          font.pixelSize: Style.font.bodySmall
          wrapMode: Text.Wrap
        }
      }
    }
  }
}
