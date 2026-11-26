import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BRIDGE_PICTURE_VIEW_ID,BRIDGE_PICTURE_VIEW_NAME,bridgePictureView} from './bridgePictureView.ts';
import {ParkTerrain,type ParkMap} from './terrain.ts';
const map=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
test('arrival view uses the mapped island-side bridge and remains collision-safe',()=>{
 const v=bridgePictureView(map),terrain=new ParkTerrain(map,true),b=terrain.bridge(v.x,v.z);
 assert.equal(BRIDGE_PICTURE_VIEW_ID,'belle-photo-bridge-arrival');
 assert.equal(BRIDGE_PICTURE_VIEW_NAME,'MacArthur Bridge · cinematic arrival');
 assert(b.active&&b.t>.8&&b.t<1);
 assert(Math.abs(b.side)<.1);
 assert(terrain.land(v.x,v.z));
 assert(!terrain.obstructed(v.x,v.z,.5));
 assert(v.fromLandingM>=40&&v.fromLandingM<=75);
 assert(Number.isFinite(terrain.height(v.x,v.z)));
 assert.deepEqual(bridgePictureView(map),v);
});
test('bridge view refuses incorrect map axes, not inventing a new location',()=>{
 assert.throws(()=>bridgePictureView({...map,bridge:{...map.bridge,length:-1}}),/Invalid MacArthur/);
 assert.throws(()=>bridgePictureView({...map,bridge:{...map.bridge,b:[100000,100000]}}),/Invalid MacArthur/);
});
