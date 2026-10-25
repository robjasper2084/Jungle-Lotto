import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {sampleTemplate,TEMPLATE_MOTION,templateLocomotion} from '../../../../ride-core/src/templateMotion.ts';
import {TEMPLATE_ACTIONS,templateReloadTime,templateWeapon,templateLook} from '../../../../ride-core/src/templateActions.ts';
import {Hero} from '../actors.ts';
import {heroAssets,jointPositions} from '../heroTestAssets.ts';
import {RIDER_CHOICES} from '../riderChoices.ts';
import {createPose} from '../controller.ts';
import {FpsMotion,reloadPose} from './fpsMotion.ts';
import {initialCombat} from '../../../../ride-core/src/royale/rules.ts';
import {fpsBodyAction} from './fpsBattlePose.ts';

test('all 20 source clips are present, finite, with closed locomotion loops',()=>{
 assert.equal(Object.keys(TEMPLATE_MOTION).length+Object.keys(TEMPLATE_ACTIONS).length,20);
 for(const [name,clip]of Object.entries(TEMPLATE_MOTION)){
  assert.match(clip.sha256,/^[a-f0-9]{64}$/);assert(clip.frames.length>10);
  for(const row of clip.frames){assert.equal(row.length,59);assert(row.every(Number.isFinite));}
  if(clip.loop){assert.deepEqual(clip.frames[0],clip.frames.at(-1));const a=sampleTemplate(name as keyof typeof TEMPLATE_MOTION,.99999),b=sampleTemplate(name as keyof typeof TEMPLATE_MOTION,.00001);assert(Math.max(...a.map((n,i)=>Math.abs(n-b[i])))<.01,name+' loop discontinuity');}
 }
 assert.notDeepEqual(templateLocomotion(5.4,0,.3,1),templateLocomotion(5.4,Math.PI,.3,1));
});
test('authored reload insertion follows ammunition commit and returns exactly to idle',()=>{
 assert.equal(templateReloadTime(100,160,190,160),1.5);
 assert.equal(templateReloadTime(100,160,190,190),3.05);
 const motion=templateWeapon('Pistol Reload',.8);assert(Math.abs(motion.rotation[2])>.3);assert(Math.hypot(...motion.hand)>.1);
 const end=templateWeapon('Pistol Reload',3.05);assert(Math.hypot(...end.position)<1e-8);assert(Math.hypot(...end.rotation)<1e-8);
 assert(templateLook(1.4,1.2)['UpperChest Twist Left-Right']>0);
 assert(templateLook(-1.4,-.8)['Head Turn Left-Right']<0);
 assert.equal(reloadPose({...initialCombat(),reloadStart:100,reloadCommit:160,reloadEnd:190},190).active,false);
});
test('planted left and right shoes share the standing neutral, not each FBX starting pose',()=>{
 for(const name of ['walk','run','back'] as const){const rows=TEMPLATE_MOTION[name].frames;
  for(const side of [0,1]){const height=25+side*3,pitch=26+side*3,lowest=Math.min(...rows.map(r=>r[height]));
   const contact=rows.filter(r=>r[height]<=lowest+.015);assert(contact.length>0);
   assert(Math.min(...contact.map(r=>Math.abs(r[pitch])))<.25,name+' planted '+side+' shoe points away from floor');
  }
 }
});
test('recoil is frame-rate independent, curb contacts do not trigger landing, body actions hide FPS hands',()=>{
 const idle=reloadPose(initialCombat(),0),samples=[30,60,120].map(hz=>{const m=new FpsMotion();let result;for(let i=0;i<hz/2;i++)result=m.update(1/hz,'static',i===0,0,false,false,false,idle);return result!.kick;});
 assert(Math.max(...samples)-Math.min(...samples)<1e-10);
 const m=new FpsMotion();m.update(1/60,'static',false,2,true,false,false,idle);assert.equal(m.update(1/60,'static',false,2,false,false,false,idle).land,0);
 for(const pose of [{crashBlend:.5},{footMode:3},{footVault:.5},{footProne:.5}])assert(fpsBodyAction({...createPose(),...pose},initialCombat(),1));
});
test('template combat fits all five riders without stretching bones or changing the holstered walk',async t=>{
 const assets=await heroAssets();
 for(const {id}of RIDER_CHOICES){const hero=new Hero(assets,undefined,id,'kimodo');
  const base={...createPose(),footMode:2,footBlend:1,speed:2.1,footTime:1,footCycle:.2};hero.apply(base);const original=jointPositions(hero);
  hero.combatLocomotion=1;let min=Infinity,maxStep=0,previous:T.Vector3|undefined;
  for(const speed of [0,2.1,5.4,-2.1]){previous=undefined;for(let i=0;i<=24;i++){
   hero.apply({...base,speed,footTime:2+speed+i/60,footCycle:i/24,velocityZ:speed});
   for(const b of hero.bones){assert(b.o.quaternion.toArray().every(Number.isFinite));if(b.o.name!=='Hips')assert(b.o.position.distanceTo(b.p)<1e-6,id+' stretched '+b.o.name);}
   const hip=hero.rider.getObjectByName('Hips')!.getWorldPosition(new T.Vector3());if(previous)maxStep=Math.max(maxStep,hip.distanceTo(previous));previous=hip;
   if(i%12===0){const bottom=new T.Box3().setFromObject(hero.rider,true).min.y;min=Math.min(min,bottom);assert(bottom>-.045,id+' penetrates ground '+bottom);}
  }}
  assert(maxStep<.15*hero.motionScale,id+' abrupt pelvis motion '+maxStep);
  hero.combatLocomotion=0;hero.apply({...base,footTime:0});hero.apply(base);assert.deepEqual(jointPositions(hero),original,id+' unarmed pose changed');
  t.diagnostic(JSON.stringify({id,min,maxStep}));hero.dispose();
 }
});
