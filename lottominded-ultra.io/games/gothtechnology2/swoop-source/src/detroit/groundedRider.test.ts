import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {Hero} from './actors.ts';
import {heroAssets} from './heroTestAssets.ts';
import {createPose} from './controller.ts';
import {RIDER_CHOICES} from './riderChoices.ts';
import type {TerrainSampler} from './terrain.ts';

test('on-foot body and parked wheel keep ground contact away from the world origin',async()=>{
 const data=await heroAssets();
 for(const {id} of RIDER_CHOICES){
  const hero=new Hero(data,undefined,id);
  for(const headingY of [0,1.4,-2.1])for(const y of [0,5.5,7,-3]){
   const p={...createPose(),x:1600,y,z:75,headingY,parkX:1599.32,parkY:y,parkZ:75,parkHeading:headingY,footMode:2,footBlend:1};
   hero.apply(p);
   const bounds=new Box3().setFromObject(hero.rider,true),wheel=new Box3().setFromObject(hero.vehicle,true);
   assert(bounds.min.y>y-.09,id+' feet below floor');
   assert(bounds.min.y<y+.12,id+' feet floating');
   assert(wheel.min.y>y-.06&&wheel.min.y<y+.06,id+' parked wheel loses contact');
  }hero.dispose();
 }
});

test('each hero plants a raised curb foot without pulling the standing pelvis down',async()=>{
 const data=await heroAssets();
 for(const {id}of RIDER_CHOICES){
  let curb=0;
  const terrain:TerrainSampler={sampleGround(x,_z,out){return Object.assign(out,{height:x>0?curb:0,normal:{x:0,y:1,z:0},offCourse:false,surface:'pavement'});},raycast(){return null;},raycastObstacle(){return null;}};
  const hero=new Hero(data,terrain,id,'kimodo'),pose={...createPose(),footMode:2,footBlend:1};
  hero.apply(pose);const feet=hero.legs.map(l=>l.foot.getWorldPosition(new Vector3())),hip=hero.hips!.getWorldPosition(new Vector3());
  curb=.16*hero.motionScale;hero.apply(pose);
  for(const [i,leg]of hero.legs.entries()){
   const now=leg.foot.getWorldPosition(new Vector3()),expected=feet[i].x>0?curb:0;
   assert(Math.abs(now.y-feet[i].y-expected)<.025*hero.motionScale,id+' shoe should follow its own contact plane');
  }
  assert(Math.abs(hero.hips!.getWorldPosition(new Vector3()).y-hip.y)<.025*hero.motionScale,id+' curb support must preserve upright posture');
  hero.dispose();
 }
});
