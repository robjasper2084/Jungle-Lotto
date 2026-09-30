import {test} from 'node:test';import assert from 'node:assert/strict';
import {readLayout,controlRect} from './touchLayout.ts';
test('invalid layout storage safely falls back',()=>{for(const raw of ['no','null','[]','{"stick":{"x":"bad","y":1,"scale":1}}'])assert.deepEqual(readLayout(raw),{});});
test('layout persists positions and clamps size and coordinates',()=>{assert.deepEqual(readLayout('{"stick":{"x":-5,"y":6,"scale":9}}'),{stick:{x:0,y:1,scale:1.6}});const p={brake:{x:.3,y:.4,scale:1.2}};assert.deepEqual(readLayout(JSON.stringify(p)),p);});
test('rotating phones keeps controls on screen with minimum touch size',()=>{for(const [w,h] of [[390,844],[844,390],[320,568]])for(const x of [0,.5,1])for(const y of [0,.5,1]){const r=controlRect({x,y,scale:.75},72,56,w,h);assert.ok(r.width>=48&&r.height>=48);assert.ok(r.left>=12&&r.top>=12);assert.ok(r.left+r.width<=w-12&&r.top+r.height<=h-12);}});
