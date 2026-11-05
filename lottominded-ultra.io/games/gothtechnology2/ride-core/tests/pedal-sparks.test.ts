import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,LineBasicMaterial} from 'three';
import {PedalSparks} from '../src/pedalSparks.ts';
import {RideController,createPose,NEUTRAL_ACTIONS} from '../src/controller.ts';
import {RideFeedback} from '../src/rideFeedback.ts';
import type {TerrainSampler} from '../src/terrain.ts';

const flat:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});},raycast:()=>null,raycastObstacle:()=>null};
function contact(side=1){const p=createPose();p.speed=15;p.rollAngle=side*.94;p.velocityZ=15;new RideFeedback().update(1/60,p,flat,true,false);return p;}

test('both low pedals emit at their physical contact point; straight riding does not',()=>{
 for(const side of [-1,1]){
  const scene=new Scene(),effect=new PedalSparks(scene),p=contact(side);
  assert.equal(p.scrapeSide,side);assert.ok(p.scrape>0);
  effect.update(1/60,p,true);assert.ok(effect.count>0);assert.equal(effect.mesh.visible,true);
  const a=effect.mesh.geometry.getAttribute('position');
  assert.ok(Math.abs(a.getX(0)-p.scrapeX)<1e-5);assert.ok(Math.abs(a.getY(0)-p.scrapeY-.025)<1e-5);
  assert.ok(a.getZ(1)>a.getZ(0),'tail trails the backward-moving spark');
  p.rollAngle=0;new RideFeedback().update(1/60,p,flat,true,false);
  for(let i=0;i<30;i++)effect.update(1/60,p,true);
  assert.equal(effect.count,0);assert.equal(effect.mesh.visible,false);effect.dispose();
 }
});

test('real full-lock controller turns trigger sparks in either direction',()=>{
 for(const steer of [-1,1]){
  const sim=new RideController(flat),effect=new PedalSparks(new Scene());let peak=0;
  for(let i=0;i<840;i++)sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});
  for(let i=0;i<180;i++){
   sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:.7,steer});const p=createPose();sim.writePose(p);
   effect.update(1/120,p,!sim.crashed);peak=Math.max(peak,effect.count);
  }
  assert.ok(peak>0);effect.dispose();
 }
});

test('soft ground, on foot, falls, airborne and stationary stale contact cannot ignite',()=>{
 const effect=new PedalSparks(new Scene());
 for(const change of [{scrapeHard:0},{footMode:2},{crashBlend:.2},{airHeight:.3},{speed:0},{scrapeX:NaN}]){
  effect.update(.05,{...contact(),...change},true);assert.equal(effect.count,0);
 }
 effect.dispose();
});

test('pool stays bounded through long turns and stalls, then clears on pause and reduced motion',()=>{
 const scene=new Scene(),effect=new PedalSparks(scene),p=contact(),position=effect.mesh.geometry.getAttribute('position');
 for(let i=0;i<3000;i++)effect.update(i%120===0?20:1/60,p,true);
 assert.ok(effect.count>0&&effect.count<=96);assert.equal(scene.children.length,1);
 const count=effect.count;effect.update(0,p,true);assert.equal(effect.count,count,'extra display callbacks do not blink the effect');
 assert.equal(effect.mesh.geometry.getAttribute('position'),position);assert.equal(position.count,192);
 assert.ok(Array.from(position.array).every(Number.isFinite));
 assert.equal((effect.mesh.material as LineBasicMaterial).toneMapped,false);
 assert.equal((effect.mesh.material as LineBasicMaterial).depthTest,true);
 effect.update(1/60,p,false);assert.equal(effect.count,0);assert.equal(effect.mesh.visible,false);
 effect.update(.05,p,true);effect.update(.05,p,true,true);assert.equal(effect.count,0);
 let geometries=0,materials=0;effect.mesh.geometry.addEventListener('dispose',()=>geometries++);
 (effect.mesh.material as LineBasicMaterial).addEventListener('dispose',()=>materials++);
 effect.dispose();effect.dispose();effect.update(.05,p,true);
 assert.equal(scene.children.length,0);assert.equal(effect.count,0);assert.equal(geometries,1);assert.equal(materials,1);
});
