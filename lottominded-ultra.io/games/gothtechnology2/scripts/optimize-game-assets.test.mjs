import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,link,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {resolve,dirname} from 'node:path';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {optimizeGameAssets} from './optimize-game-assets.mjs';
function model(image){
 const vertices=Buffer.alloc(12288);for(let i=0;i<1024;i++){vertices.writeFloatLE(i%16,i*12);vertices.writeFloatLE(0,i*12+4);vertices.writeFloatLE(i>>4,i*12+8);}
 const imagePad=Buffer.alloc(Math.ceil(image.length/4)*4);image.copy(imagePad);
 const j={asset:{version:'2.0'},buffers:[{byteLength:imagePad.length+vertices.length}],bufferViews:[{buffer:0,byteLength:image.length},{buffer:0,byteOffset:imagePad.length,byteLength:vertices.length,target:34962}],images:[{bufferView:0,mimeType:'image/png'}],textures:[{source:0}],accessors:[{bufferView:1,componentType:5126,count:1024,type:'VEC3'}],nodes:[{name:'Hips',children:[1]},{name:'Grip'}],skins:[{joints:[0,1]}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],animations:[{name:'Walk',channels:[],samplers:[]}]};
 const raw=Buffer.from(JSON.stringify(j)),json=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(json);const b=Buffer.alloc(28+json.length+imagePad.length+vertices.length);
 [0x46546c67,2,b.length,json.length,0x4e4f534a].forEach((v,i)=>b.writeUInt32LE(v,i*4));json.copy(b,20);b.writeUInt32LE(imagePad.length+vertices.length,20+json.length);b.writeUInt32LE(0x004e4942,24+json.length);imagePad.copy(b,28+json.length);vertices.copy(b,28+json.length+imagePad.length);return b;
}
test('standalone optimization retains originals, pixels and rigs and is safe to repeat',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'game-assets-')),game=resolve(root,'swoop-detroit');
 try{await mkdir(game);const png=await sharp({create:{width:512,height:512,channels:4,background:{r:50,g:70,b:120,alpha:.5}}}).png().toBuffer(),bytes=model(png),original=resolve(root,'authoring.glb');await writeFile(original,bytes);await link(original,resolve(game,'hero.glb'));await writeFile(resolve(game,'other.glb'),bytes);
 const result=await optimizeGameAssets(game);assert(result.savedBytes>0);assert.deepEqual(await readFile(original),bytes,'hard-linked source is unchanged');
 const out=await readFile(resolve(game,'hero.glb')),j=JSON.parse(out.toString('utf8',20,20+out.readUInt32LE(12))),before=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 for(const field of ['nodes','skins','meshes','animations'])assert.deepEqual(j[field],before[field]);
 const picture=await readFile(resolve(game,j.images[0].uri));assert.deepEqual(await sharp(picture).ensureAlpha().raw().toBuffer(),await sharp(png).ensureAlpha().raw().toBuffer());
 assert(j.extensionsRequired.includes('EXT_meshopt_compression'));assert(!j.images[0].uri.includes('..'));
 const again=await optimizeGameAssets(game);assert.equal(again.savedBytes,0);assert.deepEqual(await readFile(resolve(game,'hero.glb')),out);
 }finally{assert.equal(dirname(root),resolve(tmpdir()));await rm(root,{recursive:true,force:true});}
});

test('keeps literal image references in generated code unchanged',async()=>{
 const root=await mkdtemp(resolve(tmpdir(),'game-assets-')),game=resolve(root,'swoop-detroit');
 try{
  await mkdir(game);
  const png=await sharp({create:{width:512,height:512,channels:4,background:'#123456'}}).png().toBuffer();
  const name=createHash('sha256').update(png).digest('hex')+'.png';
  const bundle='export const image="./shared-textures/'+name+'";';
  await writeFile(resolve(game,'entry-hashed.js'),bundle);
  await writeFile(resolve(game,'hero.glb'),model(png));
  const result=await optimizeGameAssets(game);
  assert.equal(result.textures.files,0);
  assert.equal(await readFile(resolve(game,'entry-hashed.js'),'utf8'),bundle);
  assert.deepEqual(await readFile(resolve(game,'shared-textures',name)),png);
 }finally{assert.equal(dirname(root),resolve(tmpdir()));await rm(root,{recursive:true,force:true});}
});
