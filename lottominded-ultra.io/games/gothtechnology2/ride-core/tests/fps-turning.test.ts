import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeEngine} from '../src/engine/runtime.ts';
import {RideController,NEUTRAL_ACTIONS} from '../src/controller.ts';
import {ArenaTerrain} from '../src/royale/arena.ts';
import {RoyaleMatch,neutral,PROTECTION} from '../src/royale/rules.ts';
import {FootAim,wrapYaw} from '../../swoop-source/src/detroit/royale/footAim.ts';
import type {TerrainSampler} from '../src/terrain.ts';
const flat:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});},raycast:()=>null,raycastObstacle:()=>null};
function walker(){const c=new RideController(flat);c.step(1/120,{...NEUTRAL_ACTIONS,dismount:true});for(let i=0;i<100;i++)c.step(1/120,NEUTRAL_ACTIONS);return c;}
test('foot look crosses the yaw seam repeatedly and preserves the parked wheel',()=>{
 const c=walker(),aim=new FootAim(),p=c.poseValue,park=[p.parkX,p.parkY,p.parkZ];aim.sync(p);
 for(let i=0;i<400;i++){aim.turn(.09);c.step(1/120,{...NEUTRAL_ACTIONS,facingYaw:aim.heading});assert(Math.abs(wrapYaw(p.headingY-aim.heading))<1e-8);}
 assert.deepEqual([p.parkX,p.parkY,p.parkZ],park);assert.equal(p.footMode,2);
 aim.sync({...p,footMode:0});assert(!aim.active);aim.sync({...p,headingY:1});assert.equal(aim.heading,1);
});
test('on-foot right input strafes screen right at every heading; diagonals do not boost speed',()=>{
 for(const yaw of [0,Math.PI/2,-Math.PI,1.1]){
  const c=walker(),before={...c.poseValue};for(let i=0;i<240;i++)c.step(1/120,{...NEUTRAL_ACTIONS,facingYaw:yaw,steer:1});
  const p=c.poseValue,dx=p.x-before.x,dz=p.z-before.z;assert(dx*-Math.cos(yaw)+dz*Math.sin(yaw)>3);assert(Math.abs(wrapYaw(p.headingY-yaw))<1e-8);
 }
 const a=walker(),b=walker();for(let i=0;i<240;i++){a.step(1/120,{...NEUTRAL_ACTIONS,facingYaw:0,throttle:1});b.step(1/120,{...NEUTRAL_ACTIONS,facingYaw:0,throttle:1,steer:1});}
 assert(Math.abs(a.poseValue.speed-b.poseValue.speed)<1e-6);
});
test('compiled authority accepts free foot heading, rejects invalid heading and shoots along it',async()=>{
 await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));
 const terrain=await ArenaTerrain.create(),m=new RoyaleMatch(terrain,true);m.add('a','A');m.add('b','B');m.start('fps',1);
 const a=m.actors[0];a.controller.reset({position:{x:0,y:0,z:0},headingY:0});a.pose={...a.controller.poseValue};
 m.actors[1].controller.reset({position:{x:0,y:0,z:-40},headingY:0});m.actors[1].pose={...m.actors[1].controller.poseValue};
 let seq=0;const tick=(values={})=>{assert(m.command('a',{...neutral(m.round,++seq,m.tick),...values}));m.step();};
 for(let i=0;i<PROTECTION+1;i++)tick();tick({dismount:true});for(let i=0;i<50;i++)tick();assert.equal(a.pose.footMode,2);
 assert(!m.command('a',{...neutral(m.round,seq+1,m.tick),facingYaw:Infinity}));
 assert(!m.command('a',{...neutral(m.round,seq+1,m.tick),facingYaw:Math.PI+.01}));
 tick({facingYaw:Math.PI,fire:true,shot:1});assert(Math.abs(Math.abs(a.pose.headingY)-Math.PI)<1e-8);
 assert(m.projectiles.some(p=>p.owner==='a'&&p.v.z< -100),'muzzle must follow authoritative foot heading');
 assert.equal(a.ammo.static,79);m.dispose();terrain.dispose();
});
