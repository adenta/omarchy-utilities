const {spawn, execFileSync} = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const checks = {};
const children = [];
const sockets = [];
const env = {...process.env, TERM: 'xterm-256color', LANG: 'C.UTF-8', HISTFILE: '/dev/null'};
function terminal(command) {
  const child = spawn('/usr/bin/script', ['-q', '-e', '-c', command, '/dev/null'], {env});
  child.output = '';
  child.queryCount = 0;
  child.stdout.on('data', data => {
    child.output += data.toString();
    const queries = [...child.output.matchAll(/\x1b\]52;c;\?(?:\x07|\x1b\\)/g)].length;
    while (child.queryCount < queries) {
      child.queryCount++;
      if (typeof child.clipboardResponse === 'string') {
        child.stdin.write('\x1b]52;c;' + Buffer.from(child.clipboardResponse).toString('base64') + '\x07');
      }
    }
  });
  child.stderr.on('data', data => {child.output += data.toString();});
  child.on('error', error => {child.failure = error;});
  children.push(child);
  return child;
}
async function until(test, description) {
  for (let i = 0; i < 60; i++) { try { if (test()) return; } catch {} await delay(100); }
  throw Error(`Timed out: ${description}`);
}
function tmux(socket, ...args) {
  return execFileSync('/usr/bin/tmux', ['-L', socket, ...args], {env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
}
function exists(socket) {try {tmux(socket, 'has-session'); return true;} catch {return false;}}
async function main() {
  const plain = terminal('/bin/bash -il');
  await until(() => plain.output.length > 0, 'ordinary interactive shell startup');
  plain.stdin.write('printf "ORDINARY_%s_END\\n" "${TMUX:-NONE}"\r');
  await until(() => plain.output.includes('ORDINARY_NONE_END'), 'ordinary interactive shell skipped tmux');
  checks.ordinaryInteractiveShellUnchanged = true;
  plain.stdin.write('exit\r');
  await until(() => plain.exitCode !== null, 'ordinary shell exit');

  for (let run = 0; run < 2; run++) {
    const socket = `codex-remote-verify-${crypto.randomUUID()}`;
    sockets.push(socket);
    const command = `/usr/bin/tmux -L ${quote(socket)} -f ${quote(process.env.HOME + '/.config/tmux/codex.conf')} new-session -c ${quote(process.env.HOME)}`;
    const client = terminal(command);
    await until(() => exists(socket), 'tmux started');
    await until(() => tmux(socket, 'list-clients', '-F', '#{client_pid}').length > 0, 'tmux client attached');
    assert.equal(tmux(socket, 'show-options', '-g', '-v', 'destroy-unattached'), 'on');
    assert.equal(tmux(socket, 'show-options', '-g', '-v', 'history-limit'), '100000');
    assert.equal(tmux(socket, 'display-message', '-p', '#{pane_current_path}'), process.env.HOME);
    checks.configAndWorkingDirectory = true;
    if (run === 0) {
      await until(() => client.output.length > 0, 'test shell startup');
      client.stdin.write("printf 'CODEX_COPY_CHECK\\n'\r");
      await until(() => /(?:^|\n)CODEX_COPY_CHECK\n/.test(tmux(socket, 'capture-pane', '-p', '-S', '-5')), 'test text printed');
      checks.clipboardCapability = tmux(socket, 'info').split('\n').find(line => line.includes('Ms:'));
      // script(1) has no terminal emulator to answer tmux's initial queries.
      // Allow its five-second capability negotiation to finish before copying.
      await delay(5500);
      const buffersBefore = tmux(socket, 'list-buffers');
      client.stdin.write('\x01');
      await until(() => tmux(socket, 'display-message', '-p', '#{pane_in_mode}:#{selection_present}') === '1:1', 'Ctrl+A selection');
      assert.equal(tmux(socket, 'list-buffers'), buffersBefore);
      checks.ctrlASelectsWithoutCreatingCopyBuffer = true;
      client.stdin.write('\x03');
      await until(() => tmux(socket, 'display-message', '-p', '#{pane_in_mode}') === '0', 'Ctrl+C exits selection');
      await delay(200);
      checks.copyBufferSizes = tmux(socket, 'list-buffers', '-F', '#{buffer_size}');
      checks.clipboardSequenceCount = (client.output.match(/\x1b\]52;[^\x07]*\x07/g) || []).length;
      await until(() => /\x1b\]52;c;[A-Za-z0-9+/=]+\x07/.test(client.output), 'Ctrl+C sends the explicit clipboard sequence');
      checks.ctrlCSendsClipboardSequence = true;
      client.stdin.write('\x01');
      await until(() => tmux(socket, 'display-message', '-p', '#{pane_in_mode}') === '1', 'reselect for Escape');
      client.stdin.write('\x1b');
      await until(() => tmux(socket, 'display-message', '-p', '#{pane_in_mode}') === '0', 'Escape cancels');
      checks.escapeCancelsSelection = true;
      client.clipboardResponse = 'CLIPBOARD_PASTE_α\nsecond line\n';
      client.stdin.write('\x16');
      await until(() => tmux(socket, 'show-options', '-s', '-v', '@codex_clipboard_result') === 'ok', 'Ctrl+V receives fresh clipboard');
      await until(() => tmux(socket, 'list-windows', '-F', '#{window_id}').split('\n').length === 1, 'clipboard receiver exits');
      let pasted = tmux(socket, 'capture-pane', '-p', '-S', '-10');
      assert(pasted.includes('CLIPBOARD_PASTE_α') && pasted.includes('second line'));
      assert(!pasted.includes('command not found'));
      checks.ctrlVPastesUnicodeMultilineWithoutExecuting = true;
      assert.equal(tmux(socket, 'show-options', '-s', '-v', 'set-clipboard'), 'external');
      assert.equal(tmux(socket, 'show-options', '-s', '-v', 'get-clipboard'), 'off');
      checks.clipboardPolicyRestoredAfterPaste = true;
      client.stdin.write('\x03');
      await delay(150);
      client.stdin.write('sleep 30\r');
      await until(() => tmux(socket, 'display-message', '-p', '#{pane_current_command}') === 'sleep', 'foreground sleep starts');
      client.stdin.write('\x03');
      await until(() => tmux(socket, 'display-message', '-p', '#{pane_current_command}') === 'bash', 'Ctrl+C interrupts sleep');
      checks.ctrlCInterruptsWithoutSelection = true;

      client.clipboardResponse = null;
      tmux(socket, 'set-buffer', '-b', 'stale', 'DO_NOT_PASTE_OLD_BUFFER');
      client.stdin.write('\x16');
      await until(() => tmux(socket, 'show-options', '-s', '-v', '@codex_clipboard_disabled') === '1', 'unanswered clipboard query times out');
      await until(() => tmux(socket, 'list-windows', '-F', '#{window_id}').split('\n').length === 1, 'timed-out receiver exits');
      const queriesBefore = client.queryCount;
      client.stdin.write('\x1b]52;c;' + Buffer.from('LATE_REPLY_MUST_NOT_PASTE').toString('base64') + '\x07');
      client.stdin.write('\x16');
      await delay(250);
      assert.equal(client.queryCount, queriesBefore);
      pasted = tmux(socket, 'capture-pane', '-p', '-S', '-10');
      assert(!pasted.includes('DO_NOT_PASTE_OLD_BUFFER') && !pasted.includes('LATE_REPLY_MUST_NOT_PASTE'));
      checks.timeoutAndLateReplyDoNotPasteStaleData = true;
      assert.equal(tmux(socket, 'show-options', '-s', '-v', 'set-clipboard'), 'external');
      assert.equal(tmux(socket, 'show-options', '-s', '-v', 'get-clipboard'), 'off');
      checks.clipboardPolicyRestoredAfterTimeout = true;
      client.stdin.write('\x1b[200~apple\x1b[201~');
      await until(() => tmux(socket, 'capture-pane', '-p', '-S', '-5').includes('apple'), 'ordinary bracketed paste after Ctrl+V');
      assert(!tmux(socket, 'capture-pane', '-p', '-S', '-5').includes('^[[200~'));
      checks.ctrlVDoesNotArmQuotedInsert = true;
      client.stdin.write('\x03');
    }
    const clientTty = tmux(socket, 'list-clients', '-F', '#{client_tty}');
    tmux(socket, 'detach-client', '-t', clientTty);
    await until(() => !exists(socket), 'session cleaned up after last client detached');
    await until(() => client.exitCode !== null, 'terminal process exited');
  }
  checks.detachDestroysSession = true;
  checks.secondSessionStartsFresh = true;
  console.log(JSON.stringify({checks, scope: 'Installed config in isolated PTYs; actual Codex UI test is still required.'}, null, 2));
}
main().catch(error => {console.error(JSON.stringify({error: error.message, checks, queries: children.at(-1)?.queryCount, osc52: children.at(-1)?.output.match(/\x1b\]52;[^\x07]*\x07/g)}, null, 2)); process.exitCode = 1;}).finally(() => {
  for (const socket of sockets) {
    if (exists(socket)) {try {tmux(socket, 'kill-server');} catch {}}
    const socketFile = `/tmp/tmux-${process.getuid()}/${socket}`;
    try {if (fs.lstatSync(socketFile).isSocket()) fs.unlinkSync(socketFile);} catch {}
  }
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
});
