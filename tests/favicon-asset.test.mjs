import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const layoutSource = readFileSync(path.join(rootDir, 'app/layout.tsx'), 'utf8');
const svgSource = readFileSync(path.join(rootDir, 'public/favicon.svg'), 'utf8');

test('layout metadata keeps favicon.svg as the linked tab icon', () => {
  assert.match(layoutSource, /url:\s*"\/favicon\.svg"/);
  assert.match(layoutSource, /type:\s*"image\/svg\+xml"/);
});

test('favicon svg contains the IA monogram asset instead of the old i glyph', () => {
  assert.match(svgSource, /id="ia-monogram"/);
  assert.match(svgSource, /id="powder-blue-tile"/);
  assert.match(svgSource, /fill="#153E7B"/);
  assert.doesNotMatch(svgSource, />i<\/text>/);
});
