import test from 'node:test';import assert from 'node:assert/strict';
import {placeControls,overlaps} from './controlPlacement.ts';
test('portrait lean and smoke remain clear of More and the camera panel',()=>{
 const items=[{x:318,y:496,width:60,height:60},{x:318,y:228,width:60,height:60},{x:300,y:514,width:78,height:44}];
 const fixed=[{x:275,y:224,width:86,height:42},{x:12,y:284,width:125,height:100},{x:10,y:68,width:210,height:210}];
 const result=placeControls(390,844,items,fixed);assert(result.every(Boolean));
 result.forEach((r,i)=>{for(const other of [...fixed,...result.slice(0,i)])assert(!overlaps(r!,other!));});
});
