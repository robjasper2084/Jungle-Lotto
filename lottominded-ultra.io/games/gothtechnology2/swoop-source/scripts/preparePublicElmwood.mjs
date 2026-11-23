import {copyFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {buildElmwoodLods} from './build_elmwood_lods.mjs';

const source = fileURLToPath(new URL('../../elmwood-source/public/elmwood/models/', import.meta.url));
const output = fileURLToPath(new URL('../dist/exports/elmwood/', import.meta.url));
const models = [
  'white-oak', 'red-maple', 'american-elm', 'white-pine', 'weeping-willow',
  'elmwood-chapel', 'elmwood-gatehouse', 'flying-geese-baked', 'headstone-arched',
  'headstone-weathered', 'headstone-cross', 'obelisk', 'ledger', 'urn', 'grass-tuft',
  'fallen-leaf-patch', 'low-shrub',
];
await mkdir(output, {recursive:true});
for (const name of models) {
  await copyFile(resolve(source, name + '.glb'), resolve(output, name + '.glb'));
}
await buildElmwoodLods(source, output);
