const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../Service.qml'), 'utf8');
function extract(name, indent = '  ') {
  const start = source.indexOf(indent + 'function ' + name + '(');
  assert(start >= 0, name);
  const end = source.indexOf('\n' + indent + '}', start);
  return source.slice(start, end + indent.length + 2).trim().replace(/\): string \{/, ') {');
}
function setup() {
  const noop = () => {};
  const c = {
    now: 1000000, unlockWindowDurationMs: 900000,
    unlockWindowStartedMs: -1, unlockWindowDeadlineMs: 0,
    unlockConfirmationDurationMs: 5000, unlockConfirmationDeadlineMs: 0,
    unlockWindowAvailable: false, unlockWindowVisualReady: false,
    enterHeld: false, displayBlanked: false, unlockNotice: "",
    wakeProcess: {running: false}, blankProcess: {running: false},
    passwordPamConfigured: true, lockRequested: false, pendingSessionLock: false,
    authenticatingPassword: false, fingerprintAuthenticating: false,
    sessionLock: {locked: false, secure: false},
    bootClock: {readMs: () => c.now},
    faceObserver: {resetCycle: noop}, Qt: {callLater: noop},
    resetAuthenticationState: () => { c.authenticatingPassword = false; },
    armBlankTimer: noop, logEvent: noop, queueSessionLock: noop,
    refreshBackground: noop, refreshFingerprintStatus: noop, runWake: noop, respondToPasswordPrompt: noop,
    sessionLockStabilizeTimer: {stop: noop}, pendingSessionLockTimer: {stop: noop},
    idleBlankTimer: {stop: noop}, passwordStarts: 0,
    passwordPam: {start: () => { c.passwordStarts++; return true; }},
    handlePasswordFailure: () => { throw Error('Unexpected PAM failure'); },
  };
  Object.defineProperty(c, 'locked', {get: () => c.lockRequested || c.sessionLock.locked || c.sessionLock.secure});
  Object.defineProperty(c, 'authenticating', {get: () => c.authenticatingPassword || c.fingerprintAuthenticating});
  c.root = c;
  vm.createContext(c);
  for (const name of ['cancelUnlockConfirmation', 'refreshUnlockWindow', 'handleEnterPressed', 'handleEnterReleased', 'runWake', 'runBlank', 'clearUnlockWindow', 'tryPasswordlessUnlock', 'beginLock', 'finishUnlock', 'submitPassword'])
    vm.runInContext(extract(name), c);
  c.manual = vm.runInContext('(' + extract('lock', '    ') + ')', c);
  c.sleep = vm.runInContext('(' + extract('lockForSleep', '    ') + ')', c);
  return c;
}
function sleepLocked() {
  const c = setup(); assert.equal(c.sleep(), 'ok'); c.sessionLock.secure = true; return c;
}
let c = sleepLocked();
assert.equal(c.unlockWindowDeadlineMs, 1900000);
c.now += 899000; c.handleEnterPressed('', false);
assert.equal(c.lockRequested, true);
c.handleEnterReleased(false); c.now += 999; c.handleEnterPressed('', false);
assert.equal(c.lockRequested, false); assert.equal(c.unlockWindowDeadlineMs, 0); assert.equal(c.passwordStarts, 0);
for (const elapsed of [900000, 900001, 86400000]) {
  c = sleepLocked(); c.now += elapsed; c.submitPassword('');
  assert.equal(c.lockRequested, true); assert.equal(c.unlockWindowDeadlineMs, 0);
}
c = sleepLocked(); c.now += 300000; c.sleep(); assert.equal(c.unlockWindowDeadlineMs, 1900000);
c.manual(); assert.equal(c.unlockWindowDeadlineMs, 0); c.sleep(); c.submitPassword(''); assert.equal(c.lockRequested, true);
c = setup(); c.manual(); c.sessionLock.secure = true; c.sleep(); c.submitPassword(''); assert.equal(c.lockRequested, true);
c = setup(); c.beginLock(); c.sessionLock.secure = true; c.submitPassword(''); assert.equal(c.lockRequested, true);
for (const now of [NaN, Infinity, -1, 999999]) {
  c = sleepLocked(); c.now = now; c.submitPassword(''); assert.equal(c.lockRequested, true); assert.equal(c.unlockWindowDeadlineMs, 0);
}
c = setup(); c.now = NaN; c.sleep(); assert.equal(c.unlockWindowDeadlineMs, 0); assert.equal(c.lockRequested, true);
c = setup(); c.passwordPamConfigured = false; assert.equal(c.sleep(), 'missing-pam'); assert.equal(c.lockRequested, false);
c = setup(); c.sleep(); c.submitPassword(''); assert.equal(c.lockRequested, true); // compositor not secure yet
c = sleepLocked(); c.fingerprintAuthenticating = true; c.submitPassword(''); assert.equal(c.lockRequested, true);
c = sleepLocked(); c.submitPassword('example-password'); assert.equal(c.passwordStarts, 1); assert.equal(c.pendingPassword, 'example-password'); assert.equal(c.lockRequested, true);
c.submitPassword(''); assert.equal(c.lockRequested, true); // in-flight password authentication
c = setup(); assert.equal(c.unlockWindowDeadlineMs, 0); // fresh process / recovery
console.log('PASS: actual lock functions: window boundary, suspended elapsed time, duplicate sleep, manual/idle/recovery locks, bad clock, secure-lock requirement, password path');

