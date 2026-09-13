#!/usr/bin/env node
// Build-time conversion only: the screensaver consumes the generated text files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(repo, 'sources/pokemon-ascii');
const outputDir = path.join(repo, 'files/.local/share/omarchy-pokemon-screensaver/art');
const check = process.argv.length === 3 && process.argv[2] === '--check';
if (process.argv.length > 2 && !check) throw new Error('Usage: node tools/normalize-pokemon.mjs [--check]');
const columns = 70, rows = 22, width = columns * 2, height = rows * 4;
const positions = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 3], [1, 3]];
const names = fs.readdirSync(sourceDir).filter(name => /^\d{3}-.+\.txt$/.test(name)).sort();
if (names.length !== 251 || names.some((name, i) => Number(name.slice(0, 3)) !== i + 1)) {
  throw new Error('Expected source artwork for exactly Pokédex entries 001–251');
}
const generated = [];
for (const name of names) {
  const lines = fs.readFileSync(path.join(sourceDir, name), 'utf8').trimEnd().split('\n').map(line => [...line]);
  const sourceWidth = Math.max(...lines.map(line => line.length)) * 2;
  const sourceHeight = lines.length * 4;
  const source = new Uint8Array(sourceWidth * sourceHeight);
  let x0 = sourceWidth, y0 = sourceHeight, x1 = -1, y1 = -1;
  lines.forEach((line, cy) => line.forEach((character, cx) => {
    if (character === ' ') return;
    const bits = character.codePointAt(0) - 0x2800;
    if (bits < 0 || bits > 255) throw new Error(`Unexpected character in ${name}`);
    positions.forEach(([dx, dy], bit) => {
      if (!(bits & (1 << bit))) return;
      const x = cx * 2 + dx, y = cy * 4 + dy;
      source[y * sourceWidth + x] = 1;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    });
  }));
  if (x1 < x0 || y1 < y0) throw new Error(`Empty silhouette: ${name}`);
  const visibleWidth = x1 - x0 + 1, visibleHeight = y1 - y0 + 1;
  const scale = Math.min(width / visibleWidth, height / visibleHeight);
  const scaledWidth = Math.max(1, Math.floor(visibleWidth * scale));
  const scaledHeight = Math.max(1, Math.floor(visibleHeight * scale));
  const offsetX = Math.floor((width - scaledWidth) / 2), offsetY = Math.floor((height - scaledHeight) / 2);
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < scaledHeight; y++) for (let x = 0; x < scaledWidth; x++) {
    const sx = x0 + Math.min(visibleWidth - 1, Math.floor((x + 0.5) * visibleWidth / scaledWidth));
    const sy = y0 + Math.min(visibleHeight - 1, Math.floor((y + 0.5) * visibleHeight / scaledHeight));
    mask[(y + offsetY) * width + x + offsetX] = source[sy * sourceWidth + sx];
  }
  const result = [];
  for (let cy = 0; cy < rows; cy++) {
    let line = '';
    for (let cx = 0; cx < columns; cx++) {
      let bits = 0;
      positions.forEach(([dx, dy], bit) => {
        if (mask[(cy * 4 + dy) * width + cx * 2 + dx]) bits |= 1 << bit;
      });
      // U+2800 is invisible but keeps ttfx from discarding the common canvas.
      line += String.fromCodePoint(0x2800 + bits);
    }
    result.push(line);
  }
  generated.push([name, result.join('\n') + '\n']);
}
// Validate the complete source set before replacing any generated files.
for (const [name, text] of generated) {
  const target = path.join(outputDir, name);
  if (check) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== text) throw new Error(`Outdated generated artwork: ${name}`);
  } else {
    fs.writeFileSync(target, text);
  }
}
console.log(`${check ? 'Verified' : 'Generated'} ${names.length} silhouettes on ${columns}×${rows} Braille canvases`);
