import test from 'node:test';
import assert from 'node:assert/strict';
import {canopyProfile} from './habitatPolicy.ts';

test('mapped tree models produce distinct deterministic canopy growth bands',()=>{
 const names=['willow','maple','birch','pine'];
 const profiles=names.map(id=>canopyProfile({id,x:2054.3,z:631.1,scale:1}));
 for(let i=0;i<names.length;i++){
  assert.deepEqual(profiles[i],canopyProfile({id:names[i],x:2054.3,z:631.1,scale:1}));
  assert(profiles[i].density>=.48&&profiles[i].density<=1.12);
  assert(profiles[i].height>=.6&&profiles[i].height<=1.4);
  assert(profiles[i].width>=.8&&profiles[i].width<=1.3);
 }
 assert.equal(new Set(profiles.map(p=>p.habitat)).size,4);
 assert(profiles[1].density>profiles[2].density,'flatwoods should be fuller than birch edges');
 assert(profiles[0].width>profiles[2].width,'riparian crowns should spread beyond forest-edge birch');
});

test('growth varies across planted patches without shifting the authored roots',()=>{
 const a=canopyProfile({id:'maple',x:120,z:130,scale:1});
 const b=canopyProfile({id:'maple',x:206,z:275,scale:1});
 assert.notDeepEqual(a,b);
 assert([a,b].every(p=>Object.values(p).every(v=>typeof v==='string'||Number.isFinite(v))));
});