// Two separate key presses, including a physical release, are required.
c = sleepLocked(); c.handleEnterPressed('', false);
assert.equal(c.lockRequested, true); assert.equal(c.unlockConfirmationDeadlineMs, 1005000);
c.handleEnterPressed('', true); c.handleEnterPressed('', false);
assert.equal(c.lockRequested, true);
c.handleEnterReleased(true); c.handleEnterPressed('', false); assert.equal(c.lockRequested, true);
c.handleEnterReleased(false); c.handleEnterPressed('', false); assert.equal(c.lockRequested, false);
// Confirmation timeout returns to initial state; next Enter arms a new window.
c = sleepLocked(); c.handleEnterPressed('', false); c.handleEnterReleased(false);
c.now += 5000; c.refreshUnlockWindow(); assert.equal(c.unlockConfirmationDeadlineMs, 0);
c.handleEnterPressed('', false); assert.equal(c.lockRequested, true); assert.equal(c.unlockConfirmationDeadlineMs, 1010000);
// The unlock window wins even if confirmation was started just before expiry.
c = sleepLocked(); c.now += 899000; c.handleEnterPressed('', false); c.handleEnterReleased(false);
c.now += 1000; c.refreshUnlockWindow(); assert.equal(c.unlockNotice, 'Unlock window ended — enter password');
c.handleEnterPressed('', false); assert.equal(c.lockRequested, true); assert.equal(c.unlockWindowAvailable, false);
// Clear confirmation on blanking, sleep notification, manual lock, typing/other key.
for (const action of ['runBlank', 'sleep', 'manual', 'cancelUnlockConfirmation']) {
  c = sleepLocked(); c.handleEnterPressed('', false); c.handleEnterReleased(false);
  c[action](); assert.equal(c.unlockConfirmationDeadlineMs, 0, action);
  if (action !== 'manual') { c.handleEnterPressed('', false); assert.equal(c.lockRequested, true, action); }
}
c = sleepLocked(); c.handleEnterPressed('', false); c.handleEnterReleased(false);
c.handleEnterPressed('password', false); assert.equal(c.passwordStarts, 1); assert.equal(c.unlockConfirmationDeadlineMs, 0);
// A fresh clock is checked after suspend even if the UI timer never ran.
c = sleepLocked(); c.handleEnterPressed('', false); c.handleEnterReleased(false);
c.now += 900001; c.handleEnterPressed('', false); assert.equal(c.lockRequested, true);
// Blanking closes the visual gate before the display turns off. Wake checks a
// fresh clock before reopening it, so an expired hint can never flash.
c = sleepLocked(); c.runWake(); assert.equal(c.unlockWindowVisualReady, true);
c.sleep(); assert.equal(c.unlockWindowVisualReady, false);
c.runBlank(); assert.equal(c.unlockWindowVisualReady, false);
c.now += 900001; c.runWake();
assert.equal(c.unlockWindowVisualReady, true); assert.equal(c.unlockWindowAvailable, false);
// Shared service accepts key events from either view without per-monitor state.
c = sleepLocked(); const screenA = c.handleEnterPressed; const screenB = c.handleEnterPressed;
screenA('', false); c.handleEnterReleased(false); screenB('', false); assert.equal(c.lockRequested, false);
console.log('PASS: two-Enter release gate, repeats, five-second expiry, boundary notice, reset events, cross-view state');
