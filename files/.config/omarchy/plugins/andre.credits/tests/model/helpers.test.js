const { test, eq } = require('../harness.js')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const bin = path.resolve(__dirname, '../../bin')
function mocked(secret, response, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'credits-test-'))
  try {
    fs.writeFileSync(path.join(dir, 'secret-tool'), '#!/bin/sh\n' + secret, {mode: 0o700})
    fs.writeFileSync(path.join(dir, 'curl'), '#!/bin/sh\ncat >/dev/null\nprintf "%s" "$FIXTURE"\n', {mode: 0o700})
    run({ ...process.env, PATH: dir + ':' + process.env.PATH, FIXTURE: response })
  } finally { fs.rmSync(dir, {recursive: true, force: true}) }
}
test('Deepgram helper reports missing credentials without fetching', () => {
  mocked('exit 1\n', '', env => {
    eq(spawnSync('bash', [path.join(bin, 'deepgram-balance')], {env}).status, 3)
  })
})
