#!/usr/bin/env node
// Regression checks for invisible cells becoming animation targets in stock ttfx.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const artDir = path.join(__dirname, '../files/.local/share/omarchy-pokemon-screensaver/art');
const previewDir = process.env.POKEMON_PREVIEW_DIR;
if (previewDir) fs.mkdirSync(previewDir, { recursive: true });
const samples = ['145-zapdos', '142-aerodactyl', '027-sandshrew', '010-caterpie'];
const sizes = [[91, 26], [103, 26]];
let totalFrames = 0;
for (const [columns, rows] of sizes) for (const name of samples) for (const effect of ['laseretch', 'decrypt', 'orbittingvolley']) {
  const result = spawnSync('ttfx', [
    '-i', path.join(artDir, name + '.txt'), '--frame-rate', '0',
    '--canvas-width', '0', '--canvas-height', '0', '--reuse-canvas',
    '--anchor-canvas', 'c', '--anchor-text', 'c', '--no-color',
    '--no-eol', '--no-restore-cursor', '--seed', '42', effect,
    ...(effect === 'orbittingvolley' ? ['--bottom-launcher-symbol', 'B'] : []),
  ], { env: { ...process.env, LINES: String(rows), COLUMNS: String(columns) }, encoding: 'utf8', timeout: 30000, maxBuffer: 128 * 1024 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const frames = result.stdout.split(`\x1b8\x1b7\x1b[${rows}A`).slice(1)
    .filter(frame => !frame.endsWith('\n\x1b7')); // Discard the initial tty canvas preparation.
  assert.ok(frames.length > 1, `${name} ${effect}: animated frames`);
  const final = frames.at(-1).split('\n');
  const isArtwork = (x, y) => /[\u2801-\u28ff]/u.test(final[y]?.[x] || ' ');
  let checkedTargets = 0;
  for (const [frameIndex, frame] of frames.entries()) {
    const lines = frame.split('\n');
    assert.equal(lines.length, rows);
    if (effect === 'decrypt') {
      for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
        if (lines[y][x] !== ' ') {
          assert.ok(isArtwork(x, y), `${name} ${effect}: blank target at ${x},${y}, frame ${frameIndex}`);
          checkedTargets++;
        }
      }
    } else if (effect === 'orbittingvolley') {
      assert.ok(lines.slice(0, -1).every(line => !line.includes('B')), `${name}: bottom launcher must stay on the last visible row`);
      if (lines.at(-1).includes('B')) checkedTargets++;
    } else {
      // Laser Etch draws '/' diagonally above/right of its '*' target. Sparks
      // use '.', ',' and '*', so the beam gives an unambiguous target position.
      let beamX = -1, beamY = -1;
      lines.forEach((line, y) => { const x = line.indexOf('/'); if (x >= 0) { beamX = x; beamY = y; } });
      if (beamX >= 0 && beamY + 1 < rows && beamX > 0) {
        const x = beamX - 1, y = beamY + 1;
        assert.equal(lines[y][x], '*', `${name}: laser origin`);
        assert.ok(isArtwork(x, y), `${name} ${effect}: blank target at ${x},${y}, frame ${frameIndex}`);
        checkedTargets++;
      }
    }
  }
  assert.ok(checkedTargets > 0, `${name} ${effect}: targets exercised`);
  if (previewDir) {
    const count = Math.min(100, frames.length);
    const sampled = Array.from({ length: count }, (_, i) => frames[Math.round(i * (frames.length - 1) / (count - 1))]);
    fs.writeFileSync(path.join(previewDir, `${name}-${effect}-${columns}x${rows}.json`), JSON.stringify({ name, effect, columns, rows, frames: sampled }));
  }
  totalFrames += frames.length;
  console.log(`PASS ${name} ${effect} ${columns}×${rows}: ${frames.length} frames, ${checkedTargets} visible targets checked`);
}
// An odd terminal must also retain its bottom edge, even if stock centering
// cannot give equal margins. This reproduces the extra-row regression.
for (const canvasHeight of ['0', '26']) {
  const rows = 25, columns = 101;
  const result = spawnSync('ttfx', [
    '-i', path.join(artDir, '010-caterpie.txt'), '--frame-rate', '0',
    '--canvas-width', '0', '--canvas-height', canvasHeight, '--reuse-canvas',
    '--anchor-canvas', 'c', '--anchor-text', 'c', '--no-color',
    '--no-eol', '--no-restore-cursor', 'orbittingvolley', '--bottom-launcher-symbol', 'B',
  ], { env: { ...process.env, LINES: String(rows), COLUMNS: String(columns) }, encoding: 'utf8', timeout: 30000, maxBuffer: 128 * 1024 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const frames = result.stdout.split(`\x1b8\x1b7\x1b[${rows}A`).slice(1);
  const bottomVisible = frames.some(frame => frame.split('\n')[rows - 1]?.includes('B'));
  assert.equal(bottomVisible, canvasHeight === '0', `25-row terminal, canvas height ${canvasHeight}: bottom-edge regression control`);
}
console.log(`PASS ${totalFrames} animation frames across ${sizes.length * samples.length * 3} combinations, plus the odd-height bottom-edge regression`);
