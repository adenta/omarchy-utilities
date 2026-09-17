import QtQuick
import Quickshell.Io
import qs.Commons
import qs.Ui
import "History.js" as History

Column {
  id: root
  required property bool opened
  required property color foreground
  required property string fontFamily
  property int rangeIndex: 1
  readonly property var ranges: [3600, 86400, 604800]
  property var points: []
  property var powerPoints: []
  readonly property color powerColor: Color.background.hslLightness > 0.5 ? "#a45000" : "#f4b45f"
  property int displayedSpan: 86400
  readonly property bool showPower: true
  readonly property int sampleInterval: displayedSpan === 3600 ? 60 : (displayedSpan === 86400 ? 300 : 1800)
  property double endTime: Date.now() / 1000
  readonly property double startTime: endTime - displayedSpan
  readonly property var groups: History.segments(points, startTime, endTime)
  readonly property var powerGroups: History.powerSegments(powerPoints, startTime, endTime, sampleInterval)
  readonly property real powerMaximum: History.powerCeiling(powerGroups)
  property string errorText: ""
  property bool loaded: false
  property int requestedIndex: 1
  property double requestedEnd: 0
  property var hoveredPoint: null
  property double hoveredTime: 0
  readonly property var hoveredPower: hoveredTime ? History.nearPower(powerGroups, hoveredTime, sampleInterval) : null
  spacing: Style.space(8)

  function selectRange(index) {
    if (index >= 0 && index < ranges.length) rangeIndex = index
  }

  function fetch() {
    if (!opened || historyProc.running) return
    requestedIndex = rangeIndex
    requestedEnd = Date.now() / 1000
    historyProc.command = ["bash", Qt.resolvedUrl("bin/battery-history").toString().replace("file://", ""), String(ranges[rangeIndex]), "all"]
    historyProc.running = true
  }

  function finish(code) {
    if (!opened) return
    if (requestedIndex !== rangeIndex) { Qt.callLater(fetch); return }
    try {
      if (code !== 0) throw new Error("History unavailable")
      var payload = JSON.parse(historyOutput.text)
      var next = History.parse(JSON.stringify(payload.charge))
      var nextPower = History.parse(JSON.stringify(payload.rate), "rate")
      points = next
      powerPoints = nextPower
      displayedSpan = ranges[requestedIndex]
      endTime = requestedEnd
      loaded = true
      errorText = ""
      hoveredPoint = null
      hoveredTime = 0
    } catch (error) {
      errorText = loaded ? "Refresh failed · showing previous history" : "Battery history unavailable"
    }
  }

  function timeLabel(time) {
    return Qt.formatDateTime(new Date(time * 1000), displayedSpan > 86400 ? "ddd d" : (displayedSpan === 86400 ? "ddd h:mm AP" : "h:mm AP"))
  }

  onOpenedChanged: {
    if (opened) fetch()
    else { historyProc.running = false; hoveredPoint = null; hoveredTime = 0 }
  }
  onRangeIndexChanged: fetch()
  onGroupsChanged: plot.requestPaint()
  onPowerGroupsChanged: plot.requestPaint()
  onPowerMaximumChanged: plot.requestPaint()
  onPowerColorChanged: plot.requestPaint()
  onHoveredTimeChanged: plot.requestPaint()
  onForegroundChanged: plot.requestPaint()
  onHoveredPointChanged: plot.requestPaint()
  Component.onCompleted: if (opened) fetch()

  Process {
    id: historyProc
    stdout: StdioCollector { id: historyOutput; waitForEnd: true }
    stderr: StdioCollector { waitForEnd: true }
    onExited: function(exitCode, exitStatus) { root.finish(exitCode) }
  }
  Timer { interval: 30000; repeat: true; running: root.opened; onTriggered: root.fetch() }

  PanelSectionHeader { text: "BATTERY HISTORY"; foreground: root.foreground; fontFamily: root.fontFamily }

  Row {
    width: parent.width
    spacing: Style.space(6)
    Repeater {
      model: ["1 hour", "24 hours", "7 days"]
      Button {
        required property string modelData
        required property int index
        width: (root.width - Style.space(12)) / 3
        text: modelData
        active: root.rangeIndex === index
        bordered: true
        foreground: root.foreground
        fontFamily: root.fontFamily
        fontSize: Style.font.caption
        verticalPadding: Style.space(4)
        tooltipText: "Press " + (index + 1) + " to select"
        onClicked: root.selectRange(index)
      }
    }
  }

  Row {
    visible: root.showPower
    spacing: Style.space(18)
    Text {
      text: "━ Charge · %"
      color: root.foreground
      font.family: root.fontFamily; font.pixelSize: Style.font.caption
    }
    Text {
      text: "● Battery draw · W"
      color: root.powerColor
      font.family: root.fontFamily; font.pixelSize: Style.font.caption
    }
  }

  Item {
    width: parent.width
    height: Style.space(112)
    Repeater {
      model: [100, 50, 0]
      Text {
        required property int modelData
        text: modelData + "%"
        color: root.foreground
        opacity: 0.55
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
        y: Style.space(6) + (1 - modelData / 100) * (parent.height - Style.space(12)) - height / 2
      }
    }
    Repeater {
      model: root.showPower ? [1, 0.5, 0] : []
      Text {
        required property real modelData
        text: (root.powerMaximum * modelData) + " W"
        color: root.powerColor
        opacity: 0.8
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
        anchors.right: parent.right
        y: Style.space(6) + (1 - modelData) * (parent.height - Style.space(12)) - height / 2
      }
    }
    Canvas {
      id: plot
      anchors { left: parent.left; leftMargin: Style.space(38); right: parent.right; rightMargin: root.showPower ? Style.space(48) : 0; top: parent.top; bottom: parent.bottom }
      readonly property real inset: Style.space(6)
      function px(point) { return (point.time - root.startTime) / root.displayedSpan * width }
      function py(point) { return inset + (1 - point.value / 100) * (height - 2 * inset) }
      function wy(point) { return inset + (1 - point.value / root.powerMaximum) * (height - 2 * inset) }
      onWidthChanged: requestPaint()
      onHeightChanged: requestPaint()
      onPaint: {
        var ctx = getContext("2d")
        ctx.clearRect(0, 0, width, height)
        ctx.strokeStyle = root.foreground
        ctx.globalAlpha = 0.13
        ctx.lineWidth = 1
        for (var level = 0; level <= 100; level += 50) {
          var y = py({value: level})
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
        }
        ctx.globalAlpha = 0.95
        ctx.lineWidth = Style.space(1.6)
        ctx.lineJoin = "round"
        ctx.lineCap = "round"
        ctx.strokeStyle = root.powerColor
        ctx.fillStyle = root.powerColor
        ctx.globalAlpha = 0.8
        root.powerGroups.forEach(function(group) {
          group.forEach(function(point) {
            ctx.beginPath()
            ctx.arc(px(point), wy(point), Style.space(1.8), 0, Math.PI * 2)
            ctx.fill()
          })
        })
        ctx.globalAlpha = 0.95
        ctx.strokeStyle = root.foreground
        ctx.fillStyle = root.foreground
        root.groups.forEach(function(group) {
          ctx.beginPath()
          group.forEach(function(point, index) {
            if (index === 0) ctx.moveTo(px(point), py(point))
            else ctx.lineTo(px(point), py(point))
          })
          ctx.stroke()
          if (group.length === 1) {
            ctx.beginPath(); ctx.arc(px(group[0]), py(group[0]), Style.space(2.5), 0, Math.PI * 2); ctx.fill()
          }
        })
        if (root.hoveredTime) {
          var cursor = px({time: root.hoveredTime})
          ctx.globalAlpha = 0.35
          ctx.beginPath(); ctx.moveTo(cursor, inset); ctx.lineTo(cursor, height - inset); ctx.stroke()
          ctx.globalAlpha = 1
          if (root.hoveredPoint) {
            var point = root.hoveredPoint
            ctx.beginPath(); ctx.arc(px(point), py(point), Style.space(3), 0, Math.PI * 2); ctx.fill()
          }
          if (root.hoveredPower) {
            ctx.fillStyle = root.powerColor
            ctx.beginPath(); ctx.arc(px(root.hoveredPower), wy(root.hoveredPower), Style.space(3), 0, Math.PI * 2); ctx.fill()
          }
        }
      }
      MouseArea {
        anchors.fill: parent
        hoverEnabled: true
        acceptedButtons: Qt.NoButton
        onPositionChanged: function(mouse) {
          root.hoveredTime = root.startTime + mouse.x / width * root.displayedSpan
          root.hoveredPoint = History.nearest(root.groups, root.hoveredTime)
        }
        onExited: { root.hoveredPoint = null; root.hoveredTime = 0 }
      }
      Text {
        anchors.centerIn: parent
        visible: root.groups.length === 0 && root.powerGroups.length === 0
        text: historyProc.running ? "Loading history…" : (root.errorText ? "History unavailable" : "No readings in this range")
        color: root.foreground
        opacity: 0.7
        font.family: root.fontFamily
        font.pixelSize: Style.font.caption
      }
    }
  }

  Item {
    width: parent.width
    height: leftLabel.implicitHeight
    Text {
      id: leftLabel
      x: Style.space(38)
      text: root.timeLabel(root.startTime)
      color: root.foreground; opacity: 0.55
      font.family: root.fontFamily; font.pixelSize: Style.font.caption
    }
    Text {
      anchors.right: parent.right
      anchors.rightMargin: root.showPower ? Style.space(48) : 0
      text: root.timeLabel(root.endTime)
      color: root.foreground; opacity: 0.55
      font.family: root.fontFamily; font.pixelSize: Style.font.caption
    }
  }
  Text {
    width: parent.width
    text: root.showPower
      ? (root.hoveredTime
        ? Qt.formatDateTime(new Date(root.hoveredTime * 1000), "MMM d, h:mm AP") + " · " + (root.hoveredPower ? root.hoveredPower.value.toFixed(1) + " W draw" : "No draw reading")
        : (root.errorText || (root.displayedSpan === 3600 ? "Power shown while discharging · scale adjusts" : "Discharge averages · " + (root.sampleInterval / 60) + " min resolution")))
      : (root.hoveredPoint
        ? Qt.formatDateTime(new Date(root.hoveredPoint.time * 1000), "MMM d, h:mm AP") + " · " + Math.round(root.hoveredPoint.value) + "% · " + History.stateLabel(root.hoveredPoint.state)
        : (root.errorText || " "))
    color: root.foreground
    opacity: 0.65
    font.family: root.fontFamily
    font.pixelSize: Style.font.caption
    elide: Text.ElideRight
  }
  Text {
    width: parent.width
    visible: root.showPower
    text: root.hoveredPoint ? "Charge sample: " + Math.round(root.hoveredPoint.value) + "% · " + History.stateLabel(root.hoveredPoint.state) + " · " + root.timeLabel(root.hoveredPoint.time) : " "
    color: root.foreground; opacity: 0.65
    font.family: root.fontFamily; font.pixelSize: Style.font.caption
    elide: Text.ElideRight
  }
}
