import test from 'node:test';import assert from 'node:assert/strict';import R from '@dimforge/rapier3d-compat';
import {TagTerrain,type TagFixture} from '../src/tag/fixture.ts';
import {RideController,NEUTRAL_ACTIONS} from '../src/controller.ts';
import {botObstacleRecovery,recoverBotObstacle} from '../src/botObstacleRecovery.ts';
import {GroundRoutes,groundTravelClear} from '../src/royale/groundRoute.ts';
import type {TerrainSampler} from '../src/terrain.ts';
await R.init();
test('moving bots decay obstruction history without unused collision queries',()=>{
 const terrain={raycastObstacle:()=>{throw Error('moving bot should not probe');}} as unknown as TerrainSampler;
 for(const speed of [.65,2,-.65,-2]){
  const state={...botObstacleRecovery(),blocked:.5};
  assert.equal(recoverBotObstacle(terrain,{x:0,y:0,z:0,headingY:0,speed},{x:0,y:0,z:10},state,2,1/60),undefined);
  assert.equal(state.blocked,.5-2/60);
 }
});
test('committed escape preserves its controls without unused front probes',()=>{
 const terrain={raycastObstacle:()=>{throw Error('committed escape should not probe');}} as unknown as TerrainSampler;
 const state={...botObstacleRecovery(),blocked:.7,until:5,heading:Math.PI,reverse:true};
 assert.deepEqual(recoverBotObstacle(terrain,{x:0,y:0,z:0,headingY:0,speed:0},{x:0,y:0,z:10},state,3,1/60),{throttle:-.5,steer:0});
 assert.equal(state.blocked,.7);assert.equal(state.until,5);
 assert.deepEqual(recoverBotObstacle(terrain,{x:0,y:0,z:0,headingY:0,speed:-2},{x:0,y:0,z:10},state,3.1,1/60),{throttle:0,steer:0});
});
async function wall(corner=false,props=false){
 const world=new R.World({x:0,y:0,z:0});if(!props)world.createCollider(R.ColliderDesc.cuboid(4,2,.4).setTranslation(0,2,2.4));
 if(corner)world.createCollider(R.ColliderDesc.cuboid(.4,2,4).setTranslation(2.4,2,0));
 world.step();
 const f:TagFixture={version:1,product:'elmwood-explorer',arena:'wall-recovery',revision:'test',hash:'test',physicsVersion:'0.20.0',transform:{sx:1,tx:0,ty:0,tz:0},physics:Buffer.from(world.takeSnapshot()).toString('base64'),walkable:Buffer.alloc(16,255).toString('base64'),grid:{x:-50,z:-50,width:11,height:11,spacing:10,heights:Array(121).fill(0)},lanes:[],spawns:[]};
 if(props)f.staticBoxes=[{x:0,y:2,z:2.4,hx:4,hy:2,hz:.4,yaw:0,kind:'building'}];
 world.free();return TagTerrain.create(f);
}
for(const props of [false,true])test(`initial body overlap may separate but ${props?'authored props':'physics walls'} still block entry and projectiles`,async()=>{
 const terrain=await wall(false,props);try{
  const p={x:0,y:1,z:1.8};
  assert.equal(terrain.raycastObstacle(p,{x:0,y:0,z:-1},2,.32),null);
  assert.equal(terrain.raycastObstacle(p,{x:0,y:0,z:1},2,.32),0);
  assert.equal(terrain.sweep(p,{x:0,y:0,z:-2},.32),0,'solid projectile query remains unchanged');
 }finally{terrain.dispose();}
});
for(const corner of [false,true])test(`mounted bot separates from ${corner?'building corner':'wall'} without falling or teleporting`,async()=>{
 const terrain=await wall(corner);try{
  const controller=new RideController(terrain,{spawn:{position:{x:corner?1.6:0,y:0,z:1.72},headingY:corner?Math.PI/4:0}}),state=botObstacleRecovery();
  const start={...controller.poseValue};let escaped=false;
  for(let i=0;i<600;i++){
   const p={...controller.poseValue},escape=recoverBotObstacle(terrain,p,{x:0,y:0,z:8},state,i/60,1/60);
   controller.step(1/60,{...NEUTRAL_ACTIONS,stableAI:true,...(escape??{throttle:.5,steer:0})});
   assert.equal(controller.crashed,false);assert.equal(controller.poseValue.footMode,0);
   assert(Math.hypot(controller.poseValue.x-p.x,controller.poseValue.z-p.z)<.4,'movement must be continuous');
   if(Math.hypot(controller.poseValue.x-start.x,controller.poseValue.z-start.z)>2){escaped=true;break;}
  }
  assert(escaped,JSON.stringify({pose:controller.poseValue,state}));
 }finally{terrain.dispose();}
});
test('sustained forward torque still stops at a solid wall at battle substeps',async()=>{
 const terrain=await wall();try{
  const rider=new RideController(terrain,{spawn:{position:{x:0,y:0,z:-2},headingY:0}});
  for(let i=0;i<900;i++)rider.step(1/120,{...NEUTRAL_ACTIONS,stableAI:true,throttle:1});
  assert(rider.poseValue.z>0&&rider.poseValue.z<1.5,JSON.stringify(rider.poseValue));
  assert.equal(rider.crashed,false);assert.equal(rider.poseValue.footMode,0);
  assert(Math.abs(rider.poseValue.speed)<.1);
 }finally{terrain.dispose();}
});
test('ground graph rejects a visible cliff crossing and keeps its physically reachable detour',()=>{
 const nodes=[{x:0,y:0,z:-2},{x:0,y:2,z:2},{x:6,y:0,z:-2},{x:6,y:2,z:2}];
 const edges=new Map<number,Map<number,number>>();for(const[a,b,w]of [[0,1,4],[0,2,6],[2,3,4],[3,1,6]])for(const[u,v]of[[a,b],[b,a]]){const e=edges.get(u)??new Map();e.set(v,w);edges.set(u,e);}
 const terrain={ground:(x:number,z:number)=>({height:x<4?(z<0?0:2):Math.max(0,Math.min(2,(z+2)/2)),offCourse:false}),raycastObstacle:()=>null,raycast:()=>null,sampleGround:()=>({height:0,normal:{x:0,y:1,z:0},surface:'pavement' as const,offCourse:false})};
 assert.equal(groundTravelClear(terrain,nodes[0],nodes[1]),false);
 const routes=new GroundRoutes(nodes,edges,terrain),first=routes.path(nodes[0],nodes[1]);assert.deepEqual(first,[nodes[0],nodes[2],nodes[3],nodes[1]]);
 assert.deepEqual(routes.path(nodes[0],nodes[1]),first,'warm and cold route results must match');
 const target={x:0,y:2,z:3,footPhase:4,headingY:1};
 assert.deepEqual(routes.path(nodes[0],target).at(-1),{x:0,y:2,z:3},'route endpoints retain only coordinates, not an enemy animation pose');
});
