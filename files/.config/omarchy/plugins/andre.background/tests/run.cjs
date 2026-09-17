const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const plugin = path.resolve(__dirname, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'background-upstream-'));
try {
  const stock = path.join(dir, 'stock');
  const baseline = path.join(dir, 'baseline');
  const bin = path.join(dir, 'bin');
  const log = path.join(dir, 'notifications');
  fs.mkdirSync(stock); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(stock, 'Service.qml'), 'original');
  fs.writeFileSync(path.join(stock, 'helper with spaces.js'), 'helper');
  const hash = execFileSync('bash', ['-c', "find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum | sha256sum | cut -d ' ' -f 1"], { cwd: stock, encoding: 'utf8' });
  fs.writeFileSync(baseline, hash);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, TEST_LOG: log };
  const stub = (name, body) => fs.writeFileSync(path.join(bin, name), '#!/bin/bash\n' + body, { mode: 0o755 });
  stub('omarchy', 'printf "%s\\n" "$@" >> "$TEST_LOG"\nexit "${TEST_NOTIFY_EXIT:-0}"\n');
  const run = (notify = false, extra = {}) => spawnSync('bash', [path.join(plugin, 'check-upstream'), ...(notify ? ['--notify'] : []), stock, baseline], { env: { ...env, ...extra }, encoding: 'utf8' });
  const check = expected => { const r = run(); assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout.trim(), expected); };
  const notification = headline => {
    fs.rmSync(log, { force: true });
    const r = run(true); assert.equal(r.status, 0, r.stderr);
    const lines = fs.readFileSync(log, 'utf8').trim().split('\n');
    assert.deepEqual(lines.slice(0, 5), ['notification', 'send', '-u', 'normal', headline]);
    assert.equal(lines.length, 6);
  };
  check('current'); assert.equal(run(true).status, 0); assert.equal(fs.existsSync(log), false);
  fs.writeFileSync(path.join(stock, 'Service.qml'), 'modified'); check('changed');
  notification('Custom background needs review');
  notification('Custom background needs review'); // No suppression on later startups.
  assert.equal(fs.readFileSync(baseline, 'utf8'), hash);
  const delivery = run(true, { TEST_NOTIFY_EXIT: '1' });
  assert.equal(delivery.status, 1); assert.match(delivery.stderr, /notification delivery failed/);
  fs.writeFileSync(path.join(stock, 'Service.qml'), 'original'); check('current');
  fs.writeFileSync(path.join(stock, 'added'), 'new'); check('changed');
  fs.unlinkSync(path.join(stock, 'added')); fs.unlinkSync(path.join(stock, 'helper with spaces.js')); check('changed');
  fs.writeFileSync(baseline, 'invalid'); assert.notEqual(run().status, 0); notification('Background update check failed');
  fs.unlinkSync(baseline); notification('Background update check failed');
  fs.writeFileSync(baseline, hash); fs.rmSync(stock, { recursive: true }); notification('Background update check failed');
  fs.mkdirSync(stock); fs.writeFileSync(path.join(stock, 'Service.qml'), 'original');
  stub('find', 'exit 1\n'); notification('Background update check failed'); fs.unlinkSync(path.join(bin, 'find'));
  stub('find', 'sleep 10\n');
  const started = Date.now(); notification('Background update check failed');
  assert.ok(Date.now() - started < 5000, 'check must time out');
  console.log('PASS: stock changes, silence, repeat notifications, invalid/missing inputs, hash failures, timeout, delivery failure, baseline preservation');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
