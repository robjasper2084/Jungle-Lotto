import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Box3} from 'three';
import {Hero} from './actors.ts';
import {heroAssets} from './heroTestAssets.ts';
import {RIDER_CHOICES} from './riderChoices.ts';
import {createPose} from './controller.ts';
import {wheelPickupTiming,WHEEL_PICKUP_APPROACH,WHEEL_PICKUP_DURATION} from '../../../ride-core/src/wheelPickupTiming.ts';
test('supplied pickup clip fits all five heroes without foot sliding or stretched limbs',async t=>{
 const assets=await heroAssets();
 for(const {id} of RIDER_CHOICES){
  const h=new Hero(assets,undefined,id),p={...createPose(),footMode:3,footBlend:1,parkZ:.30};
  h.apply(p);
  const feet=h.legs.map(l=>l.foot.getWorldPosition(new Vector3()));
  let drift=0,error=0,travel=0,errorPhase=0;
  const hip=h.rider.getObjectByName('Hips')!.getWorldPosition(new Vector3());
  for(let n=0;n<=150;n++){
   p.footMountTime=WHEEL_PICKUP_APPROACH+n/150*WHEEL_PICKUP_DURATION;h.apply(p);
   h.legs.forEach((l,i)=>drift=Math.max(drift,l.foot.getWorldPosition(new Vector3()).distanceTo(feet[i])));
   travel=Math.max(travel,h.rider.getObjectByName('Hips')!.getWorldPosition(new Vector3()).distanceTo(hip));
   const timing=wheelPickupTiming(p.footMountTime);
   if(timing.grip>.99){const grip=h.vehicle.getObjectByName('CarryHandle_Grip'),box=new Box3().setFromObject(grip??h.vehicle,true),handle=grip?box.getCenter(new Vector3()):box.getCenter(new Vector3()).setY(box.max.y-.035);const e=h.arms[1].foot.getWorldPosition(new Vector3()).distanceTo(handle);if(e>error){error=e;errorPhase=timing.phase;}}
   for(const b of h.bones)assert([...b.o.position.toArray(),...b.o.quaternion.toArray()].every(Number.isFinite));
  }
  t.diagnostic(JSON.stringify({id,drift,error,travel,errorPhase}));
  assert(drift<.035,id+' feet slide');assert(error<.065,id+' misses handle');assert(travel>.025,id+' capture missing');h.dispose();
 }
});


import {sampleTacticalWalk} from '../../../ride-core/src/tacticalWalk.ts';
import {gaitScale} from '../../../ride-core/src/footAnimation.ts';
test('all five heroes retain the tactical capture within the relaxed swing envelope',async()=>{
 const assets=await heroAssets();
 for(const {id} of RIDER_CHOICES){
  const h=new Hero(assets,undefined,id),p={...createPose(),footMode:2,footBlend:1,bodyPitch:0,speed:1.5,velocityZ:1.5};
  const leg=h.legs[0],length=leg.upper.getWorldPosition(new Vector3()).distanceTo(leg.knee.getWorldPosition(new Vector3()))+leg.knee.getWorldPosition(new Vector3()).distanceTo(leg.foot.getWorldPosition(new Vector3()));
  for(let n=0;n<40;n++){
   const phase=n/40;Object.assign(p,{footCycle:phase*gaitScale(length),footPhase:phase,footTime:n/60});h.apply(p);const reference=sampleTacticalWalk(phase);
   h.arms.forEach((arm,i)=>{
    const upper=arm.knee.getWorldPosition(new Vector3()).sub(arm.upper.getWorldPosition(new Vector3())).normalize(),lower=arm.foot.getWorldPosition(new Vector3()).sub(arm.knee.getWorldPosition(new Vector3())).normalize();
    // The fitted walk enlarges swing and clears short mascot jackets. Keep the
     // captured bend and direction inside a compact envelope instead of requiring
     // the old unfitted vectors bit for bit. Full-cycle fit tests check contacts,
     // counter-swing, wrist alignment, minimum travel and seam continuity.
     const sourceUpper=new Vector3().fromArray(reference,12+i*6),sourceLower=new Vector3().fromArray(reference,15+i*6);
     assert(upper.angleTo(sourceUpper)<.20,id+' upper arm leaves capture envelope');
     assert(Math.abs(upper.angleTo(lower)-sourceUpper.angleTo(sourceLower))<.06,id+' elbow bend loses capture');
    assert(lower.angleTo(sourceLower)<.20,id+' forearm leaves capture envelope');
   });
  }h.dispose();
 }
});

test('backward walking reverses the forward capture on every hero, including hips and feet',async()=>{
 const assets=await heroAssets();
 for(const {id} of RIDER_CHOICES){
  const forward=new Hero(assets,undefined,id),back=new Hero(assets,undefined,id);
  const length=forward.legs.reduce((sum,leg)=>sum+leg.upper.getWorldPosition(new Vector3()).distanceTo(leg.knee.getWorldPosition(new Vector3()))+leg.knee.getWorldPosition(new Vector3()).distanceTo(leg.foot.getWorldPosition(new Vector3())),0)/2;
  const base={...createPose(),footMode:2,footBlend:1,bodyPitch:0};
  for(let n=0;n<40;n++){
   const phase=n/40,reverse=(1-phase)%1;
   forward.apply({...base,speed:1.5,velocityZ:1.5,footCycle:reverse*gaitScale(length),footPhase:reverse,footTime:1});
   back.apply({...base,speed:-1.5,velocityZ:-1.5,footCycle:phase*gaitScale(length),footPhase:phase,footTime:1});
   for(const name of ['Hips','Spine','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand','LeftLeg','RightLeg','LeftFoot','RightFoot']){
    const a=forward.rider.getObjectByName(name)!,b=back.rider.getObjectByName(name)!;
    assert(a.getWorldPosition(new Vector3()).distanceTo(b.getWorldPosition(new Vector3()))<.002,`${id} ${name}: reverse motion differs at ${phase}`);
    assert(a.quaternion.angleTo(b.quaternion)<.015,`${id} ${name}: reverse rotation differs at ${phase}`);
   }
  }forward.dispose();back.dispose();
 }
});
