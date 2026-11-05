import {test} from 'node:test';
import assert from 'node:assert/strict';
import {birdActivity,natureShouldPlay,shoreSoundLevel} from './natureSoundscape.ts';
test('nature audio follows explicit ride/preview and focus, mute, volume gates',()=>{
 assert.equal(natureShouldPlay(true,.6,true,true,true,false),true);
 assert.equal(natureShouldPlay(true,.6,false,true,true,false),false);
 assert.equal(natureShouldPlay(true,.6,false,true,true,true),true);
 for(const preview of [true,false]){
  assert.equal(natureShouldPlay(false,.6,true,true,true,preview),false);
  assert.equal(natureShouldPlay(true,0,true,true,true,preview),false);
  assert.equal(natureShouldPlay(true,NaN,true,true,true,preview),false);
  assert.equal(natureShouldPlay(true,.6,true,false,true,preview),false);
  assert.equal(natureShouldPlay(true,.6,true,true,false,preview),false);
 }
});
test('birdsong is strongest in the morning, quiet at night, and wraps clock',()=>{
 assert.ok(birdActivity(8)>birdActivity(12));assert.ok(birdActivity(12)>birdActivity(22)*10);
 assert.equal(birdActivity(-2),birdActivity(22));assert.equal(birdActivity(32),birdActivity(8));
 for(let hour=0;hour<24;hour+=.1)assert.ok(birdActivity(hour)>=0&&birdActivity(hour)<=1);
 assert.ok(Number.isFinite(birdActivity(NaN)));
});
test('shore water fades by actual shore distance with no sound away from water',()=>{
 const shore:[number,number][][]=[[[0,0],[100,0]]];
 assert.equal(shoreSoundLevel(shore,50,0),1);assert.equal(shoreSoundLevel(shore,50,45),0);
 assert.ok(shoreSoundLevel(shore,50,10)>shoreSoundLevel(shore,50,30));
 assert.equal(shoreSoundLevel([],0,0),0);assert.equal(shoreSoundLevel([[[0,0],[0,0]]],0,0),1);
});
