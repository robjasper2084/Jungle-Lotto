import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {optimizePagesImages} from './optimize-pages-images.mjs';
const sharp=createRequire(new URL('../lottominded-ultra.io/games/gothtechnology2/package.json',import.meta.url))('sharp');

test('smaller published PNGs retain dimensions and transparency; protected textures stay unchanged',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pages-image-budget-'));
 try{
  const directory=join(root,'lottominded-ultra.io/assets');await mkdir(directory,{recursive:true});
  const pixels=Buffer.alloc(384*384*4);let state=314159;
  for(let i=0;i<pixels.length;i+=4){for(let c=0;c<3;c++){state=(Math.imul(state,1664525)+1013904223)>>>0;pixels[i+c]=state>>>24;}pixels[i+3]=(i/4)%2?255:0;}
  const input=await sharp(pixels,{raw:{width:384,height:384,channels:4}}).png({compressionLevel:0}).toBuffer();
  assert.ok(input.length>256*1024&&input.length<1024*1024);
  const artwork=join(directory,'smaller-artwork.png'),normal=join(directory,'material-normal.png');
  await writeFile(artwork,input);await writeFile(normal,input);
  const result=await optimizePagesImages(root),output=await readFile(artwork);
  assert.equal(result.count,1);assert.ok(result.saved>0);assert.ok(output.length<input.length);
  const meta=await sharp(output).metadata();assert.equal(meta.width,384);assert.equal(meta.height,384);assert.equal(meta.hasAlpha,true);
  const decoded=await sharp(output).ensureAlpha().raw().toBuffer();
  for(let i=3;i<decoded.length;i+=4)assert.equal(decoded[i],pixels[i]);
  assert.deepEqual(await readFile(normal),input);
 }finally{await rm(root,{recursive:true,force:true});}
});
