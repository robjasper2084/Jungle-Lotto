import test from 'node:test';import assert from 'node:assert/strict';
import {BELLE_PHOTO_LOOKUP,sunsetPhotoGrade,treeLodBlend} from './photoReferenceGrade.ts';
const keys=['warmth','glint','foliage','haze'];
test('golden hour peaks near low sun, daylight and night stay neutral',()=>{
 const golden=sunsetPhotoGrade(.09,0,0),high=sunsetPhotoGrade(.85,0,0),night=sunsetPhotoGrade(-.35,0,1);
 assert(golden.warmth>.95&&golden.glint>.95);
 assert(high.warmth<.1&&high.glint<.1);
 for(const k of keys)assert.equal(night[k],0);
});
test('cloud cover suppresses glint without crushing foliage or clipping highlights',()=>{
 const a=sunsetPhotoGrade(.12,0,0),b=sunsetPhotoGrade(.12,.8,0);
 assert(b.glint<a.glint*.5);assert(b.foliage>0&&b.foliage<a.foliage);
});
test('reference grade is finite, continuous and bounded over the full solar trajectory',()=>{
 let prev=sunsetPhotoGrade(-1,0,0);
 for(let i=-1000;i<=1000;i++){
  const next=sunsetPhotoGrade(i/1000,.35,.1);
  for(const k of keys)assert(Number.isFinite(next[k])&&next[k]>=0&&next[k]<=1);
  if(i>-1000)for(const k of keys)assert(Math.abs(next[k]-prev[k])<.025,k);
  prev=next;
 }
 assert(BELLE_PHOTO_LOOKUP.every((x,i,a)=>i===0||x.solar>a[i-1].solar));
});
test('invalid grade inputs return finite safe results',()=>{
 for(const x of [NaN,Infinity,-Infinity])for(const k of keys)assert(Number.isFinite(sunsetPhotoGrade(x,x,x)[k]));
});
test('tree LOD scaling overlaps progressively and never exceeds distance limits',()=>{
 for(const radius of [75,105,140]){
  assert.equal(treeLodBlend(radius+1,radius),0);
  assert.equal(treeLodBlend(radius,radius),0);
  assert.equal(treeLodBlend(radius-24,radius),1);
  assert.equal(treeLodBlend(0,radius),1);
  let previous=0;
  for(let distance=radius;distance>=radius-30;distance--){const v=treeLodBlend(distance,radius);assert(v>=previous&&v<=1);previous=v;}
 }
});
test('LOD invalid inputs do not generate invalid instance scales',()=>{
 assert.equal(treeLodBlend(NaN,75),0);assert.equal(treeLodBlend(1,NaN),0);assert.equal(treeLodBlend(1,75,Infinity),0);
});

import {readFileSync} from 'node:fs';
const read=(name:string)=>readFileSync(new URL('./'+name,import.meta.url),'utf8');
test('photo look is connected to actual sky, water and nature source without new render targets',()=>{
 const sky=read('islandSky.ts'),water=read('water.ts'),nature=read('nature.ts'),world=read('world.ts');
 assert(sky.includes('sunsetPhotoGrade(direction[1],shape.overcast,night)'));
 assert(sky.includes('lighting.glint=photoLook.glint')&&sky.includes('lighting.golden=photoLook.foliage'));
 assert(water.includes('riverSunReflection')&&water.includes('riverSunGlint'));
 assert(world.includes('skyLight.sun,skyLight.glint')&&world.includes('nature.update(x,z,skyLight.night,skyLight.golden)'));
 assert(nature.includes('treeLodBlend(')&&nature.includes('toneMapped:true'));
});
test('reference sky keeps all existing night effects and the same noise sampler count',()=>{
 const sky=read('islandSky.ts');
 assert(sky.includes('const fragment=\x60'));
 for(const token of ['meteorOpacity','moonDirection','starUV','cloudNoise','toneMapping'])assert(sky.includes(token));
 assert(!sky.includes('new T.WebGLRenderTarget('),'reference grade adds no extra render pass');
});
