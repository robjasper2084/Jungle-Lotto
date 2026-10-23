import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {heroAssets} from './heroTestAssets.ts';
import {Hero} from './actors.ts';
import {RIDER_CHOICES} from './riderChoices.ts';
import {createPose} from './controller.ts';

test('completed on-foot fast path matches the full mounted-to-foot blend for every hero',async()=>{
 const assets=await heroAssets();
 for(const {id}of RIDER_CHOICES){
  const fast=new Hero(assets,undefined,id),full=new Hero(assets,undefined,id);
  try{for(let i=0;i<36;i++){
   const pose={...createPose(),x:4,z:-3,headingY:i*.13,footMode:2,footBlend:1,footTime:i/60,footPhase:i/36,footCycle:i/36,speed:i%2?2:-2,footCrouch:i>11&&i<24?1:0,footProne:i>=24?1:0,parkX:9,parkY:0,parkZ:-3};
   fast.apply(pose);full.apply({...pose,footBlend:1-Number.EPSILON});
   fast.root.updateMatrixWorld(true);full.root.updateMatrixWorld(true);
   for(let j=0;j<fast.bones.length;j++){
    const a=fast.bones[j].o,b=full.bones[j].o;
    assert(a.getWorldPosition(new T.Vector3()).distanceTo(b.getWorldPosition(new T.Vector3()))<1e-6,id+' '+a.name+' position');
    const angle=a.getWorldQuaternion(new T.Quaternion()).normalize().angleTo(b.getWorldQuaternion(new T.Quaternion()).normalize());
    assert(angle<1e-6,id+' '+a.name+' rotation '+i+': '+angle);
   }
   assert(fast.vehicle.getWorldPosition(new T.Vector3()).distanceTo(full.vehicle.getWorldPosition(new T.Vector3()))<1e-6,id+' parked wheel');
  }}finally{fast.dispose();full.dispose();}
 }
});
test('loading-time foot fitting preserves mounted poses and later walking for every hero',async()=>{
 const assets=await heroAssets();
 for(const {id}of RIDER_CHOICES){
  const warm=new Hero(assets,undefined,id),cold=new Hero(assets,undefined,id);
  const compare=()=>{for(let i=0;i<warm.bones.length;i++)assert(warm.bones[i].o.getWorldPosition(new T.Vector3()).distanceTo(cold.bones[i].o.getWorldPosition(new T.Vector3()))<1e-6,id+' '+warm.bones[i].o.name);assert(warm.vehicle.getWorldPosition(new T.Vector3()).distanceTo(cold.vehicle.getWorldPosition(new T.Vector3()))<1e-6,id+' wheel');};
  try{
   warm.prepareOnFoot();compare();
   for(let i=0;i<4;i++){
    const pose={...createPose(),x:4,z:-3,headingY:.4,footMode:2,footBlend:1,footTime:i/60,footCycle:i/60,speed:2,parkX:9,parkY:0,parkZ:-3};
    warm.apply(pose);cold.apply(pose);compare();
    warm.prepareOnFoot();compare(); // Repeated warm-up must not reset an active pose.
   }
  }finally{warm.dispose();cold.dispose();}
 }
});
