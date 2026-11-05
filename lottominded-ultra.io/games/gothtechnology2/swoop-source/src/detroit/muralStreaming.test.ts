import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {buildCutMurals} from './cutMurals.ts';import {SpatialAssetStream} from './spatialAssetStream.ts';import {cutPoint} from './world.ts';
import type {SceneryWorld} from './sceneryWorld.ts';
import {makeTextureBudget} from './renderBudget.ts';
test('bridge murals load locally, dispose on departure and reload without adding colliders',async()=>{
 const original=T.TextureLoader.prototype.loadAsync,raf=globalThis.requestAnimationFrame;let fetched=0,disposed=0;
 T.TextureLoader.prototype.loadAsync=async()=>{fetched++;const map=new T.Texture();map.addEventListener('dispose',()=>disposed++);return map;};
 globalThis.requestAnimationFrame=callback=>{setImmediate(()=>callback(0));return 0;};
 try{
  const groups=new Map<string,T.Group>();const groupAt=(x:number,z:number)=>{const key=Math.floor(x/100)+','+Math.floor(z/100);if(!groups.has(key))groups.set(key,new T.Group());return groups.get(key)!;};
  let colliders=0;const world={solids:[],addBox:()=>{colliders++;}} as unknown as SceneryWorld,stream=new SpatialAssetStream(1);
  const art=await buildCutMurals(world,groupAt,stream),initialColliders=colliders;
  assert.equal(fetched,0);assert.equal(art.walls,13);assert.equal(initialColliders,13);
  const adelaide=cutPoint(1864);await stream.warm([adelaide],120);
  assert(fetched>0&&fetched<5,'one bridge should not fetch every mural');assert.equal(art.loaded,fetched);
  const loaded=fetched;stream.update([{x:100000,z:100000}],120);assert.equal(disposed,loaded);assert.equal(art.loaded,0);
  await stream.warm([adelaide],120);assert.equal(fetched,loaded*2);assert.equal(colliders,initialColliders);
 }finally{T.TextureLoader.prototype.loadAsync=original;globalThis.requestAnimationFrame=raf;}
});

test('streamed art is texture-budgeted before yielding its first display frame',async t=>{
 class Bitmap {constructor(public width:number,public height:number){}}
 class Canvas {width=0;height=0;getContext(){return {drawImage(){}};}}
 for(const [key,value]of Object.entries({ImageBitmap:Bitmap,HTMLCanvasElement:Canvas,document:{createElement:()=>new Canvas()}})){
  const before=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true});
  t.after(()=>{if(before)Object.defineProperty(globalThis,key,before);else Reflect.deleteProperty(globalThis,key);});
 }
 const original=T.TextureLoader.prototype.loadAsync,raf=globalThis.requestAnimationFrame,maps:T.Texture[]=[];
 let prepared=0,displayFrames=0;const budget=makeTextureBudget({retainOriginals:false});
 T.TextureLoader.prototype.loadAsync=async()=>{const map=new T.Texture(new Bitmap(4096,2048) as unknown as TexImageSource);maps.push(map);return map;};
 globalThis.requestAnimationFrame=callback=>{
  assert.equal(prepared,maps.length,'the renderer never sees an unprepared mural');
  for(const map of maps){assert.equal(map.image.width,512);assert.equal(map.image.height,256);}
  displayFrames++;setImmediate(()=>callback(0));return 0;
 };
 try{
  const root=new T.Group(),stream=new SpatialAssetStream(1),world={solids:[],addBox(){}} as unknown as SceneryWorld;
  await buildCutMurals(world,()=>root,stream,mesh=>{assert(mesh instanceof T.Mesh);budget(mesh,512);prepared++;});
  await stream.warm([cutPoint(1864)],120);assert(prepared>0);assert.equal(displayFrames,prepared);
  stream.update([{x:100000,z:100000}],120);
 }finally{T.TextureLoader.prototype.loadAsync=original;globalThis.requestAnimationFrame=raf;}
});
