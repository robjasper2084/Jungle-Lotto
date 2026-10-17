import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {makeTextureBudget} from './renderBudget.ts';
import {makeTextureBudget as elmwoodBudget} from '../../../elmwood-source/src/detroit/renderBudget.ts';
import {assetConcurrency} from './assetQueue.ts';
import {assetConcurrency as elmwoodConcurrency} from '../../../elmwood-source/src/detroit/assetQueue.ts';

class Bitmap {constructor(public width:number,public height:number){}}
class Canvas {width=0;height=0;getContext(){return {drawImage(){}};}}
function environment(t:{after:(fn:()=>void)=>void}){
 const replacements={ImageBitmap:Bitmap,HTMLCanvasElement:Canvas,document:{createElement:()=>new Canvas()}};
 for(const [key,value]of Object.entries(replacements)){const before=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true});t.after(()=>{if(before)Object.defineProperty(globalThis,key,before);else Reflect.deleteProperty(globalThis,key);});}
}
function asset(image:Bitmap|Canvas){const texture=new T.Texture(image as unknown as TexImageSource),material=new T.MeshBasicMaterial({map:texture}),root=new T.Group();root.add(new T.Mesh(new T.BoxGeometry(),material));return {texture,root};}
for(const [game,makeBudget]of [['Swoop/Royale',makeTextureBudget],['Elmwood',elmwoodBudget]] as const){
 test(game+': mobile retains only budgeted pixels, including across later quality changes',t=>{
  environment(t);const original=new Bitmap(4096,2048),{texture,root}=asset(original),budget=makeBudget({retainOriginals:false});
  budget(root,1024);assert.equal(texture.image.width,1024);assert.equal(texture.image.height,512);assert.notEqual(texture.image,original);
  budget(root,512);assert.equal(texture.image.width,512);budget(root,4096);
  assert.equal(texture.image.width,512,'higher detail must reload instead of retaining the 4096px bitmap');
  const later=makeBudget({retainOriginals:false});later(root,256);assert.equal(texture.image.width,256,'a loader-budgeted model can be resized by the scene budget');
 });
 test(game+': desktop restores original detail and shared texture sources resize together',t=>{
  environment(t);const original=new Bitmap(4096,2048),{texture,root}=asset(original),copy=texture.clone();root.add(new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial({map:copy})));
  const budget=makeBudget();budget(root,512);assert.equal(texture.image,copy.image);assert.equal(copy.image.width,512);assert.ok(copy.version>0);
  budget(root,4096);assert.equal(texture.image,original);assert.equal(copy.image,original);
 });
 test(game+': live canvas labels are never replaced by frozen resized snapshots',t=>{
  environment(t);const canvas=new Canvas();canvas.width=4096;canvas.height=1024;const {texture,root}=asset(canvas);makeBudget({retainOriginals:false})(root,512);assert.equal(texture.image,canvas);
 });
}
test('desktop-mode iPads use the same bounded decode concurrency in both games',t=>{
 const before=Object.getOwnPropertyDescriptor(globalThis,'navigator');t.after(()=>{if(before)Object.defineProperty(globalThis,'navigator',before);else Reflect.deleteProperty(globalThis,'navigator');});
 Object.defineProperty(globalThis,'navigator',{value:{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',maxTouchPoints:5},configurable:true});
 assert.equal(assetConcurrency(),2);assert.equal(elmwoodConcurrency(),2);
 Object.defineProperty(globalThis,'navigator',{value:{userAgent:'Mozilla/5.0 (Windows NT 10.0)',maxTouchPoints:0,deviceMemory:8},configurable:true});
 assert.equal(assetConcurrency(),6);assert.equal(elmwoodConcurrency(),6);
});
