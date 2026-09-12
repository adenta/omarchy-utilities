import QtQuick
import qs.Commons
Column {
 property string label: ""
 property string value: ""
 property color foreground: Color.foreground
 width: parent ? parent.width : implicitWidth
 spacing: Style.space(3)
 Text { text: parent.label.toUpperCase(); textFormat: Text.PlainText; color: Color.muted; font.family: Style.font.family; font.pixelSize: Style.font.caption; font.bold: true }
 Text { width: parent.width; text: parent.value; textFormat: Text.PlainText; color: parent.foreground; font.family: Style.font.family; font.pixelSize: Style.font.body; wrapMode: Text.Wrap }
}
