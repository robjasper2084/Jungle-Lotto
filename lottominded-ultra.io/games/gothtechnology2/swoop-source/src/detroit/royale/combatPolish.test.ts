import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createPose} from '../../../../ride-core/src/controller.ts';
import {weaponSocket} from '../../../../ride-core/src/royale/rules.ts';
import type {BattleTerrain} from '../../../../ride-core/src/royale/battleTerrain.ts';
import {fpsAim} from './fpsAim.ts';
import {combatChaseEye,combatLookGain,readCombatPreferences,retractCombatCamera} from './combatPolish.ts';
import {readScopeSensitivity} from './scopeSensitivity.ts';

test('hip look is independent of equipped optic; ADS uses only the selected ADS channel',()=>{
 const p=readCombatPreferences(null),s=readScopeSensitivity(null);s.scope8.look=.2;s.scope8.ads=1.5;
 assert.equal(combatLookGain(.004,1,.65,0,true,'scope8',s,p),combatLookGain(.004,1,.65,0,true,null,s,p));
 assert(Math.abs(combatLookGain(.004,1,.65,2,true,'scope8',s,p,true)-.004*.65*1.5/8)<1e-12);
 assert(Math.abs(combatLookGain(.004,1,.65,2,true,'scope8',s,p,false)-.004*.65*.2/8)<1e-12);
 p.firstLook=.5;assert.equal(combatLookGain(.004,1,.65,0,true,null,s,p),.002);
 assert.equal(combatLookGain(.004,1,.65,0,false,null,s,p),.004);
 assert.deepEqual(readCombatPreferences({firstFov:NaN,thirdFov:999,shoulder:0}),{...readCombatPreferences(null),thirdFov:90});
});
test('combat shoulder view is closer, on the chosen side, and retracts without orbiting',()=>{
 const anchor=new Vector3(0,1.5,0),eye=combatChaseEye(anchor,0,1,1,false),left=combatChaseEye(anchor,0,1,-1,false);
 assert(eye.x<0&&left.x>0);assert(eye.distanceTo(anchor)<3.3);
 const original=eye.clone().sub(anchor).normalize();retractCombatCamera(eye,anchor,()=>1,0);
 assert(eye.clone().sub(anchor).normalize().distanceTo(original)<1e-8);assert(Math.abs(eye.distanceTo(anchor)-.84)<1e-8);
});
test('FPP and both TPP shoulders converge on the crosshair at 10–100m, with recoil applied once',()=>{
 for(const skin of ['DS_Armored_Rider_01','DS_Mascot_Suit_01'])for(const distance of [10,25,50,100])for(const side of [-1,0,1]){
  const p={...createPose(),footMode:2,footBlend:1},scale=skin.includes('Mascot')?.48:1,origin=side?combatChaseEye(new Vector3(0,1.4*scale,0),0,scale,side,false):new Vector3(0,1.64*scale,0);
  const kickYaw=.012,kickPitch=.06,d=new Vector3(Math.sin(kickYaw)*Math.cos(kickPitch),Math.sin(kickPitch),Math.cos(kickYaw)*Math.cos(kickPitch)),target=origin.clone().addScaledVector(d,distance);
  const terrain={raycast:()=>null} as unknown as BattleTerrain;
  const a=fpsAim(p,skin,kickYaw,kickPitch,1,0,terrain,[],{origin,range:500,kickYaw,kickPitch,targets:[{center:target}],targetHeading:0});
  const yaw=a.aimYaw+kickYaw,pitch=a.aimPitch+kickPitch,muzzle=weaponSocket(p,skin,yaw,pitch,1,0).muzzle,ray=new Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)),to=target.clone().sub(new Vector3(muzzle.x,muzzle.y,muzzle.z));
  assert(to.clone().addScaledVector(ray,-to.dot(ray)).length()<.02,`${skin} ${side} at ${distance}m misses`);assert(Math.abs(a.distance-distance)<1e-7);
 }
});
test('a nearby muzzle obstruction is reported even when the camera can see the target',()=>{
 const p={...createPose(),footMode:2,footBlend:1},origin=new Vector3(-.62,1.7,-3.1);
 const terrain={raycast:(_o:unknown,_d:unknown,max:number)=>max<=2?.3:null} as unknown as BattleTerrain;
 assert(fpsAim(p,'DS_Armored_Rider_01',0,0,0,0,terrain,[],{origin,range:500,kickYaw:0,kickPitch:0}).blocked);
});

test('camera shoulders clear thin posts and billboard edges without changing the viewing axis',()=>{
 const anchor=new Vector3(0,1.5,0),eye=new Vector3(0,1.8,-3),direction=eye.clone().sub(anchor).normalize();
 retractCombatCamera(eye,anchor,o=>Math.abs(o.x)>.1?1.1:null,0);
 assert(eye.distanceTo(anchor)<1);assert(eye.clone().sub(anchor).normalize().distanceTo(direction)<1e-7);
});
