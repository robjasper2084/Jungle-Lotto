import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFountainLighting,FOUNTAIN_COLORS,FOUNTAIN_CUE_SECONDS} from './fountainLighting.ts';
test('fountain colors vary, stay finite, and loop without a flash',()=>{
 const lights=createFountainLighting(),first=lights.primary.value.clone(),cycle=FOUNTAIN_COLORS.length*FOUNTAIN_CUE_SECONDS;
 lights.update(36);
 assert(lights.primary.value.toArray().some((v,i)=>Math.abs(v-first.toArray()[i])>.2));
 for(let t=0;t<cycle;t+=.25){lights.update(t);for(const c of [lights.primary.value,lights.secondary.value])for(const v of c.toArray())assert(Number.isFinite(v)&&v>=0&&v<=1);}
 lights.update(cycle-.001);const before=lights.primary.value.clone();lights.update(cycle+.001);
 assert(lights.primary.value.toArray().every((v,i)=>Math.abs(v-before.toArray()[i])<.00001));
 lights.update(cycle);assert.deepEqual(lights.primary.value.toArray(),first.toArray());
});
test('independent fountain materials sample identical colors at the same time',()=>{
 const water=createFountainLighting(),stone=createFountainLighting();water.update(47.125);stone.update(47.125);
 assert.deepEqual(water.primary.value.toArray(),stone.primary.value.toArray());assert.deepEqual(water.secondary.value.toArray(),stone.secondary.value.toArray());
});
