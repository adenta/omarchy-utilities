import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "model/Balance.js" as Balance
Panel {
 id:root
 moduleName:"andre.credits"
 ipcTarget:"andre.credits"
 readonly property color foreground:bar ? bar.foreground : Color.foreground
 readonly property string fontFamily:bar ? bar.fontFamily : Style.font.family
 property var balance:null
 property double refreshedAt:0
 property bool failed:false
 property bool attempted:false
 implicitWidth:group.implicitWidth
 implicitHeight:group.implicitHeight
 function refresh() { if(!scan.running) scan.running=true }
 Process {
  id:scan; command:["bash",Qt.resolvedUrl("bin/deepgram-balance").toString().replace("file://", "")]
  property string result:""
  stdout:StdioCollector { onStreamFinished:scan.result=text }
  onExited:function(code,status) {
   var value=Balance.parseUsd(result)
   root.attempted=true
   if(code===0 && value!==null) { root.balance=value; root.refreshedAt=Date.now(); root.failed=false }
   else root.failed=true
   result=""
  }
 }
 Timer { interval:600000; repeat:true; running:true; triggeredOnStart:true; onTriggered:root.refresh() }
 WidgetButton {
  id:group; anchors.centerIn:parent; bar:root.bar; horizontalMargin:4.5
  text:"󰠟 " + (root.balance===null ? "$--" : "$"+root.balance.toFixed(2))
  dimmed:root.failed
  tooltipText:"Credits · Deepgram"+(root.failed ? " · refresh failed" : "")
  onPressed:root.toggle()
 }
 KeyboardPanel {
  id:panel; anchorItem:group; owner:root; bar:root.bar; open:root.opened; focusTarget:keyCatcher
  contentWidth:panel.fittedContentWidth(Style.space(320))
  contentHeight:panel.fittedContentHeight(column.implicitHeight,Style.space(500))
  PanelKeyCatcher {
   id:keyCatcher; anchors.fill:parent
   onCloseRequested:root.close()
   onTabRequested:function(direction) { root.switchPanel(direction) }
   onActivateRequested:root.refresh()
   Column {
    id:column; width:parent.width; spacing:Style.space(12)
    PanelHero { title:"Credits"; meta:"Deepgram"; foreground:root.foreground; fontFamily:root.fontFamily; iconComponent:Component { Text { text:"󰠟"; color:root.foreground; font.family:root.fontFamily; font.pixelSize:Style.font.display } } }
    PanelSeparator { foreground:root.foreground }
    DetailRow { label:"Available balance"; value:root.balance===null ? (scan.running ? "Loading…" : "Unavailable") : "$"+root.balance.toFixed(2) }
    DetailRow { label:"Last refreshed"; value:root.refreshedAt ? new Date(root.refreshedAt).toLocaleString() : "Not yet" }
    DetailRow { visible:root.failed; label:"Status"; value:root.balance===null ? "Could not read balance. Check network access and Keyring." : "Refresh failed. Showing the last known balance." }
    Button { width:parent.width; text:scan.running ? "Refreshing…" : "Refresh"; iconText:"󰑓"; iconSpinning:scan.running; enabled:!scan.running; hasCursor:true; bordered:true; foreground:root.foreground; onClicked:root.refresh() }
   }
  }
 }
}
