import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), 'utf8');

test('release contract keeps the offline demonstration path explicit', async () => {
  const explorer = await read('apps/web/components/explorer/explorer.tsx');
  const fallback = await read('apps/web/lib/demo-fallback.ts');
  assert.match(explorer, /Read-only fallback/);
  assert.match(explorer, /loadPrecomputedDemo/);
  assert.match(fallback, /dataset_label/);
});

test('release contract exposes all comparison and review controls', async () => {
  const explorer = await read('apps/web/components/explorer/explorer.tsx');
  const demo = await read('apps/web/components/demo/demo-investigation.tsx');
  for (const control of ['blink', 'split', 'difference', 'Comparison divider', 'Spectral blink']) assert.match(explorer, new RegExp(control));
  for (const control of ['Submit classification', 'Community opinion', 'TRACE PROVENANCE']) assert.match(demo, new RegExp(control));
});

test('release contract keeps the checked-in demo asset route allowlisted', async () => {
  const route = await read('apps/web/app/api/demo-assets/[name]/route.ts');
  assert.match(route, /summary\.json/);
  assert.match(route, /candidate-overlay\.pgm/);
});
