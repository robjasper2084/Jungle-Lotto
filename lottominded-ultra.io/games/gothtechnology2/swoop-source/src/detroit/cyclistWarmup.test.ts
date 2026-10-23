import test from 'node:test';
import assert from 'node:assert/strict';
import {CommunityView} from '../../../ride-core/src/cyclingView.ts';
import {CommunityRide,LaneRoute} from '../../../ride-core/src/communityRide.ts';
import {rigModel} from './heroTestAssets.ts';
import {assetPath} from './testAssets.ts';
import type {TerrainSampler} from '../../../ride-core/src/terrain.ts';

test('warm-up fits only nearby cyclists, preserves the simulation and reuses fitted rigs',async()=>{
 const flat:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});},raycast:()=>null,raycastObstacle:()=>null};
 const ride=new CommunityRide(new LaneRoute([{x:0,z:0,width:5},{x:0,z:1000,width:5}]),flat,10,10);
 const assets=new Map(await Promise.all(['DS_Bicycle_01','DS_Cyclist_01'].map(async id=>[id,await rigModel(assetPath(`exports/glb/${id}/${id}_LOD1.glb`))] as const)));
 const view=new CommunityView(ride,assets),observer={x:ride.riders[0].x,z:ride.riders[0].z};
 ride.riders[9].z=1000;
 const before=JSON.stringify(ride.riders);
 try{
  await view.warm(observer);const models=view.views.slice();
  assert.equal(JSON.stringify(ride.riders),before);assert.equal(models.filter(Boolean).length,9);assert.equal(models[9],undefined);
  await view.warm(observer);view.update(true,0,observer);
  assert.deepEqual(view.views,models);assert.equal(JSON.stringify(ride.riders),before);
 }finally{view.dispose();}
});
