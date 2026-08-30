import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cinematicModels } from '../../store/content/cinematic-models.ts';
import { demoProducts } from '../../store/content/catalog.ts';

test('the Mobster luggage charm uses the optimized supplied 3D asset', async () => {
  assert.deepEqual(cinematicModels, { hoodie: null, charm: null, mobsterCharm: 'models/mobster-luggage-charm.glb' });
  assert.equal(demoProducts.find(product => product.handle === 'night-protocol-hoodie')?.model, cinematicModels.hoodie);
  assert.equal(demoProducts.find(product => product.handle === 'gothtechnology-luggage-charm')?.model, cinematicModels.charm);
  const mobsterModel=resolve('store/public',cinematicModels.mobsterCharm!);
  const mobsterInfo=await stat(mobsterModel);
  assert.ok(mobsterInfo.size > 100_000 && mobsterInfo.size < 5_000_000);
  const mobsterReport=JSON.parse(await readFile(mobsterModel.replace(/\.glb$/,'.json'),'utf8'));
  assert.equal(mobsterReport.sourceSha256,'9c7b53faa47b4076604a9b673fceb983f73c82d068669e7bfbcb5b98184a56ec');
  assert.ok(mobsterReport.originalTriangles > 1_000_000);
  assert.ok(mobsterReport.triangles <= 80_000);
  assert.equal(mobsterReport.compression,'EXT_meshopt_compression');
  assert.equal(demoProducts.find(product => product.handle === 'mobster-luggage-charm')?.model, cinematicModels.mobsterCharm);
  assert.ok(demoProducts.every(product => product.demo));
});
