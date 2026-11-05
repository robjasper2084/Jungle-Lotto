import test from 'node:test';import assert from 'node:assert/strict';
import * as T from 'three';
import {createPose} from '../controller.ts';
import {RiderPresentation} from './riderPresentation.ts';
import {FieldBoundary} from './fieldBoundary.ts';
import {ShieldEffect} from './shieldEffect.ts';
import type {GLTF} from '../compressedGLTFLoader.ts';

test('additive riding motion preserves authoritative pose and pauses without drift',()=>{
 const motion=new RiderPresentation(),p={...createPose(),naturalMotion:1,speed:10};
 motion.sample(p,1,true,0,false,false);const snapshot=structuredClone(p);p.speed=8;
 const out=motion.sample(p,4,true,0,true,false);assert(out.bodyDrop>p.bodyDrop);assert(out.bodyPitch<p.bodyPitch);assert.equal(out.x,p.x);assert.equal(out.headingY,p.headingY);
 const repeat=motion.sample(p,4,true,0,false,false,false,0);assert.deepEqual(out,repeat);assert.equal(snapshot.bodyPitch,p.bodyPitch);
 const reduced=new RiderPresentation();reduced.sample(p,1,true,0,false,true);assert(Math.abs(reduced.sample(p,4,true,0,true,true).bodyPitch-p.bodyPitch)<Math.abs(out.bodyPitch-p.bodyPitch));
});
test('riding balance stays consistent at 60, 120 and 144Hz with interpolated display poses',()=>{
 const values=[60,120,144].map(fps=>{
  const motion=new RiderPresentation();let out=createPose();
  for(let i=0;i<=fps;i++){const t=i/fps,tick=Math.floor(t*60);out=motion.sample({...createPose(),speed:5+t*2,headingY:t*.2},tick,true,0,false,false,false,1/fps,{...createPose(),speed:5+tick/30,headingY:tick/300});}
  return out;
 });
 for(const p of values.slice(1)){
  assert(Math.abs(p.bodyPitch-values[0].bodyPitch)<.0001);
  assert(Math.abs(p.bodyChestRoll-values[0].bodyChestRoll)<.0001);
 }
});

test('extra display callbacks cannot corrupt the next simulation balance baseline',()=>{
 const poseAt=(tick:number)=>({...createPose(),naturalMotion:1,speed:12-tick/30,headingY:Math.atan2(Math.sin(Math.PI-.05+tick/75),Math.cos(Math.PI-.05+tick/75))});
 for(const callbacks of [2,4]){const regular=new RiderPresentation(),frequent=new RiderPresentation();
  for(let tick=0;tick<90;tick++){
   const p=poseAt(tick),original=structuredClone(p),expected=regular.sample(p,tick,true,3,tick===10,false),actual=frequent.sample(p,tick,true,3,tick===10,false);
   assert.deepEqual(actual,expected);assert.deepEqual(p,original);
   // Extra callbacks are zero elapsed display time; the pose varies but the
   // simulation baseline, pending recoil and authoritative pose must not change.
   for(let frame=1;frame<callbacks;frame++)frequent.sample(poseAt(tick+frame/callbacks),tick,true,3,false,false,false,0);
  }
 }
});

