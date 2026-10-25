import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {initializeEngine} from '../src/engine/runtime.ts';
import {ArenaTerrain} from '../src/royale/arena.ts';
import {RoyaleMatch,neutral,PROTECTION} from '../src/royale/rules.ts';
import {RideController,NEUTRAL_ACTIONS} from '../src/controller.ts';
import {findVault,vaultPosition} from '../src/royale/vault.ts';
import {smokeBlocks,smokeLanding} from '../src/royale/smoke.ts';
import {sampleKimodoEvade,KIMODO_EVADE} from '../src/kimodoEvade.ts';
import {EVADE_TICKS,evadeDirection} from '../src/royale/evade.ts';
import type {TerrainSampler,Vec3} from '../src/terrain.ts';
await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));
const arena=await ArenaTerrain.create();
function setup(){const m=new RoyaleMatch(arena);for(let i=0;i<6;i++)m.add('r'+i,'Rider '+i);m.start('tactical',4);for(let i=0;i<PROTECTION;i++)m.step();m.actors.forEach((a,i)=>{a.controller.reset({position:{x:i?40+i*4:0,y:0,z:0},headingY:0});a.controller.combatOnFoot=true;a.controller.knockOff();a.pose={...a.controller.poseValue};});for(let i=0;i<150;i++)m.step();return m;}
function send(m:RoyaleMatch,c:Partial<ReturnType<typeof neutral>>){const a=m.actors[0];assert(m.command(a.id,{...neutral(m.round,a.lastSeq+1,m.tick),...c}));m.step();}
test('Kimodo evade retains provenance and a real low roll between standing endpoints',async()=>{
 const bytes=await readFile(new URL('../art/kimodo-evade/motion.npz',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),KIMODO_EVADE.sourceSha256);
 const rows=Array.from({length:101},(_,i)=>sampleKimodoEvade(i/100));assert(rows.every(r=>r.every(Number.isFinite)));
 assert(Math.min(...rows.map(r=>r[45]))<.3);assert(rows[0][45]>.85&&rows.at(-1)![45]>.85);
});
test('evade is one committed action, cancels fire/reload, retains collision and restores deterministically',()=>{
 const m=setup(),a=m.actors[0],start={...a.pose};send(m,{evade:3,fire:true,shot:1,reload:true});
 assert.equal(a.combat.melee!.evadeUntil-m.tick,EVADE_TICKS);assert.equal(a.shots,0);assert.equal(a.combat.reloadStart,-1);
 for(let i=0;i<30;i++)send(m,{evade:3,fire:true,shot:i+2});assert.equal(a.shots,0);assert(a.pose.z>start.z+.4);
 const saved=m.captureEngineState();for(let i=0;i<100;i++)m.step();const end=m.captureEngineState();m.restoreEngineState(saved);for(let i=0;i<100;i++)m.step();assert.deepEqual(m.captureEngineState(),end);
 assert.equal(m.actors[0].pose.footEvade,0);assert(m.actors[0].pose.z-start.z<6);m.dispose();
});
test('smoke consumes finite inventory, blocks vision symmetrically, restores and expires',()=>{
 const m=setup();send(m,{smoke:true});assert.equal(m.actors[0].smokeCharges,1);assert.equal(m.smokeClouds.length,1);const cloud=m.smokeClouds[0];
 const a={...cloud.p,y:1.4,z:cloud.p.z-8},b={...cloud.p,y:1.4,z:cloud.p.z+8};assert(smokeBlocks([cloud],a,b,cloud.start+60));assert(smokeBlocks([cloud],b,a,cloud.start+60));assert(!smokeBlocks([cloud],{...a,y:12},{...b,y:12},cloud.start+60));
 send(m,{smoke:true});assert.equal(m.actors[0].smokeCharges,1);const saved=m.captureEngineState();m.restoreEngineState(saved);assert.deepEqual(m.smokeClouds,saved.smokeClouds);
 for(let i=0;i<1100;i++)m.step();assert.equal(m.smokeClouds.length,0);assert(!smokeBlocks([cloud],a,b,cloud.end));m.dispose();
});
test('the same smoke hides enemy snapshots and prevents bot acquisition and firing',()=>{
 const m=setup();m.actors.forEach((a,i)=>{a.controller.reset({position:{x:i>1?300:0,y:0,z:i===1?12:0},headingY:i===1?Math.PI:0});a.controller.combatOnFoot=true;a.controller.knockOff();a.pose={...a.controller.poseValue};});
 m.actors[1].bot=true;m.smokeClouds=[{id:'test-cover',owner:'r0',p:{x:0,y:0,z:6},start:m.tick-60,end:m.tick+600}];
 assert(!m.snapshot('r0').actors.some(a=>a.id==='r1'));
 assert(!m.snapshot('r1').actors.some(a=>a.id==='r0'));
 for(let i=0;i<35;i++)m.step();assert.equal(m.actors[1].shots,0);assert.equal(m.actors[1].target,undefined);m.dispose();
});
function obstacle(height=.8,roof=false,drop=false):TerrainSampler{
 const hit=(o:Vec3,d:Vec3,max:number,r=0)=>{const lo=[-3-r,-r,.7-r],hi=[3+r,height+r,1.15+r],a=[o.x,o.y,o.z],v=[d.x,d.y,d.z];let near=0,far=max;for(let i=0;i<3;i++){if(Math.abs(v[i])<1e-8){if(a[i]<lo[i]||a[i]>hi[i])return null;}else{let x=(lo[i]-a[i])/v[i],y=(hi[i]-a[i])/v[i];if(x>y)[x,y]=[y,x];near=Math.max(near,x);far=Math.min(far,y);if(near>far)return null;}}return near;};
 return{sampleGround(_x,z,out){return Object.assign(out,{height:drop&&z>1.3?-2:0,offCourse:false,normal:{x:0,y:1,z:0},surface:'pavement'});},raycast:()=>null,raycastObstacle(o,d,max,r){if(roof&&d.y>.5)return .05;return hit(o,d,max,r);}};
}
test('vault validates low cover, tall walls, ceilings and safe landing; replay resumes mid-vault',()=>{
 const p={x:0,y:0,z:0,headingY:0},t=obstacle(),plan=findVault(t,p);assert(plan);assert(plan.to.z>1.4);assert(vaultPosition(plan,.5).y>.9);
 assert.equal(findVault(obstacle(2.5),p),null);assert.equal(findVault(obstacle(.8,true),p),null);assert.equal(findVault(obstacle(.8,false,true),p),null);
 const c=new RideController(t,{spawn:{position:{x:0,y:0,z:0},headingY:0}});c.combatOnFoot=true;c.knockOff();for(let i=0;i<300;i++)c.step(1/120,NEUTRAL_ACTIONS);c.step(1/120,{...NEUTRAL_ACTIONS,vault:true});for(let i=0;i<35;i++)c.step(1/120,NEUTRAL_ACTIONS);assert(c.poseValue.footVault>0);
 const copy=new RideController(t);copy.restoreState(c.captureState());for(let i=0;i<100;i++){c.step(1/120,NEUTRAL_ACTIONS);copy.step(1/120,NEUTRAL_ACTIONS);}assert.deepEqual(copy.captureState(),c.captureState());assert.equal(c.poseValue.footVault,0);assert(c.poseValue.z>1.4);assert.equal(c.poseValue.y,0);
 const landing=smokeLanding(obstacle(2.5),p,0)!;assert(landing.z<.7,'smoke cannot be placed through a wall');
});

test('evade directions follow the same screen-relative signs as walking',()=>{assert.equal(evadeDirection(1,0),3);assert.equal(evadeDirection(-1,0),2);assert.equal(evadeDirection(0,1),-1);assert.equal(evadeDirection(0,-1),1);});
