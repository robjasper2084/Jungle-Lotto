import test from 'node:test';
import assert from 'node:assert/strict';
import {SplitRaceView} from './splitRaceView.ts';
import {FollowCamera} from './followCamera.ts';
import {createPose} from './controller.ts';
import {createGroundSample,type TerrainSampler} from './terrain.ts';

const flat:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,createGroundSample());},raycast:()=>null,raycastObstacle:()=>null};

test('guest cameras follow network poses for every hero without running host physics',()=>{
 const ids=['DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01','DS_Armored_Rider_01'];
 const riders=ids.map((id,i)=>({id,pose:Object.assign(createPose(),{x:i*12,speed:9,velocityZ:9})}));
 const follows=riders.map(r=>{const f=new FollowCamera(flat);f.reset(r.pose);return f;});
 // Exercise the actual guest view method without a renderer/DOM constructor.
 const guest=Object.create(SplitRaceView.prototype) as SplitRaceView;
 Object.assign(guest,{simulation:{riders},follows});
 for(let frame=0;frame<180;frame++){
  for(const r of riders)r.pose.z+=9/60;
  guest.afterRemoteFrame(1/60);
 }
 for(let i=0;i<riders.length;i++){
  const r=riders[i],f=follows[i];
  assert.ok(f.eye.z>18,r.id+' camera must leave its spawn point');
  assert.ok(Math.hypot(f.target.x-r.pose.x,f.target.z-r.pose.z)<2,r.id+' remains framed');
  assert.ok(Math.abs(f.eye.x-r.pose.x)<.01,'camera stays with its assigned rider');
 }
});

test('guest camera stays close at low frame rates and follows a recovery immediately',()=>{
 const pose=Object.assign(createPose(),{speed:21.8,velocityZ:21.8});
 const follow=new FollowCamera(flat);follow.reset(pose);
 const guest=Object.create(SplitRaceView.prototype) as SplitRaceView;
 Object.assign(guest,{simulation:{riders:[{pose}]},follows:[follow]});
 guest.afterRemoteFrame(1/25);
 for(let frame=0;frame<150;frame++){
  pose.z+=21.8/25;guest.afterRemoteFrame(1/25);
  assert.ok(pose.z-follow.eye.z<6.8,'network smoothing must not add another camera-length of lag');
 }
 pose.x+=120;pose.z-=180;pose.speed=0;pose.velocityZ=0;
 guest.afterRemoteFrame(1/25);
 assert.ok(Math.hypot(follow.target.x-pose.x,follow.target.z-pose.z)<.1,'recovery must reframe the rider immediately');
 assert.ok(Math.hypot(follow.eye.x-pose.x,follow.eye.z-pose.z)<7,'camera cannot remain at the pre-recovery position');
});
