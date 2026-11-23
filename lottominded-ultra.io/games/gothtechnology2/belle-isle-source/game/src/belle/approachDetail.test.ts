import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createApproachDetail} from './approachDetail.ts';

const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));

test('preparing at spawn shares the in-flight load and preserves distance visibility on approach',async()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera();
 let runs=0;const display=new T.Group();
 const detail=createApproachDetail(scene,[[1000,0]],100,async stage=>{
  runs++;stage.add(display);
  return {update(x:number){display.visible=x>900;}};
 });
 const ready=detail.prepareAt(0,0,camera);
 assert.equal(detail.prepareAt(0,0,camera),ready);await ready;
 assert.equal(display.visible,false);assert.equal(scene.children.length,1);
 detail.update(990,0,camera);await detail.prepareAt(990,0,camera);
 assert.equal(display.visible,true);assert.equal(runs,1);
});

test('optional scenery is absent on spawn and loads once before the player can see it',async()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),poses:number[][]=[];
 let finish!:(value:{update:(x:number,z:number)=>void})=>void,started=0;
 const gated=new Promise<{update:(x:number,z:number)=>void}>(resolve=>finish=resolve);
 const detail=createApproachDetail(scene,[[2000,1000]],900,async stage=>{
  started++;stage.add(new T.Group());return gated;
 });
 detail.update(0,0,camera,true);
 assert.equal(started,0);assert.equal(scene.children.length,0);
 detail.update(1500,1000,camera,false);
 assert.equal(started,0);
 detail.update(1500,1000,camera,true);await flush();
 assert.equal(started,1);assert.equal(scene.children.length,0);
 detail.update(1600,1000,camera,true);
 assert.equal(started,1);
 finish({update:(x,z)=>poses.push([x,z])});await flush();
 assert.equal(detail.ready,true);assert.equal(detail.stats.ready,true);
 assert.equal(detail.stats.attempts,1);assert.equal(scene.children.length,1);
 detail.update(2100,1030,camera,true);
 assert.deepEqual(poses,[[1500,1000],[2100,1030]]);
});

test('failed optional scenery does not spin retry requests while the player stays nearby',async()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera();let calls=0;
 const detail=createApproachDetail(scene,[[5,5]],50,async()=>{
  calls++;throw new Error('missing optional art');
 });
 const warn=console.warn;console.warn=()=>{};
 try{
  detail.update(5,5,camera);await flush();assert.equal(detail.stats.failures,1);
  for(let i=0;i<12;i++)detail.update(5,5,camera);
  assert.equal(calls,1);
  detail.update(500,500,camera);
  detail.update(5,5,camera);await flush();
  assert.equal(calls,2);assert.equal(scene.children.length,0);
 }finally{console.warn=warn;}
});
