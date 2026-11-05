import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainChunks} from './world.ts';
import {streetFurnitureSites} from './streetFurnitureLayout.ts';
import {streetFurnitureForChunks} from './streetFurnitureCache.ts';

test('cached Detroit street detail matches the clearance search exactly',()=>{
 const chunks=terrainChunks();
 const expected=streetFurnitureSites((x,z)=>chunks.some(c=>Math.abs(c.x-x)<=50&&Math.abs(c.z-z)<=50));
 assert.deepEqual(streetFurnitureForChunks(chunks),expected,'Regenerate with scripts/cache-street-furniture.mjs after changing mapped placements');
 assert.deepEqual(streetFurnitureForChunks([...chunks].reverse()),expected);
});
test('custom map coverage cannot receive cached objects outside its terrain',()=>{
 assert.deepEqual(streetFurnitureForChunks([]),[]);
 const chunks=[{x:50,z:-1050}];
 assert.deepEqual(streetFurnitureForChunks(chunks),streetFurnitureSites((x,z)=>Math.abs(x-50)<=50&&Math.abs(z+1050)<=50));
});
