import {test} from 'node:test';
import assert from 'node:assert/strict';
import {STUDIO_FIXTURES,RETAIL_FIXTURES,STUDIO_VIEWS} from './studioInteriorLayout.ts';
import {studioWalk,studioCoordinates,studioMap} from './mackStudioSite.ts';
const fixtures=[...STUDIO_FIXTURES,...RETAIL_FIXTURES];
function clear(u:number,v:number,radius=.45){return fixtures.every(p=>Math.abs(u-p.u)>p.width/2+radius||Math.abs(v-p.v)>p.depth/2+radius);}
test('shared entrance and both dismount walks stay clear of new retail fixtures',()=>{
 for(const store of [false,true]){
  const path=studioWalk(store).map(p=>studioCoordinates(p.x,p.z));
  for(let i=1;i<path.length;i++)for(let n=0;n<=100;n++){const t=n/100,u=path[i-1].u*(1-t)+path[i].u*t,v=path[i-1].v*(1-t)+path[i].v*t;assert.ok(clear(u,v),`${store?'store':'gallery'} walk blocked at ${u},${v}`);}
 }
});
test('central studio corridor and talent marks allow a rider and nearby dog',()=>{
 for(let v=-17.5;v<=21;v+=.1)assert.ok(clear(0,v,.85),'centre aisle at '+v);
 for(const [u,v]of [[0,-16],[12,5.5],[-12,7.6]])assert.ok(clear(u,v,.65),'interior spawn');
});
test('studio camera presets are inside the building and above the floor',()=>{
 for(const preset of Object.values(STUDIO_VIEWS)){
  assert.ok(clear(preset.eye[0],preset.eye[2],.15),'camera inside a fixture');
  assert.ok(Math.abs(preset.eye[0])<24&&Math.abs(preset.eye[2])<21&&preset.eye[1]>.5&&preset.eye[1]<5.5);
  const map=studioMap(preset.eye[0],preset.eye[2]),roundtrip=studioCoordinates(map.x,map.z);assert.ok(Math.abs(roundtrip.u-preset.eye[0])<1e-8&&Math.abs(roundtrip.v-preset.eye[2])<1e-8);
 }
});
