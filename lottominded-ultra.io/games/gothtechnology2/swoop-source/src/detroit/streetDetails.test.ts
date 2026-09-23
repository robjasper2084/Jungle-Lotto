import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CITY,pointOnCut,CUT_METRES} from './geography.ts';
import {curbRise,hasStreetCurb} from './streetCurbs.ts';
import {routeRailLayout} from './routeRails.ts';
import {heightAt,cutCoords} from './world.ts';
import {GEO,cutWidth} from './geo-profile.ts';
test('curbs belong to streets, never the main cycling path or footpaths',()=>{
 assert.ok(CITY.roads.some(hasStreetCurb));for(const r of CITY.roads.filter(r=>['cycleway','footway','path','pedestrian'].includes(r.kind)))assert.equal(hasStreetCurb(r),false);
});
test('curbs lower at mapped entrances and stay at or below 15 cm',()=>{
 const road=CITY.roads.find(hasStreetCurb)!;
 for(const r of GEO.ramps){const p=r.points.at(-1)!;assert.equal(curbRise(road,p[0],p[1]),0);}
 for(const d of [1,CUT_METRES]){const p=pointOnCut(d);assert.equal(curbRise(road,p.x,p.z),0);}
 let full=0;for(const r of CITY.roads.filter(hasStreetCurb))for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<1)continue;const x=(a[0]+b[0])/2-dz/length*(r.width/2+.2),z=(a[1]+b[1])/2+dx/length*(r.width/2+.2),height=curbRise(r,x,z);assert.ok(height>=0&&height<=.15);if(height===.15)full++;}assert.ok(full>10);
});
test('open access gates and safety rails keep the full greenway corridor clear',t=>{
 const runs=routeRailLayout(heightAt);assert.ok(runs.some(r=>r.kind==='gate'));assert.ok(runs.some(r=>r.kind==='fence'));assert.ok(runs.some(r=>r.kind==='rail'));
 for(const r of runs){for(const p of [r.a,r.b]){assert.ok(Number.isFinite(p.x+p.y+p.z));const c=cutCoords(p.x,p.z);assert.ok(Math.abs(c.u)>cutWidth(c.d)/2+.1,`${r.name} blocks route at ${c.d}`);}assert.ok(Math.hypot(r.a.x-r.b.x,r.a.z-r.b.z)<3);}
 t.diagnostic(JSON.stringify({runs:runs.length,gates:runs.filter(r=>r.kind==='gate').length}));
});
