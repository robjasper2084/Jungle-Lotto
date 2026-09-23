import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {cutLampSites,buildCutLights,lampClearOfBridges} from './cutLights.ts';
import {cutCoords,heightAt} from './world.ts';
import {cutWidth,nearestRamp,GEO} from './geo-profile.ts';
test('lanterns stand on terrain outside the path and avoid bridge decks and ramps',()=>{
 const sites=cutLampSites();assert.ok(sites.length>80);
 for(const p of sites){const q=cutCoords(p.x,p.z);assert.ok(Math.abs(q.u)>cutWidth(q.d)/2+.7);assert.equal(p.y,heightAt(p.x,p.z));assert.ok(nearestRamp(p.x,p.z).distance>=3);assert.ok(GEO.bridges.every(b=>Math.abs(b.at-q.d)>=18));}
});
test('dusk light pool stays bounded and day disables real illumination',()=>{
 const scene=new T.Scene(),g=new T.Group();scene.add(g);const lamps=buildCutLights(scene,()=>g),p=cutLampSites()[0];
 const lights=scene.children.filter(o=>o instanceof T.SpotLight) as T.SpotLight[];assert.equal(lights.length,4);
 lamps.setDusk(true);lamps.update(p.x,p.z);assert.ok(lights.some(l=>l.intensity>0));assert.ok(lights.every(l=>!l.castShadow));
 lamps.setDusk(false);lamps.update(p.x,p.z);assert.ok(lights.every(l=>l.intensity===0));
});

test('bridge footprint clearance rejects bridge edges even far from the station centre',()=>{
 for(const b of GEO.bridges){for(const [x,z] of b.points)assert.equal(lampClearOfBridges(x,z),false,b.name);}
 for(const p of cutLampSites())assert.ok(lampClearOfBridges(p.x,p.z));
});
