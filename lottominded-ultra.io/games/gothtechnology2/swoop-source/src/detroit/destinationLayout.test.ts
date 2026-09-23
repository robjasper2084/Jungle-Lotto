import test from 'node:test';import assert from 'node:assert/strict';
import {destinationLayout} from './destinationLayout.ts';import {roadAt} from './geography.ts';
import {heightAt} from './world.ts';
test('destination buildings and forecourts clear mapped roads and foundations reach terrain',()=>{
 for(const store of [false,true]){const l=destinationLayout(store);for(let x=-9*l.scale;x<=9*l.scale;x++)for(let z=-10*l.scale;z<=6*l.scale;z++){const angle=-l.heading,xx=l.map.x+Math.cos(angle)*x+Math.sin(angle)*z,zz=l.map.z-Math.sin(angle)*x+Math.cos(angle)*z;assert.equal(roadAt(xx,zz),undefined,store?'store overlaps road':'gallery overlaps road');assert.ok(l.map.y-l.foundationDepth<=heightAt(xx,zz)+.02);}}
});
