const fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const {spawnSync}=require('node:child_process');
const plugin=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(plugin,'Service.qml'),'utf8');
function fn(name){const start=src.indexOf('  function '+name+'(');if(start<0)throw Error(name);return src.slice(start,src.indexOf('\n  }',start)+4)}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'two-enter-ui.'));
try {
  fs.symlinkSync(plugin,path.join(dir,'Lock'));
  fs.symlinkSync('/usr/share/omarchy/shell/Commons',path.join(dir,'Commons'));
  fs.symlinkSync('/usr/share/omarchy/shell/Ui',path.join(dir,'Ui'));
  fs.mkdirSync(path.join(dir,'runtime'),{mode:0o700});
  fs.writeFileSync(path.join(dir,'Controller.qml'),`import QtQuick
QtObject {
  id: root
  property double now: 1000000
  property double unlockWindowStartedMs: 1000000
  property double unlockWindowDeadlineMs: 1900000
  property double unlockConfirmationDurationMs: 5000
  property double unlockConfirmationDeadlineMs: 0
  property bool unlockWindowAvailable: true
  property bool unlockWindowVisualReady: true
  property bool enterHeld: false
  property bool lockRequested: true
  property bool authenticatingPassword: false
  property bool authenticating: authenticatingPassword
  property string enteredPassword: ""
  property string pendingPassword: ""
  property string failureMessage: ""
  property bool unlocked: false
  property int passwordStarts: 0
  property QtObject bootClock: QtObject { function readMs() { return root.now } }
  property QtObject sessionLock: QtObject { property bool secure: true }
  property QtObject passwordPam: QtObject { function start() { root.passwordStarts++; return true } }
  function finishUnlock() { clearUnlockWindow(); lockRequested = false; unlocked = true }
  function runWake() { refreshUnlockWindow() }
  function logEvent(value) {}
  function handlePasswordFailure() { throw new Error("unexpected PAM failure") }
  function respondToPasswordPrompt() {}
  property string unlockNotice: ""
  ${['cancelUnlockConfirmation','refreshUnlockWindow','clearUnlockWindow','tryPasswordlessUnlock','handleEnterPressed','handleEnterReleased','submitPassword'].map(fn).join('\n')}
  function reset() {
    now = 1000000; unlockWindowStartedMs = now; unlockWindowDeadlineMs = now + 900000
    cancelUnlockConfirmation(); enterHeld = false; lockRequested = true
    authenticatingPassword = false; enteredPassword = ""; failureMessage = ""
    unlocked = false; passwordStarts = 0; refreshUnlockWindow(); unlockWindowVisualReady = true
  }
}`);
  const view=(id,y)=>`Lock.LockView {
    id: ${id}; width: 640; height: 360; y: ${y}
    loadBackground: false; faceEnabled: false
    passwordText: controller.enteredPassword
    unlockWindowAvailable: controller.unlockWindowAvailable
    unlockWindowHintVisible: controller.unlockWindowVisualReady && controller.unlockWindowAvailable
    unlockConfirmationPending: controller.unlockConfirmationDeadlineMs > 0
    unlockNotice: controller.unlockNotice
    onEnterPressed: function(password, autoRepeat) { controller.handleEnterPressed(password, autoRepeat) }
    onEnterReleased: function(autoRepeat) { controller.handleEnterReleased(autoRepeat) }
    onPasswordTextEdited: function(password) { if (password.length > 0) controller.cancelUnlockConfirmation(); controller.enteredPassword = password }
    onOtherKeyPressed: controller.cancelUnlockConfirmation()
    onWakeRequested: controller.refreshUnlockWindow()
  }`;
  fs.writeFileSync(path.join(dir,'shell.qml'),`import QtQuick
import QtTest
import Quickshell
import "Lock" as Lock
ShellRoot {
  Controller { id: controller }
  FloatingWindow {
    id: window; implicitWidth: 640; implicitHeight: 720; visible: true
    ${view('first',0)}
    ${view('second',360)}
    TestCase { id: keys; name: "LockViewInput"; when: false }
    function check(ok, label) { if (!ok) throw new Error("FAIL: " + label); console.log("PASS: " + label) }
    function child(item, name) {
      if (item.objectName === name) return item
      for (var i = 0; i < item.children.length; i++) { var found = child(item.children[i], name); if (found) return found }
      return null
    }
    function capture(name, next) {
      var output = Quickshell.env("PREVIEW_DIR")
      if (!output) { next(); return }
      first.grabToImage(function(image) { image.saveToFile(output + "/" + name + ".png"); next() })
    }
    Timer {
      interval: 500; running: true
      onTriggered: {
        try {
          first.forcePasswordFocus()
          var helper = window.child(first, "unlockNotice")
          window.check(first.placeholderText === "Enter password", "password remains the primary prompt")
          window.check(helper && helper.visible && helper.text === "↵ twice to unlock", "small initial unlock hint")
          keys.keyPress(Qt.Key_Return)
          window.check(!controller.unlocked && first.placeholderText === "Press Enter again to unlock" && second.placeholderText === first.placeholderText, "first Enter changes both screens")
          window.check(!helper.visible, "initial hint hides during confirmation")
          // A second key-down without release cannot confirm, even without repeat metadata.
          keys.keyPress(Qt.Key_Return)
          window.check(!controller.unlocked, "held Enter cannot unlock")
          keys.keyRelease(Qt.Key_Return)
          second.forcePasswordFocus(); keys.keyClick(Qt.Key_Return)
          window.check(controller.unlocked, "separate Enter on second screen unlocks")
          controller.reset(); first.forcePasswordFocus(); keys.keyClick(Qt.Key_Return)
          controller.now += 5000; controller.refreshUnlockWindow()
          window.check(first.placeholderText === "Enter password" && helper.visible, "five-second prompt reset")
          keys.keyClick(Qt.Key_Return)
          window.check(!controller.unlocked && controller.unlockConfirmationDeadlineMs > 0, "Enter after timeout rearms")
          keys.keyClick(Qt.Key_Left)
          window.check(controller.unlockConfirmationDeadlineMs === 0, "other key cancels")
          keys.keyClick(Qt.Key_Return); keys.keyClick(Qt.Key_A)
          window.check(controller.unlockConfirmationDeadlineMs === 0 && controller.enteredPassword === "a", "typing cancels confirmation")
          keys.keyClick(Qt.Key_Return)
          window.check(controller.passwordStarts === 1 && controller.pendingPassword === "a" && !controller.unlocked, "nonempty Enter uses password authentication")
          controller.reset(); controller.now += 899000; keys.keyClick(Qt.Key_Return)
          controller.now += 1000; controller.refreshUnlockWindow()
          window.check(first.placeholderText === "Enter password" && first.unlockNotice === "Unlock window ended — enter password", "expiry prompt and notice")
          keys.keyClick(Qt.Key_Return); window.check(!controller.unlocked, "expired confirmation cannot unlock")
          controller.reset(); keys.keyClick(Qt.Key_Enter)
          window.check(first.placeholderText === "Press Enter again to unlock", "keypad Enter supported")
          var prompt = window.child(first, "unlockPrompt")
          window.check(prompt && prompt.contentWidth <= prompt.width + 1 && !prompt.truncated, "confirmation prompt fits")
          controller.reset(); controller.unlockWindowVisualReady = false
          window.check(!helper.visible && first.placeholderText === "Enter password", "stale unlock state stays hidden")
          controller.now += 900001; controller.refreshUnlockWindow(); controller.unlockWindowVisualReady = true
          window.check(!helper.visible && first.placeholderText === "Enter password", "expired state stays hidden after refresh")
          controller.reset(); first.forcePasswordFocus(); keys.keyClick(Qt.Key_Enter)
          window.capture("confirmation", function() {
            controller.reset()
            window.capture("initial", function() {
              controller.now += 899000; controller.handleEnterPressed("", false); controller.handleEnterReleased(false)
              controller.now += 1000; controller.refreshUnlockWindow()
              window.capture("expired", function() { console.log("PASS: UI suite complete"); Qt.quit() })
            })
          })
        } catch(e) { console.log(String(e)); Qt.quit() }
      }
    }
  }
}`);
  const result=spawnSync('quickshell',['-p',dir],{encoding:'utf8',timeout:10000,env:{...process.env,XDG_RUNTIME_DIR:path.join(dir,'runtime'),QT_QPA_PLATFORM:'offscreen',QT_QPA_PLATFORMTHEME:'basic',QT_QUICK_BACKEND:'software'}});
  const output=(result.stdout||'')+(result.stderr||'');
  if(result.error||result.status!==0||!output.includes('PASS: UI suite complete')||output.includes('FAIL:'))throw Error(output);
  console.log(output.split('\n').filter(l=>l.includes('PASS:')).join('\n'));
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
