import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CommunityRide,LaneRoute} from '@digital-static/ridecore/cycling';
import {DetroitWorld} from './world.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {routePosition} from './districtView.ts';
import {createGroundSample} from './terrain.ts';
test('Cut community route completes on actual mapped pavement and obstacle physics',async()=>{
 const map=await new DetroitWorld().init(),terrain=new GeoTerrain(map),route=new LaneRoute(Array.from({length:31},(_,i)=>({...routePosition(850+i*5),width:5}))),ride=new CommunityRide(route,terrain,3.3,4),sample=createGroundSample();
 ride.join(route.at(0,-.85));ride.continue();let s=0;
 for(let i=0;i<14000&&ride.stage!=='complete';i++){s=Math.min(route.length-1,s+3.3/60);const p=route.at(s,-.85);ride.step(1/60,{...p,y:terrain.sampleGround(p.x,p.z,sample).height,speed:3.3});if(ride.stage==='regroup')ride.continue();}
 assert.equal(ride.stage,'complete',JSON.stringify(ride.riders));assert.equal(ride.completed,true);map.physics.free();
});
