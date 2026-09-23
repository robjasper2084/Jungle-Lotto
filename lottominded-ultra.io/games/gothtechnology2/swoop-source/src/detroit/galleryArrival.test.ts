import {test} from 'node:test';
import assert from 'node:assert/strict';
import {galleryArrival} from './galleryArrival.ts';
test('Gallery opens only beyond finish, stopped, clear and outside an active attempt',()=>{
 assert.equal(galleryArrival(999,1000,0,0,false,false),false);
 assert.equal(galleryArrival(1001,1000,0,0,false,false),true);
 for(const state of [[1001,1000,5,0,false,false],[1001,1000,0,5,false,false],[1001,1000,0,0,true,false],[1001,1000,0,0,false,true],[NaN,1000,0,0,false,false]] as const)assert.equal(galleryArrival(...state),false);
});
