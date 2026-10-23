import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {Hero} from './actors.ts';
import {heroAssets} from './heroTestAssets.ts';
import {RIDER_CHOICES} from './riderChoices.ts';
import {createPose} from './controller.ts';
import {KIMODO_WHEEL} from '../../../ride-core/src/kimodoWheelData.ts';
import {wheelPickupTiming,WHEEL_PICKUP_TOTAL} from '../../../ride-core/src/wheelPickupTiming.ts';

test('Kimodo retains distinct left/right foot contact timing in both clips',()=>{
 for(const clip of Object.values(KIMODO_WHEEL)){
  assert(clip.samples.every(r=>r.length===24&&r.every(Number.isFinite)));
  assert(clip.samples.some(r=>Math.abs(r[20]-r[22])>.35));
  assert(clip.samples.some(r=>Math.max(r[21],r[23])>.03));
 }
 assert(WHEEL_PICKUP_TOTAL>=1.8&&WHEEL_PICKUP_TOTAL<=2.1,'natural pickup followed by brisk remount');
});
test('Kimodo transitions fit all five hero rigs on either side without stretching bones',async t=>{
 const assets=await heroAssets();
 for(const {id}of RIDER_CHOICES)for(const side of [-1,1]){
  const h=new Hero(assets,undefined,id),lengths=h.bones.map(b=>b.o.position.length());let minAnkle=Infinity,maxStep=0;
  for(const mode of [1,3])for(let n=0;n<=60;n++){
   const time=n/60*WHEEL_PICKUP_TOTAL,mount=wheelPickupTiming(time).mount,blend=mode===1?n/60:1-mount;
   const p={...createPose(),x:side*(mode===1?.68*blend:.30*blend),footMode:mode,footBlend:blend,footMountTime:mode===3?time:0,footTime:time,parkX:0,parkY:0,parkZ:0,parkHeading:0};
   h.apply(p);
   h.bones.forEach((b,i)=>{assert([...b.o.position.toArray(),...b.o.quaternion.toArray()].every(Number.isFinite),id+' invalid pose');if(b.o.name!=='Hips')assert(Math.abs(b.o.position.length()-lengths[i])<1e-5,id+' bone stretched');});
   const feet=h.legs.map(l=>l.foot.getWorldPosition(new Vector3()));minAnkle=Math.min(minAnkle,...feet.map(p=>p.y));maxStep=Math.max(maxStep,Math.abs(feet[0].y-feet[1].y));
  }
  t.diagnostic(JSON.stringify({id,side,minAnkle,maxStep}));assert(minAnkle>-.08,id+' foot under ground');assert(maxStep>.04,id+' feet never step separately');h.dispose();
 }
});
