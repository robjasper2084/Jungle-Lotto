import test from 'node:test';
import assert from 'node:assert/strict';
import {BEACH_DETAIL_CAPS,planBeachDetails} from './beachDetailPlan.ts';
import type {BeachProfile} from './beachProfile.ts';

const points:[[number,number],[number,number],[number,number],[number,number],[number,number]]=[[0,0],[50,0],[50,160],[0,160],[0,0]];
const profile:BeachProfile={id:'test-beach',points,waterside:[{a:points[0],b:points[3]}],back:[{a:points[2],b:points[1]}],minX:0,maxX:50,minZ:0,maxZ:160};
const ground={height:(_x:number,_z:number)=>1.25,land:(_x:number,_z:number)=>true,obstructed:(_x:number,_z:number,_r:number)=>false};
test('mapped shoreline details are deterministic and stay inside beach footprints',()=>{
 const a=planBeachDetails([profile],ground),b=planBeachDetails([profile],ground);
 assert.deepEqual(a,b);
 assert(a.stones.length>0&&a.grasses.length>0,'the beach has scattered stones and margin grasses');
 for(const item of [...a.stones,...a.grasses,...a.driftwood]){
  assert(item.x>0&&item.x<50&&item.z>0&&item.z<160);
  assert(Number.isFinite(item.y)&&item.y<2&&item.sx>0&&item.sy>0&&item.sz>0);
 }
 assert(a.stones.length<=BEACH_DETAIL_CAPS.stones);
 assert(a.grasses.length<=BEACH_DETAIL_CAPS.grasses);
 assert(a.driftwood.length<=BEACH_DETAIL_CAPS.driftwood);
});
test('coastal props never enter roads, buildings or other obstructed land',()=>{
 const none=planBeachDetails([profile],ground,()=>true);
 assert.deepEqual(none,{stones:[],grasses:[],driftwood:[]});
 const blocked=planBeachDetails([profile],{...ground,obstructed:()=>true});
 assert.deepEqual(blocked,{stones:[],grasses:[],driftwood:[]});
 const water=planBeachDetails([profile],{...ground,land:()=>false});
 assert.deepEqual(water,{stones:[],grasses:[],driftwood:[]});
});
test('detail budgets cap even excessively subdivided mapped shorelines',()=>{
 const many=Array.from({length:100},(_,i)=>({...profile,id:'beach-'+i}));
 const plan=planBeachDetails(many,ground);
 assert(plan.stones.length<=BEACH_DETAIL_CAPS.stones);
 assert(plan.grasses.length<=BEACH_DETAIL_CAPS.grasses);
 assert(plan.driftwood.length<=BEACH_DETAIL_CAPS.driftwood);
});
test('unmapped beach footprints have no decorative geometry',()=>{
 assert.deepEqual(planBeachDetails([],ground),{stones:[],grasses:[],driftwood:[]});
});
