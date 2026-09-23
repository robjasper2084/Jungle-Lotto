import {test} from 'node:test';
import assert from 'node:assert/strict';
import {useOuterApproach} from './entryPath.ts';
test('entry never backtracks to an outside marker from the doorway, in any orientation',()=>{for(let angle=0;angle<Math.PI*2;angle+=.2){const f={x:Math.sin(angle),z:Math.cos(angle)},approach={x:f.x*12,z:f.z*12};assert.equal(useOuterApproach({x:f.x*7,z:f.z*7},approach,f),false);assert.equal(useOuterApproach({x:f.x*16,z:f.z*16},approach,f),true);}});
