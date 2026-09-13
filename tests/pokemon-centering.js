#!/usr/bin/env node
// Exercise stock ttfx with cropped silhouettes and ordinary-space gaps.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const artDir = path.join(__dirname, '../files/.local/share/omarchy-pokemon-screensaver/art');
const artworks = fs.readdirSync(artDir).filter(name => name.endsWith('.txt'));
assert.equal(artworks.length, 251);
const sizes = [[70, 22], [71, 23], [88, 24], [88, 25], [101, 25], [96, 26], [97, 27], [104, 28], [105, 29]];
let checks = 0;
for (const artwork of artworks) {
  const text = fs.readFileSync(path.join(artDir, artwork), 'utf8');
  assert.ok(text.endsWith('\n'), `${artwork}: final newline`);
  assert.doesNotMatch(text, /\u2800/u, `${artwork}: invisible Braille cells must not become effect targets`);
  const input = text.slice(0, -1).split('\n');
  const height = input.length, width = Math.max(...input.map(line => line.length));
  assert.ok(height > 0 && height <= 22 && width > 0 && width <= 70, `${artwork}: normalized fit`);
  for (const line of input) {
    assert.match(line, /^[ \u2801-\u28ff]*$/u, `${artwork}: visible Braille or ordinary spaces only`);
    assert.ok(!line.endsWith(' '), `${artwork}: trailing padding`);
  }
  assert.ok(input[0].length && input.at(-1).length, `${artwork}: no empty outer rows`);
  assert.ok(input.some(line => /^[\u2801-\u28ff]/u.test(line)), `${artwork}: no empty outer columns`);
  for (const [columns, rows] of sizes) {
    const result = spawnSync('ttfx', [
      '-i', path.join(artDir, artwork), '--frame-rate', '0',
      '--canvas-width', '0', '--canvas-height', String(rows + rows % 2),
      '--reuse-canvas', '--anchor-canvas', 'c', '--anchor-text', 'c',
      '--no-color', '--no-eol', '--no-restore-cursor',
      'colorshift', '--cycles', '1', '--gradient-stops', 'ffffff',
      '--gradient-steps', '1', '--gradient-frames', '1', '--skip-final-gradient',
    ], { env: { ...process.env, LINES: String(rows), COLUMNS: String(columns) }, encoding: 'utf8', timeout: 5000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const marker = `\x1b8\x1b7\x1b[${rows}A`;
    assert.ok(result.stdout.includes(marker), 'Expected ttfx frame boundary');
    const frame = result.stdout.split(marker).at(-1).split('\n');
    const label = `${artwork}, ${columns}×${rows} terminal`;
    assert.equal(frame.length, rows, `${label}: full viewport height`);
    for (const line of frame) assert.equal([...line].length, columns, `${label}: full viewport width`);
    const top = frame.findIndex(line => /[\u2801-\u28ff]/u.test(line));
    const occupied = frame.filter(line => /[\u2801-\u28ff]/u.test(line));
    const left = Math.min(...occupied.map(line => line.search(/[\u2801-\u28ff]/u)));
    const expected = Array.from({ length: rows }, () => ' '.repeat(columns));
    input.forEach((line, y) => { expected[top + y] = ' '.repeat(left) + line + ' '.repeat(columns - left - line.length); });
    assert.deepEqual(frame, expected, `${label}: every visible cell and gap preserved, no clipping`);
    assert.ok(Math.abs(top - (rows - top - height)) <= 1, `${label}: vertical rounding`);
    // Stock ttfx's odd-width anchor may differ by a full cell from geometric center.
    assert.ok(Math.abs(left - (columns - left - width)) <= 2, `${label}: horizontal rounding`);
    checks++;
  }
}
console.log(`PASS ${checks} rendered artwork checks (${artworks.length} artworks, ${sizes.length} terminal sizes)`);
