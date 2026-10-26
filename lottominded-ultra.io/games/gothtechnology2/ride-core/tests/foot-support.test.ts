import test from 'node:test';
import assert from 'node:assert/strict';
import {supportedFootHeight} from '../src/footSupport.ts';
import {createGroundSample} from '../src/terrain.ts';

test('shoe support follows a curb without changing level-ground targets',()=>{
 const foot={x:.12,y:.08,z:.10},hip={x:.12,y:.96,z:0},floor=createGroundSample();
 assert.equal(supportedFootHeight(foot,hip,floor,0,1,1),foot.y);
 floor.height=.18;assert.equal(supportedFootHeight(foot,hip,floor,0,1,1),.26);
 floor.height=-.18;
 const lowered=supportedFootHeight(foot,hip,floor,0,1,1);
 assert(lowered<foot.y,'lower curb can retain contact');
 assert(hip.y-lowered<1.01,'lower shoe must not force a deep pelvis drop');
});
test('foot fitting rejects unsupported banks, walls and other vertical layers',()=>{
 const foot={x:2,y:5.1,z:3},hip={x:2,y:6,z:3};
 for(const ground of [{...createGroundSample(),height:8},{...createGroundSample(),height:5.1,offCourse:true},{...createGroundSample(),height:5.1,normal:{x:1,y:.1,z:0}},{...createGroundSample(),height:NaN}])assert.equal(supportedFootHeight(foot,hip,ground,5,1,1),foot.y);
});
