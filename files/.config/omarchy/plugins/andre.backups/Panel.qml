import QtQuick
import QtQuick.Controls
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "model/Disk.js" as Disk
import "model/Status.js" as Status
import "model/Progress.js" as Progress

Panel {
 id: root
 moduleName: "andre.backups"
 ipcTarget: "andre.backups"
 readonly property string home: Quickshell.env("HOME")
 readonly property string helper: home + "/.local/bin/omarchy-backup"
 readonly property string stateDir: (Quickshell.env("XDG_STATE_HOME") || home + "/.local/state") + "/omarchy-backup"
 readonly property color foreground: bar ? bar.foreground : Color.foreground
 readonly property color urgentColor: bar ? bar.urgent : Color.urgent
 readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family
 property color warningColor: Color.accent
 property var state: ({phase: "unconfigured"})
 property var disk: null
 property double clockNow: Date.now()/1000
 property int cursor: 0
 readonly property bool busy: Status.isBusy(state) && clockNow-(state.updatedAt || 0)<=120
 readonly property string severity: Status.severity(state, clockNow)
 readonly property color statusColor: severity === "error" ? urgentColor : severity === "warning" ? warningColor : severity === "active" ? Color.accent : foreground
 readonly property color adaptiveBarForeground: bar ? bar.barForeground : Color.foreground
 readonly property color barStatusColor: severity === "neutral" || severity === "active" ? adaptiveBarForeground : Qt.rgba(
  statusColor.r * 0.4 + adaptiveBarForeground.r * 0.6,
  statusColor.g * 0.4 + adaptiveBarForeground.g * 0.6,
  statusColor.b * 0.4 + adaptiveBarForeground.b * 0.6, 1)
 readonly property string description: Status.description(state,clockNow)
 readonly property var progressFraction: Progress.fraction(state.progress)
 implicitWidth: group.implicitWidth
 implicitHeight: group.implicitHeight
 function invoke(command) { Quickshell.execDetached([helper, command]) }
 function activate() { if (cursor === 0) invoke(busy ? "cancel" : "now"); else openLogs() }
 function openLogs() { close(); Quickshell.execDetached(["omarchy", "launch", "terminal", "bash", "-c", '"$HOME/.local/bin/omarchy-backup" logs; printf "\\nPress Enter to close"; read -r']) }
 FileView {
  id: stateFile; path: root.stateDir + "/state.json"; watchChanges: true; printErrors: false
  onFileChanged: reload()
  onLoaded: { try { root.state=JSON.parse(text()) } catch(e) { root.state={phase:"failed",reason:"Backup status could not be read"} } }
 }
 FileView {
  id: colors; path: root.home + "/.local/state/omarchy/current/theme/colors.toml"; watchChanges: true; printErrors: false
  onFileChanged: reload()
  onLoaded: { var match=text().match(/(?:^|\n)\s*(?:yellow|color3)\s*=\s*["'](#[0-9a-fA-F]{6})/); root.warningColor=match ? match[1] : Color.accent }
 }
 Process {
  id: diskScan; command: ["bash", Qt.resolvedUrl("bin/disk-usage").toString().replace("file://", "")]
  property string result: ""
  stdout: StdioCollector { onStreamFinished: diskScan.result=text }
  onExited: function(code,status) { root.disk=code===0 ? Disk.parseAdjustedUsage(result) : null; result="" }
 }
 Timer { interval:600000; repeat:true; running:true; triggeredOnStart:true; onTriggered: if(!diskScan.running) diskScan.running=true }
 Timer { interval:5000; repeat:true; running:true; onTriggered: root.clockNow=Date.now()/1000 }
 WidgetButton {
  id: group; anchors.centerIn:parent; bar:root.bar; horizontalMargin:4.5
  text: (root.busy ? "󰑓 " : "󰁯 ") + Status.compactSize(root.state.lastBackupBytes)
  foreground:root.barStatusColor
  tooltipText: "Backups · " + root.description + "\nFiles in last successful backup: " + Status.size(root.state.lastBackupBytes) + "\nLast success: " + Status.dateLabel(root.state.lastSuccess)
  onPressed: root.toggle()
 }
 KeyboardPanel {
  id: panel; anchorItem:group; owner:root; bar:root.bar; open:root.opened; focusTarget:keyCatcher
  contentWidth:panel.fittedContentWidth(Style.space(350))
  contentHeight:panel.fittedContentHeight(column.implicitHeight,Style.space(720))
  PanelKeyCatcher {
   id:keyCatcher; anchors.fill:parent
   onCloseRequested:root.close()
   onTabRequested:function(direction) { root.switchPanel(direction) }
   onMoveRequested:function(dx,dy) { root.cursor=Math.max(0,Math.min(1,root.cursor+(dy||dx))) }
   onActivateRequested:root.activate()
   Flickable {
    anchors.fill:parent; contentWidth:width; contentHeight:column.implicitHeight; clip:true
    boundsBehavior:Flickable.StopAtBounds; flickableDirection:Flickable.VerticalFlick; interactive:contentHeight>height
    ScrollBar.vertical:ScrollBar { policy:ScrollBar.AsNeeded }
    Column {
     id:column; width:parent.width; spacing:Style.space(12)
     PanelHero {
      title:"Backups"; meta:root.description; foreground:root.foreground; fontFamily:root.fontFamily
      iconComponent:Component { Text { text:"󰁯"; color:root.statusColor; font.family:root.fontFamily; font.pixelSize:Style.font.display } }
     }
     PanelSeparator { foreground:root.foreground }
     DetailRow { label:"Last successful backup"; value:Status.dateLabel(root.state.lastSuccess) }
     DetailRow { label:"Files in last successful backup"; value:Status.size(root.state.lastBackupBytes) }
     DetailRow { label:"Next backup"; value:root.busy ? "In progress" : !root.state.lastSuccess || root.clockNow>=root.state.lastSuccess+86400 ? "Due · retries every 15 minutes when eligible" : Status.dateLabel(root.state.lastSuccess+86400) }
     DetailRow { visible:!!root.state.lastError; label:"Last error"; value:root.state.lastError || ""; foreground:root.urgentColor }
     Column {
      width:parent.width; spacing:Style.space(8); visible:root.busy
      ProgressMeter {
       label:"PROGRESS"
       value:root.progressFraction === null ? "Working…" : Math.floor(root.progressFraction * 100) + "%"
       fraction:root.progressFraction === null ? 0 : root.progressFraction
       indeterminate:root.progressFraction === null
       animate:root.busy && root.opened
       foreground:root.foreground; fontFamily:root.fontFamily
       Accessible.role:Accessible.ProgressBar
       Accessible.name:"Backup progress"
       Accessible.description:value
      }
      DetailRow { visible:root.progressFraction !== null; label:"Processed"; value:Progress.label(root.state.progress) }
      DetailRow {
       visible:root.state.phase === "backing-up"
       label:"Estimated backup finish"
       value:Progress.estimate(root.state.progress, root.state.updatedAt, root.clockNow)
      }
     }
     DetailRow { visible:root.disk && (root.disk.usedBytes+root.disk.trashExclusiveBytes)/root.disk.totalBytes>=0.9; label:"Storage warning"; value:"Less than 10% disk space remains"; foreground:root.warningColor }
     PanelSeparator { foreground:root.foreground }
     DetailRow { label:"Last integrity check"; value:Status.dateLabel(root.state.lastMaintenance) }
     Button { width:parent.width; text:root.busy ? "Cancel backup operation" : "Back up now"; iconText:root.busy ? "󰓛" : "󰑓"; bordered:true; hasCursor:root.cursor===0; foreground:root.foreground; onClicked:root.invoke(root.busy ? "cancel" : "now") }
     Button { width:parent.width; text:"View logs"; iconText:"󰆍"; bordered:true; hasCursor:root.cursor===1; foreground:root.foreground; onClicked:root.openLogs() }
    }
   }
  }
 }
}
