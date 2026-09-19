import QtQuick
import QtCore
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "model/Balance.js" as Balance

Panel {
  id: root
  moduleName: "andre.credits"
  ipcTarget: "andre.credits"
  readonly property color foreground: bar ? bar.foreground : Color.foreground
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family
  property var deepgram: Balance.empty()
  property var modal: Balance.empty()
  property int cursorIndex: 0
  readonly property string selected: Balance.selection(preferences.provider)
  readonly property var selectedState: selected === "modal" ? modal : deepgram
  readonly property bool refreshing: deepgramScan.running || modalScan.running
  implicitWidth: group.implicitWidth
  implicitHeight: group.implicitHeight

  Settings {
    id: preferences
    location: "file://" + (Quickshell.env("XDG_CONFIG_HOME") || Quickshell.env("HOME") + "/.config") + "/omarchy/credits.ini"
    category: "andre.credits"
    property string provider: ""
  }
  Component.onCompleted: { if (preferences.provider !== root.selected) preferences.provider = root.selected }
  function choose(provider) { preferences.provider = Balance.toggleSelection(root.selected, provider) }
  function refresh() {
    if (!deepgramScan.running) deepgramScan.running = true
    if (!modalScan.running) modalScan.running = true
  }
  function activate() {
    if (cursorIndex === 0) choose("deepgram")
    else if (cursorIndex === 1) choose("modal")
    else if (!refreshing) refresh()
  }
  function status(state) {
    if (state.error) return state.error + (state.refreshedAt ? " · showing last value" : "")
    return state.refreshedAt ? "Updated " + new Date(state.refreshedAt).toLocaleTimeString(Qt.locale(), "h:mm AP") : "Not yet refreshed"
  }
  Process {
    id: deepgramScan
    command: ["bash", Qt.resolvedUrl("bin/deepgram-balance").toString().replace("file://", "")]
    property string result: ""
    stdout: StdioCollector { onStreamFinished: deepgramScan.result = text }
    onExited: function(code, status) {
      root.deepgram = Balance.update(root.deepgram, result, code, Date.now())
      result = ""
    }
  }
  Process {
    id: modalScan
    command: ["bash", Qt.resolvedUrl("bin/modal-usage").toString().replace("file://", "")]
    property string result: ""
    stdout: StdioCollector { onStreamFinished: modalScan.result = text }
    onExited: function(code, status) {
      root.modal = Balance.updateModal(root.modal, result, code, Date.now())
      result = ""
    }
  }
  Timer { interval: 3600000; repeat: true; running: true; triggeredOnStart: true; onTriggered: root.refresh() }
  WidgetButton {
    id: group
    anchors.centerIn: parent
    bar: root.bar
    horizontalMargin: 4.5
    text: "󰠟" + (root.selected ? " " + Balance.display(root.selectedState, "$--") : "")
    dimmed: !!root.selected && !!root.selectedState.error
    tooltipText: "Credits" + (root.selected ? (root.selected === "modal" ? " · Modal · Used this month" : " · Deepgram · Remaining") + (root.selectedState.error ? " · " + root.selectedState.error : "") : "")
    onPressed: root.toggle()
  }
  KeyboardPanel {
    id: panel
    anchorItem: group
    owner: root
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(360))
    contentHeight: panel.fittedContentHeight(column.implicitHeight, Style.space(500))
    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onMoveRequested: function(dx, dy) { if (dy) root.cursorIndex = (root.cursorIndex + dy + 3) % 3 }
      onActivateRequested: root.activate()
      Column {
        id: column
        width: parent.width
        spacing: Style.spacing.md
        PanelHero {
          title: "Credits"
          meta: "Balances and monthly usage"
          foreground: root.foreground
          fontFamily: root.fontFamily
          iconComponent: Component { Text { text: "󰠟"; color: root.foreground; font.family: root.fontFamily; font.pixelSize: Style.font.display } }
        }
        PanelSeparator { foreground: root.foreground }
        Row {
          width: parent.width
          Text { width: parent.width * 0.55; text: "Service"; color: root.foreground; opacity: 0.7; font.family: root.fontFamily; font.pixelSize: Style.font.caption }
          Text { width: parent.width * 0.45; text: "USD"; horizontalAlignment: Text.AlignRight; color: root.foreground; opacity: 0.7; font.family: root.fontFamily; font.pixelSize: Style.font.caption }
        }
        Repeater {
          model: ["deepgram", "modal"]
          delegate: Column {
            id: service
            required property string modelData
            required property int index
            readonly property var state: modelData === "modal" ? root.modal : root.deepgram
            readonly property bool loading: modelData === "modal" ? modalScan.running : deepgramScan.running
            readonly property string label: modelData === "modal" ? "Modal" : "Deepgram"
            width: column.width
            spacing: Style.spacing.sm
            CursorSurface {
              width: parent.width
              implicitHeight: Style.spacing.controlHeight + Style.spacing.sm
              foreground: root.foreground
              hasCursor: root.cursorIndex === service.index
              Accessible.role: Accessible.CheckBox
              Accessible.name: "Show " + service.label + " in bar"
              Accessible.checkable: true
              Accessible.checked: root.selected === service.modelData
              Accessible.onPressAction: root.choose(service.modelData)
              Row {
                anchors.fill: parent
                spacing: Style.spacing.sm
                ToggleSwitch {
                  id: serviceSwitch
                  anchors.verticalCenter: parent.verticalCenter
                  checked: root.selected === service.modelData
                  interactive: false
                  foreground: root.foreground
                }
                Text { width: parent.width * 0.45 - serviceSwitch.width; height: parent.height; verticalAlignment: Text.AlignVCenter; text: service.label; color: root.foreground; font.family: root.fontFamily; font.pixelSize: Style.font.body }
                Text { width: parent.width * 0.55 - 2 * Style.spacing.sm; height: parent.height; verticalAlignment: Text.AlignVCenter; horizontalAlignment: Text.AlignRight; text: Balance.display(service.state, service.loading ? "Loading…" : "Unavailable"); color: root.foreground; font.family: root.fontFamily; font.pixelSize: Style.font.body }
              }
              MouseArea { anchors.fill: parent; hoverEnabled: true; onEntered: root.cursorIndex = service.index; onClicked: root.choose(service.modelData) }
            }
            Text { width: parent.width; text: (service.modelData === "modal" ? "Used this month" + (service.state.cycle ? " (" + service.state.cycle + ")" : "") : "Remaining") + " · " + root.status(service.state); wrapMode: Text.WordWrap; color: root.foreground; opacity: 0.7; font.family: root.fontFamily; font.pixelSize: Style.font.caption }
            PanelSeparator { width: parent.width; foreground: root.foreground }
          }
        }
        Button {
          width: parent.width
          text: root.refreshing ? "Refreshing…" : "Refresh"
          iconText: "󰑓"
          iconSpinning: root.refreshing
          enabled: !root.refreshing
          hasCursor: root.cursorIndex === 2
          bordered: true
          foreground: root.foreground
          onHovered: function(hovered) { if (hovered) root.cursorIndex = 2 }
          onClicked: root.refresh()
        }
        Text { text: "Refreshes hourly · Select a row to show it in the bar"; color: root.foreground; opacity: 0.7; font.family: root.fontFamily; font.pixelSize: Style.font.caption }
      }
    }
  }
}
