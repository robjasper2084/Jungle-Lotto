import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPose} from '../src/controller.ts';
import {combatFootEye,footLeanOffset,footLeanWeight,limitCombatLean} from '../src/royale/lean.ts';
import {weaponSocket,neutral} from '../src/royale/rules.ts';
import {EngineContext,initializeEngine} from '../src/engine/runtime.ts';
import {routeBattleInput} from '../src/engine/royaleKernel.ts';
import {fpsAim} from '../../swoop-source/src/detroit/royale/fpsAim.ts';
import {FpsControlFlow} from '../../swoop-source/src/detroit/royale/fpsControlFlow.ts';
import type {BattleTerrain} from '../src/royale/battleTerrain.ts';

test('left/right eye and muzzle peek together at every heading and stance without moving the player',()=>{
 for(const headingY of [0,.8,Math.PI,-2])for(const scale of [1,.48])for(const footCrouch of [0,1]){
  const p={...createPose(),x:10,y:2,z:5,headingY,footMode:2,footBlend:1,footCrouch},saved=structuredClone(p),skin=scale===1?'hero':'DS_Mascot_Suit_01';
  const base=combatFootEye(p,scale,0),socket=weaponSocket(p,skin,0,0,1,0);
  for(const lean of [-1,1]){
   const eye=combatFootEye(p,scale,lean),muzzle=weaponSocket(p,skin,0,0,1,lean).muzzle;
   const screenRight=(eye.x-base.x)*-Math.cos(headingY)+(eye.z-base.z)*Math.sin(headingY);
   assert(Math.abs(screenRight-.3*lean*scale)<1e-9);
   assert(Math.abs(muzzle.x-socket.muzzle.x-(eye.x-base.x))<1e-9);
   assert(Math.abs(muzzle.z-socket.muzzle.z-(eye.z-base.z))<1e-9);
   assert(Math.abs(muzzle.y-socket.muzzle.y-(eye.y-base.y))<1e-9);
  }
  assert.deepEqual(p,saved);
 }
});

test('peek respects wall clearance and cancels during jump, prone, sprint, and mounting',()=>{
 const p={...createPose(),footMode:2,footBlend:1},wall={raycastObstacle:()=>.09};
 const eye=combatFootEye(p,1,1,wall);assert(eye.x<0&&eye.x>=-.065);
 const limited=limitCombatLean(p,'hero',1,wall);assert(limited>0&&limited<.25);
 for(const changed of [{footJump:1},{footProne:1},{speed:5},{footMode:3},{airBlend:1},{crashBlend:1}]){
  const pose={...p,...changed};assert.equal(footLeanWeight(pose),0);assert(footLeanOffset(pose,1).side===0);assert.equal(limitCombatLean(pose,'hero',1,wall),0);
 }
});

test('ADS crosshair and physical muzzle converge while peeking left or right',()=>{
 const terrain={raycast:()=>null,raycastObstacle:()=>null} as unknown as BattleTerrain;
 for(const lean of [-1,1])for(const footCrouch of [0,1]){
  const p={...createPose(),footMode:2,footBlend:1,footCrouch},eye=combatFootEye(p,1,lean);
  const aim=fpsAim(p,'hero',0,0,1,lean,terrain,[],{origin:eye,range:12,kickYaw:0,kickPitch:0});
  const muzzle=weaponSocket(p,'hero',aim.aimYaw,aim.aimPitch,1,lean).muzzle,t=(12-muzzle.z)/(Math.cos(aim.aimYaw)*Math.cos(aim.aimPitch));
  assert(Math.abs(muzzle.x+Math.sin(aim.aimYaw)*Math.cos(aim.aimPitch)*t-eye.x)<.005);
  assert(Math.abs(muzzle.y+Math.sin(aim.aimPitch)*t-eye.y)<.005);
 }
});

test('lean interrupts sprint without dropping held ADS or fire',()=>{
 const flow=new FpsControlFlow(),input={enabled:true,onFoot:true,moving:true,sprint:false,aimMode:2,fire:false,reloading:false,low:false};
 flow.update(input);assert.equal(flow.update({...input,sprint:true}).aimMode,0);
 for(const lean of [-1,1]){const result=flow.update({...input,sprint:true,lean,fire:true});assert.equal(result.aimMode,2);assert(result.fire);assert(!result.sprint);}
});

await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));
test('compiled authoritative muzzle agrees with the ADS preview for both lean sides and hero scales',()=>{
 for(const scale of [1,.48])for(const footCrouch of [0,1])for(const lean of [-1,1]){
  const core=new EngineContext();for(let i=0;i<6;i++)core.checked('add',i);core.checked('start',23);
  const p={...createPose(),x:11,y:2,z:8,headingY:.8,footMode:2,footBlend:1,footCrouch};
  core.checked('pose',0,p.x,p.y,p.z,p.headingY,0,scale);
  const stance=()=>{for(const [channel,value]of [[22,1],[25,footCrouch],[32,1],[33,footLeanWeight(p)]])core.checked('set',0,channel,value);};
  const command={...neutral('test'),aimMode:2,lean,aimYaw:.3,aimPitch:.1};
  for(let i=0;i<260;i++){routeBattleInput(core,0,command);stance();core.checked('begin');core.checked('rules');core.checked('end');}
  routeBattleInput(core,0,{...command,fire:true});stance();core.checked('begin');core.checked('rules');
  const index=Array.from({length:256},(_,i)=>i).find(i=>core.call('projectile',i,0));assert(index!==undefined);
  const expected=weaponSocket(p,scale===1?'hero':'DS_Mascot_Suit_01',core.get(0,4)*1.25,core.get(0,5)*.65,core.call('combat',0,9),core.call('combat',0,10)).muzzle;
  for(const [channel,value]of [[5,expected.x],[6,expected.y],[7,expected.z]])assert(Math.abs(core.call('projectile',index,channel)-value)<.00001,JSON.stringify({scale,footCrouch,lean,channel,actual:core.call('projectile',index,channel),expected:value}));
  core.dispose();
 }
});
