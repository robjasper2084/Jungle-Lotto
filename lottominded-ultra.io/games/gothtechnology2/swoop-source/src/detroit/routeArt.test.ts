import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ROUTE_BILLBOARDS,ROUTE_GALLERY,billboardPlacement,fittedArtwork} from './routeArt.ts';
import {cutCoords} from './world.ts';
import {GEO,cutWidth,nearestRamp} from './geo-profile.ts';

test('campaign boards and every support corner leave the trail and ramps clear',()=>{
 for(const site of [...ROUTE_BILLBOARDS,...ROUTE_GALLERY]){
  const p=billboardPlacement(site.at,site.offset);
  assert.ok(GEO.bridges.every(b=>Math.abs(b.at-site.at)>30));
  for(const solid of p.solids)for(const x of [-solid.hx,solid.hx])for(const z of [-solid.hz,solid.hz]){
   const wx=solid.x+Math.cos(p.yaw)*x+Math.sin(p.yaw)*z,wz=solid.z-Math.sin(p.yaw)*x+Math.cos(p.yaw)*z,q=cutCoords(wx,wz);
   assert.ok(Math.abs(q.u)-cutWidth(q.d)/2>1.8,'trail shoulder clearance at '+site.at);
   assert.ok(nearestRamp(wx,wz).distance>4,'ramp clearance at '+site.at);
  }
 }
});

test('gallery preserves both portrait and landscape aspect ratios without cropping credits',()=>{
 for(const [w,h] of [[559,738],[2048,1360],[720,540]]){const a=fittedArtwork(w,h);assert.ok(a.width<=6.1&&a.height<=3.21);assert.ok(Math.abs(a.width/a.height-w/h)<1e-10);}
});
