import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {boundedSkyProbe,SKY_PROBE_WIDTH,SKY_PROBE_HEIGHT} from './skyProbe.ts';

test('bounded HDR probe preserves linear HDR energy, alpha and its input',()=>{
 const input=new Uint16Array(4*2*4);
 for(let i=0;i<8;i++)input.set([T.DataUtils.toHalfFloat(i+1),T.DataUtils.toHalfFloat(16),T.DataUtils.toHalfFloat(.5),T.DataUtils.toHalfFloat(1)],i*4);
 const original=input.slice(),source=new T.DataTexture(input,4,2,T.RGBAFormat,T.HalfFloatType);
 source.flipY=true;source.colorSpace=T.LinearSRGBColorSpace;const out=boundedSkyProbe(source,2,1);
 const values=Array.from(out.image.data as Uint16Array,T.DataUtils.fromHalfFloat);
 assert.deepEqual(values,[3.5,16,.5,1,5.5,16,.5,1]);assert.deepEqual(input,original);
 assert.equal(out.mapping,T.EquirectangularReflectionMapping);assert.equal(out.type,T.HalfFloatType);
 assert.equal(out.flipY,true);assert.equal(out.colorSpace,T.LinearSRGBColorSpace);out.dispose();source.dispose();
});
test('fallback HDR always matches the live panorama dimensions used by PMREM',()=>{
 const source=new T.DataTexture(new Uint16Array(4*2*4).fill(T.DataUtils.toHalfFloat(1)),4,2,T.RGBAFormat,T.HalfFloatType),out=boundedSkyProbe(source);
 assert.equal(out.image.width,SKY_PROBE_WIDTH);assert.equal(out.image.height,SKY_PROBE_HEIGHT);
 assert.equal(out.image.width/4,128);assert(Array.from(out.image.data as Uint16Array).every(v=>v===T.DataUtils.toHalfFloat(1)));out.dispose();source.dispose();
});
