import {test} from 'node:test';
import assert from 'node:assert/strict';
import {indoorRideArea} from './indoorRiding.ts';
import {studioMap} from './mackStudioSite.ts';
import {lottoMap} from './lottoShopSite.ts';
import {pennyMap} from './pennyShopSite.ts';
import {RideController,NEUTRAL_ACTIONS,createPose} from './controller.ts';
import type {TerrainSampler} from './terrain.ts';
const flat:TerrainSampler={sampleGround(_x,_z,out){out.height=0;out.normal={x:0,y:1,z:0};out.surface='pavement';out.offCourse=false;return out;},raycast:()=>null,raycastObstacle:()=>null};
const advance=(c:RideController,t:number,throttle=0)=>{for(let i=0;i<t*120;i++)c.step(1/120,{...NEUTRAL_ACTIONS,throttle});};
test('protection covers actual interiors and ends outside their entrances',()=>{
 for(const [p,label]of [[studioMap(12,3),'GothTech store'],[studioMap(-12,3),'Serengeti gallery'],[lottoMap(0,0),'LottoMind store'],[pennyMap(0,0),'Penny Exchange']] as const)assert.equal(indoorRideArea(p.x,p.z),label);
 for(const p of [studioMap(12,27),lottoMap(0,12),pennyMap(0,-12)])assert.equal(indoorRideArea(p.x,p.z),undefined);
});
test('a fast indoor wall hit stops the wheel while both feet remain mounted',()=>{
 let wall=false;const c=new RideController({...flat,riderProtectionAt:()=>true,raycastObstacle:()=>wall?0:null});advance(c,2,1);assert.ok(c.snapshot().speed>4.2);wall=true;advance(c,.2);advance(c,1.2);const p=createPose();c.writePose(p);assert.equal(c.crashed,false);assert.equal(p.speed,0);assert.equal(p.crashBlend,0);assert.equal(p.stopFoot,0);assert.equal(c.receiveImpact({speed:18,vx:10,vz:10}),false);
});
test('indoor dog contact does not block travel, while outdoor contact still stops the hero',()=>{
 for(const indoor of [false,true]){const dog={id:'companion',x:0,y:0,z:1.1,radius:.36,height:.85,kind:'dog',vx:0,vz:0};const c=new RideController({...flat,riderProtectionAt:()=>indoor,navigationObstacles:()=>[dog]},{spawn:{position:{x:0,y:0,z:0},headingY:0}});advance(c,1.5,.4);assert.equal(c.crashed,false);assert.ok(indoor?c.snapshot().position.z>2:c.snapshot().position.z<.5);}
});
test('hard outdoor impacts retain normal crash behavior',()=>{let wall=false;const c=new RideController({...flat,riderProtectionAt:()=>false,raycastObstacle:()=>wall?0:null});advance(c,2,1);wall=true;advance(c,.1);assert.equal(c.crashed,true);});