test('bank articulation bends over planted pedals without changing wheel or collision pose',()=>{
 const p={...createPose(),naturalMotion:1,speed:12,rollAngle:.5,riderRoll:.5},copy=structuredClone(p),m=new RiderPresentation();
 const out=m.sample(p,10,true,0,false,false);
 assert(out.bodyDrop>p.bodyDrop);assert(out.riderRoll<p.riderRoll);assert(out.bodyChestRoll>p.bodyChestRoll);
 for(const key of ['x','y','z','rollAngle','wheelPitch','wheelSpin','suspensionOffset'] as const)assert.equal(out[key],p[key]);assert.deepEqual(p,copy);
});
test('elimination uses separation and settle; reentry resets death pose and leaves controller recovery intact',()=>{
 const motion=new RiderPresentation(),p={...createPose(),speed:8,naturalMotion:1};
 motion.sample(p,0,true,0,false,false);motion.sample(p,10,false,0,false,false);
 const fall=motion.sample(p,50,false,0,false,false);assert(fall.crashRelease>.9);assert(fall.crashDrop>.5);assert.notEqual(fall.wheelCrashForward,fall.crashForward);
 const settled=motion.sample(p,190,false,0,false,false);assert(settled.crashSettle>.99);
 const reentry=motion.sample({...p,speed:0},200,true,1,false,false);assert.equal(reentry.crashBlend,0);assert.equal(reentry.crashDrop,0);
 const recovering={...p,crashBlend:.7,crashRecovery:.4};assert.deepEqual(motion.sample(recovering,210,true,1,false,false),recovering);
});
test('field energy is bounded, finite and disabled for reduced motion and low quality',()=>{
 const field=new FieldBoundary('#63efd9',.9);field.update(0,0,100,()=>2);field.energize(5,4,false,false);
 const arc=field.children[0] as T.LineSegments;assert(arc.visible);const positions=arc.geometry.getAttribute('position');assert.equal(positions.count,96);
 for(const n of positions.array)assert(Number.isFinite(n));field.energize(6,4,true,false);assert(!arc.visible);field.energize(6,4,false,true);assert(!arc.visible);
});
test('victory salute is frame-rate independent and reduced-motion reaches a steady pose',()=>{
 const p=createPose();const poses=[16,64].map(fps=>{const motion=new RiderPresentation();let out=p;for(let i=0;i<fps/4;i++)out=motion.sample(p,100,true,0,false,false,true,1/fps);return out;});
 assert(Math.abs(poses[0].handRY-poses[1].handRY)<1e-9);assert(poses[0].handRY>p.handRY);
 const reduced=new RiderPresentation();assert.equal(reduced.sample(p,100,true,0,false,true,true).handRY,p.handRY+.8);
});

test('blue barrier follows sloping terrain and stays visible on low quality without motion',()=>{
 const field=new FieldBoundary('#49adff',.9,true);field.update(14,-8,150,(x,z)=>x*.1+z*.2);
 field.energize(12,50,true,true);const wall=field.barrier!;
 assert(wall.visible);assert.equal(wall.material.depthWrite,false);
 assert.equal(wall.material.uniforms.motion.value,0);assert.equal(wall.material.uniforms.time.value,0);
 const points=wall.geometry.getAttribute('position');
 for(let i=0;i<points.count;i+=2){
  assert(Math.abs(points.getY(i)-(points.getX(i)*.1+points.getZ(i)*.2-.2))<1e-4);
  assert(Math.abs(points.getY(i+1)-points.getY(i)-45)<1e-4);
 }
 assert(wall.geometry.index!.count/3<=512,'single low-poly curtain budget');
 field.energize(13,50,false,false);assert.equal(wall.material.uniforms.motion.value,1);
 const scene=new T.Scene();scene.add(field);let disposed=false;wall.material.addEventListener('dispose',()=>disposed=true);
 field.dispose();assert(disposed);assert.equal(scene.children.length,0);
});
test('shield break reaction finishes and does not mutate shared source materials',()=>{
 const scene=new T.Group(),model=new T.Group();model.name='FX_RiderShield';for(const name of ['ShieldParticles','ShieldRibbons']){const part=new T.Group();part.name=name;model.add(part);}scene.add(model);
 const effect=new ShieldEffect({scene} as unknown as GLTF);effect.visible=true;effect.hit(true);assert(effect.reacting);
 effect.update(.1,true,false);assert(effect.reacting);for(let i=0;i<7;i++)effect.update(.1,false,false);assert(!effect.reacting);effect.dispose();assert.equal(scene.children.length,1);
});
