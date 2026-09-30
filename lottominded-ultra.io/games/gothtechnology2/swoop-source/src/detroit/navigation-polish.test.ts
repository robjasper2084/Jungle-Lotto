import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CITY,nearestCut} from './geography.ts';
import {routeToCut} from './cutNavigation.ts';
import {roadsidePoint,roadwayClearance,segmentDistance} from './roadsidePlacement.ts';
import {terrainVisualSurface} from './parkPaths.ts';

test('Milliken lawn never inherits coarse asphalt faces around the real path ribbon',()=>{
 for(let x=-270;x<0;x+=13)for(let z=-1500;z<-1030;z+=13)assert.equal(terrainVisualSurface(x,z,'pavement'),'grass');
 assert.equal(terrainVisualSurface(80,380,'brick'),'brick','preserve Hart Plaza');
});
test('all three Orleans approaches and street-name posts clear every intersecting road',()=>{
 const bases=[...[[.996,-.086],[.079,.997],[-.079,-.997]].map(([ux,uz])=>[-69.07+ux*9-uz*5.5,-1134.33+uz*9+ux*5.5]),[-69.07,-1134.33]];
 for(const r of CITY.roads.filter(r=>r.name)){
  const a=r.points[0],b=r.points[1];if(!b)continue;const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<1)continue;
  bases.push([a[0]+dz/len*(r.width/2+1.7),a[1]-dx/len*(r.width/2+1.7)]);
 }
 let placed=0;for(const [x,z]of bases){const p=roadsidePoint(x,z);if(!p)continue;placed++;assert.ok(roadwayClearance(p)>=1.15,`post blocks a roadway: ${JSON.stringify(p)}`);assert.ok(Math.hypot(p.x-x,p.z-z)<=24.001);}
 assert.ok(placed>20);
});
test('Atwater and Ze Mound directions follow connected mapped lanes to the Cut',()=>{
 for(const [x,z]of [[-72.5,-1180],[-134.4,-1091.95],[-69,-1134]]){
  const r=routeToCut(x,z);assert.ok(r.path.length>=2);assert.ok(r.distance>0&&r.distance<500);const end=r.path.at(-1)!;assert.ok(nearestCut(end.x,end.z).distance<.1);
  for(let i=1;i<r.path.length;i++){const a=r.path[i-1],b=r.path[i];assert.ok(CITY.roads.some(road=>road.points.slice(1).some((q,k)=>segmentDistance(a,road.points[k],q)<.05&&segmentDistance(b,road.points[k],q)<.05)),'navigation must follow a real road segment, not cross grass or buildings');}
 }
 const p=CITY.cut[3];assert.equal(routeToCut(p[0],p[1]).arrived,true);
});
