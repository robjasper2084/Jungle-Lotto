import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyRoadWidths} from './road-widths.mjs';
import {makePavementPlan} from './pavement-plan.mjs';
import {ParkTerrain,inside,segment} from '../game/src/belle/terrain.ts';
import {createStreetPlan} from '../game/src/belle/streetPlan.ts';

const road=(id,extra={})=>({id,name:'Park road',highway:'unclassified',lanes:2,width:6.3,foot:false,bridge:false,surface:'asphalt',points:[[0,0],[0,50]],...extra});
test('cruising allowances keep pedestrian corridors and bridge decks at their authored widths',()=>{
 const map={roads:[road('drive'),road('foot',{foot:true,width:2.6}),road('bridge',{bridge:true}),road('interior',{highway:'corridor'}),road('wide',{width:26})]};
 applyRoadWidths(map);assert.equal(map.roads[0].width,8.4);
 assert.deepEqual(map.roads.slice(1).map(r=>r.width),[2.6,6.3,6.3,26]);
 assert.equal(map.roads[0].sourceWidth,6.3);
 const first=JSON.stringify(map);applyRoadWidths(map);assert.equal(JSON.stringify(map),first,'rerunning the builder must not expand a road again');
});
test('a separate cycle track keeps its full width when the motor corridor grows',()=>{
 const map={roads:[road('cycle',{width:9.7,cycleTrack:true}),road('service',{highway:'service'}),road('link',{highway:'secondary_link',width:5})]};applyRoadWidths(map);
 assert.deepEqual(map.roads.map(r=>r.width),[11.8,7.2,6.8]);
 assert.ok((map.roads[0].width-3.4)/2-2.04>2,'one motor lane must have over two metres total clearance around the fan guards');
});
const map=JSON.parse(fs.readFileSync(new URL('../game/public/belle/map.json',import.meta.url)));
const terrain=new ParkTerrain(map);
test('widened real road shoulders are actually paved and supported, with curbs outside the fan envelope',()=>{
 const parts=makePavementPlan(map,terrain).filter(p=>p.level==='ground');
 const paved=(x,z)=>parts.some(p=>p.polygons.some(r=>inside(x,z,r[0])&&!r.slice(1).some(h=>inside(x,z,h))));
 const street=createStreetPlan(map);let checked=0,curbs=0;
 for(const r of map.roads.filter(r=>r.sourceWidth===6.3&&r.width===8.4&&!r.bridge)){
  for(let i=1;i<r.points.length;i++){
   const a=r.points[i-1],b=r.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<20)continue;
   const nx=(b[1]-a[1])/len,nz=-(b[0]-a[0])/len;
   for(const side of[-1,1]){
    const x=(a[0]+b[0])/2+nx*3.65*side,z=(a[1]+b[1])/2+nz*3.65*side;
    if(!terrain.land(x,z)||terrain.obstructed(x,z,.4)||map.buildings.some(b=>inside(x,z,b.points)))continue;
    assert.ok(paved(x,z),'new shoulder missing on '+r.id);
    const hit=terrain.raycast({x,y:terrain.height(x,z)+3,z},{x:0,y:-1,z:0},5);
    assert.ok(hit!==null&&Number.isFinite(hit),'new shoulder lacks ground collision on '+r.id);checked++;
   }
  }
  for(const curb of street.boxes.filter(b=>b.road===r.id&&b.material==='curb')){
   for(const end of[-.5,0,.5]){
    const x=curb.x+Math.sin(curb.yaw)*curb.l*end,z=curb.z+Math.cos(curb.yaw)*curb.l*end;
    const distance=Math.min(...r.points.slice(1).map((p,i)=>segment(x,z,r.points[i],p).d));
    assert.ok(distance>=r.width/2+curb.w/2-.03,'curb cuts into widened road '+r.id);
   }curbs++;
  }
 }
 assert.ok(checked>100,'must check a broad set of real route shoulders');assert.ok(curbs>100,'must check regenerated real curbs');
});
