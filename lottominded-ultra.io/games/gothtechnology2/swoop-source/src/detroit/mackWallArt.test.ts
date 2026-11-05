import test from 'node:test';import assert from 'node:assert/strict';
import {mackMuralGeometry} from './mackWallArt.ts';import {studioMap,MACK_STUDIO} from './mackStudioSite.ts';
import {nearestCut} from './geography.ts';import {billboardPlacement} from './routeArt.ts';import {nearestRamp} from './geo-profile.ts';
test('mural covers Cut-facing warehouse wall with an undistorted central figure',()=>{
 const near=studioMap(MACK_STUDIO.width/2,0),far=studioMap(-MACK_STUDIO.width/2,0);assert(nearestCut(near.x,near.z).distance<nearestCut(far.x,far.z).distance);
 const g=mackMuralGeometry(),p=g.attributes.position,u=g.attributes.uv;g.computeBoundingBox();assert(Math.abs(g.boundingBox!.max.x-g.boundingBox!.min.x-MACK_STUDIO.depth-.29)<1e-4);
 assert(Math.abs((p.getX(7)-p.getX(6))/6.07/(u.getX(7)-u.getX(6))-1344/752)<1e-5);g.dispose();
 const b=billboardPlacement(2300,-8.5);assert(nearestRamp(b.x,b.z).distance>7);
});
