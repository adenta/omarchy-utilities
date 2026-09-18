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
test('both helpers report missing credentials without fetching', () => {
  mocked('exit 1\n', '', env => {
    for (const provider of ['deepgram', 'openrouter'])
      eq(spawnSync('bash', [path.join(bin, provider + '-balance')], {env}).status, 3)
  })
})
test('OpenRouter helper handles numeric, unlimited and malformed responses', () => {
  for (const [fixture, output, status] of [
    ['{"data":{"limit_remaining":0}}', '0', 0],
    ['{"data":{"limit_remaining":75}}', '75', 0],
    ['{"data":{"limit_remaining":null}}', 'unlimited', 0],
    ['{"data":{}}', '', 5]
  ]) mocked('printf fake-test-key\n', fixture, env => {
    const result = spawnSync('bash', [path.join(bin, 'openrouter-balance')], {env, encoding: 'utf8'})
    eq(result.status, status)
    eq(result.stdout.trim(), output)
  })
})
