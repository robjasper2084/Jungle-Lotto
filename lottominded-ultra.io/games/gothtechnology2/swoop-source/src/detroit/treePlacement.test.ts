import test from 'node:test';import assert from 'node:assert/strict';
import {CITY,pointOnCut} from './geography.ts';
import {surfaceAt} from './world.ts';
import {terrainVisualSurface} from './parkPaths.ts';
import {grassTreeSite,cherryTreeSites} from './treePlacement.ts';
import {hasStreetCurb} from './streetCurbs.ts';
import {sidewalkHalfWidth} from './streetFurnitureLayout.ts';
import {segmentDistance} from './roadsidePlacement.ts';
import {cutWidth} from './geo-profile.ts';

test('cherry tree at the Atwater Cut entrance moves out of the paved apron into real lawn',()=>{
 const old=pointOnCut(35,-7);assert.equal(grassTreeSite(old.x,old.z,1.1),false);
 const trees=cherryTreeSites();assert.ok(trees.length>=4);assert.ok(trees.every(p=>Math.hypot(p.x-old.x,p.z-old.z)>1.1));
});
test('every relocated cherry trunk clears the full street sidewalk and every park path',()=>{
 for(const p of cherryTreeSites()){
  for(const [dx,dz] of [[0,0],[1.1,0],[-1.1,0],[0,1.1],[0,-1.1]])assert.equal(terrainVisualSurface(p.x+dx,p.z+dz,surfaceAt(p.x+dx,p.z+dz)),'grass');
  for(const r of CITY.roads)for(let i=1;i<r.points.length;i++)assert.ok(segmentDistance(p,r.points[i-1],r.points[i])>=r.width/2+(hasStreetCurb(r)?2*sidewalkHalfWidth(r):0)+1.1-1e-6,'tree intrudes on '+r.name);
 }
});
test('an entire sidewalk footprint is excluded even when its underlying terrain is lawn',()=>{
 const road=CITY.roads.find(r=>r.name==='Atwater Street'&&r.points.length>2)!,a=road.points[0],b=road.points[1],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),offset=road.width/2+sidewalkHalfWidth(road);
 assert.equal(grassTreeSite((a[0]+b[0])/2-dz/l*offset,(a[1]+b[1])/2+dx/l*offset),false);
});

test('scaled vegetation footprints never cross the paved trail edge anywhere along the Cut',()=>{
 for(let d=350;d<2600;d+=17){
  for(const side of [-1,1]){const p=pointOnCut(d,side*(cutWidth(d)/2+.2));assert.equal(grassTreeSite(p.x,p.z,.45),false,`clump overlaps paving at ${d}m`);}
 }
});
