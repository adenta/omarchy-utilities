#!/usr/bin/env node
// Check complete rendered canvases, including invisible Braille padding.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const artDir = path.join(__dirname, '../files/.local/share/omarchy-pokemon-screensaver/art');
const artworks = fs.readdirSync(artDir).filter(name => name.endsWith('.txt'));
assert.equal(artworks.length, 251);
const positions = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 3], [1, 3]];
let checks = 0;
for (const [columns, rows] of [[70, 22], [71, 23], [88, 24], [89, 25], [96, 26], [97, 27], [104, 28], [105, 29]]) {
  for (const artwork of artworks) {
    const input = fs.readFileSync(path.join(artDir, artwork), 'utf8').trimEnd().split('\n');
    assert.equal(input.length, 22);
    for (const line of input) assert.match(line, /^[\u2800-\u28ff]{70}$/u);
    const result = spawnSync('ttfx', [
      '-i', path.join(artDir, artwork), '--frame-rate', '0',
      '--canvas-width', '0', '--canvas-height', String(rows + rows % 2),
      '--reuse-canvas', '--anchor-canvas', 'c', '--anchor-text', 'c',
      '--no-color', '--no-eol', '--no-restore-cursor',
      'colorshift', '--cycles', '1', '--gradient-stops', 'ffffff',
      '--gradient-steps', '1', '--gradient-frames', '1', '--skip-final-gradient',
    ], { env: { ...process.env, LINES: String(rows), COLUMNS: String(columns) }, encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const marker = `\x1b8\x1b7\x1b[${rows}A`;
    assert.ok(result.stdout.includes(marker), 'Expected ttfx frame boundary');
    const frame = result.stdout.split(marker).at(-1).split('\n');
    const top = frame.findIndex(line => /[\u2800-\u28ff]/u.test(line));
    const left = [...frame[top]].findIndex(character => /[\u2800-\u28ff]/u.test(character));
    const label = `${artwork}, ${columns}×${rows} terminal`;
    assert.equal(frame.length, rows, `${label}: full viewport height`);
    for (const line of frame) assert.equal([...line].length, columns, `${label}: full viewport width`);
    assert.equal(Math.abs(top - (rows - top - 22)), (rows - 22) % 2, `${label}: canvas vertical margins`);
    assert.equal(Math.abs(left - (columns - left - 70)), (columns - 70) % 2, `${label}: canvas horizontal margins`);
    assert.deepEqual(frame.slice(top, top + 22).map(line => [...line].slice(left, left + 70).join('')),
      input, `${label}: complete, unclipped artwork and padding`);
    let x0 = 140, y0 = 88, x1 = -1, y1 = -1;
    input.forEach((line, cy) => [...line].forEach((character, cx) => {
      const bits = character.codePointAt(0) - 0x2800;
      positions.forEach(([dx, dy], bit) => {
        if (!(bits & (1 << bit))) return;
        const x = cx * 2 + dx, y = cy * 4 + dy;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      });
    }));
    assert.ok(x1 >= x0 && y1 >= y0, `${label}: nonempty silhouette`);
    assert.ok(Math.abs(x0 - (139 - x1)) <= 1, `${label}: silhouette horizontal dot margins`);
    assert.ok(Math.abs(y0 - (87 - y1)) <= 1, `${label}: silhouette vertical dot margins`);
    assert.ok(Math.abs((left * 2 + x0) - (columns * 2 - left * 2 - x1 - 1)) <= 3, `${label}: rendered horizontal rounding`);
    assert.ok(Math.abs((top * 4 + y0) - (rows * 4 - top * 4 - y1 - 1)) <= 5, `${label}: rendered vertical rounding`);
    checks++;
  }
}
console.log(`PASS ${checks} rendered normalization/centering checks (${artworks.length} artworks, eight terminal sizes)`);
