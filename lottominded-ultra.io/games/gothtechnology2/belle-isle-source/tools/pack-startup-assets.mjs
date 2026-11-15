import { readFile, writeFile, unlink } from 'node:fs/promises';
import { gzipSync, gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import paths from '../game/src/belle/startupAssets.json' with { type: 'json' };
import pins from '../game/src/belle/assetPins.json' with { type: 'json' };
import vehiclePins from '../game/src/belle/vehicles/assetPins.json' with { type: 'json' };

const dist = new URL('../game/dist/', import.meta.url);
const manifestFile = new URL('asset-manifest.json', dist);
const manifest = new Set(JSON.parse(await readFile(manifestFile, 'utf8')));
const pinned = new Set([pins, vehiclePins].flatMap(group => group.files.map(file => file.path)));
let originalBytes = 0, packedBytes = 0, publishedBytesRemoved = 0;

for (const path of paths) {
  if (!manifest.has(path)) throw Error('Startup asset missing from the build: ' + path);
  const input = await readFile(new URL(path, dist));
  const packed = gzipSync(input);
  assert.deepEqual(gunzipSync(packed), input, 'Startup asset lossless roundtrip: ' + path);
  await writeFile(new URL(path + '.gz', dist), packed);
  manifest.add(path + '.gz');
  originalBytes += input.length;
  packedBytes += packed.length;
  // The Pages assembler still verifies and omits the original pinned models.
  if (!pinned.has(path)) publishedBytesRemoved += input.length;
}

assert.ok(packedBytes < publishedBytesRemoved, 'Startup assets must reduce the published Pages footprint');
for (const path of paths.filter(path => !pinned.has(path))) {
  await unlink(new URL(path, dist));
  manifest.delete(path);
}
await writeFile(manifestFile, JSON.stringify([...manifest].sort(), null, 2) + '\n');
console.log({ originalBytes, packedBytes, pagesBytesSaved: publishedBytesRemoved - packedBytes });
