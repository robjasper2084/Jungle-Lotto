import test from 'node:test';
import assert from 'node:assert/strict';
import {CITY,roadAt} from './geography.ts';
import {gpsAt} from './geo-profile.ts';
import {MACK_STUDIO,studioMap,studioCoordinates,studioWalk} from './mackStudioSite.ts';
import {heightAt} from './world.ts';
test('Mack studio replaces the verified Pellerito footprint at 2000 Mack',()=>{
 const gps=gpsAt(MACK_STUDIO.x,MACK_STUDIO.z);assert.ok(Math.abs(gps.lat-42.3543515)<.0001);assert.ok(Math.abs(gps.lon+83.0392553)<.0001);
 const footprint=CITY.buildings.find(b=>b.id===MACK_STUDIO.osmId)!;
 for(const [x,z]of footprint.points){const p=studioCoordinates(x,z);assert.ok(Math.abs(p.u)<=MACK_STUDIO.width/2+.03);assert.ok(Math.abs(p.v)<=MACK_STUDIO.depth/2+.03);}
});
test('both studio visits pass through the loading opening and stay on a level floor',()=>{
 for(const store of [false,true]){const path=studioWalk(store);
  for(let i=1;i<path.length;i++)for(let t=0;t<=1;t+=.05){const x=path[i-1].x+(path[i].x-path[i-1].x)*t,z=path[i-1].z+(path[i].z-path[i-1].z)*t,p=studioCoordinates(x,z);assert.equal(roadAt(x,z),undefined);assert.ok(Math.abs(heightAt(x,z)-MACK_STUDIO.floor)<.001);if(Math.abs(p.v-MACK_STUDIO.depth/2)<.6)assert.ok(Math.abs(p.u)<1.83);}
 }
 const gate=studioMap(34.5,40);assert.equal(roadAt(gate.x,gate.z),undefined,'yard gate must stay behind the public sidewalk');
});
