import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3} from 'three';
import {Hero} from './actors.ts';
import {heroAssets} from './heroTestAssets.ts';
import {createPose} from './controller.ts';
import {RIDER_CHOICES} from './riderChoices.ts';

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
