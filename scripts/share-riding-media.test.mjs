import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname,sep} from 'node:path';
import {shareRidingMedia} from './share-riding-media.mjs';

function model(){
  const json=Buffer.from(JSON.stringify({asset:{version:'2.0'},buffers:[{byteLength:0}],images:[{uri:'tree.png'}]}));
  const padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
  const bytes=Buffer.alloc(28+padded.length);bytes.writeUInt32LE(0x46546c67,0);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(padded.length,12);bytes.writeUInt32LE(0x4e4f534a,16);padded.copy(bytes,20);bytes.writeUInt32LE(0x004e4942,24+padded.length);return bytes;
}
async function fixture(run){
  const root=await mkdtemp(resolve(tmpdir(),'riding-media-'));
  const pack=resolve(root,'lottominded-ultra.io/games/gothtechnology2'),swoop=resolve(pack,'arcade/swoop-detroit'),elmwood=resolve(pack,'arcade/elmwood-explorer');
  async function put(path,data){await mkdir(dirname(path),{recursive:true});await writeFile(path,data);}
  try{
    for(const game of [swoop,elmwood]){
      for(const name of ['cherry-blossom-1','cherry-blossom-2','american-robin','cherry-petal'])await put(resolve(game,'exports/nature',name+'.glb'),model());
      await put(resolve(game,'exports/nature/tree.png'),'identical tree pixels');
      await put(resolve(game,'love-tag/elmwood-explorer.json.gz'),Buffer.alloc(500,7));
    }
    await put(resolve(swoop,'exports/polish/detroit-commercial.mp4'),Buffer.alloc(500,1));
    await put(resolve(pack,'assets/commercials/detroit-commercial-01.mp4'),Buffer.alloc(500,1));
    await put(resolve(swoop,'assets/game.js'),'film("./exports/polish/detroit-commercial.mp4")');
    await put(resolve(elmwood,'assets/game.js'),'load("./exports/nature/"+id+".glb")');
    await run({root,pack,swoop,elmwood});
  }finally{
    assert.equal(dirname(root),resolve(tmpdir()));assert.ok(root.startsWith(resolve(tmpdir())+sep+'riding-media-'));
    await rm(root,{recursive:true,force:true});
  }
}
test('matching media uses canonical files and preserves their exact bytes',()=>fixture(async({root,pack,swoop,elmwood})=>{
  const film=await readFile(resolve(pack,'assets/commercials/detroit-commercial-01.mp4'));
  const result=await shareRidingMedia(root);assert.equal(result.files,6);assert.ok(result.saved>0);
  assert.deepEqual(await readFile(resolve(pack,'assets/commercials/detroit-commercial-01.mp4')),film);
  assert.match(await readFile(resolve(elmwood,'assets/game.js'),'utf8'),/\.\.\/swoop-detroit\/exports\/nature\//);
  assert.match(await readFile(resolve(swoop,'assets/game.js'),'utf8'),/\.\.\/\.\.\/assets\/commercials\/detroit-commercial-01.mp4/);
  assert.equal(await stat(resolve(elmwood,'exports/nature/cherry-blossom-1.glb')).catch(()=>null),null);
  assert.ok((await stat(resolve(elmwood,'love-tag/elmwood-explorer.json.gz'))).isFile());
}));
test('equal geometry with different external textures retains independent models',()=>fixture(async({root,elmwood})=>{
  await writeFile(resolve(elmwood,'exports/nature/tree.png'),'different pixels');
  const result=await shareRidingMedia(root);assert.equal(result.files,2);
  assert.ok((await stat(resolve(elmwood,'exports/nature/cherry-blossom-1.glb'))).isFile());
  assert.equal(await readFile(resolve(elmwood,'assets/game.js'),'utf8'),'load("./exports/nature/"+id+".glb")');
}));
test('missing loader matches and referenced maps are preserved',()=>fixture(async({root,swoop,elmwood})=>{
  await writeFile(resolve(elmwood,'assets/game.js'),'loadOtherAssets()');
  await writeFile(resolve(swoop,'assets/game.js'),'fetch("./love-tag/elmwood-explorer.json.gz")');
  assert.equal((await shareRidingMedia(root)).files,0);
  assert.ok((await stat(resolve(swoop,'love-tag/elmwood-explorer.json.gz'))).isFile());
  assert.ok((await stat(resolve(swoop,'exports/polish/detroit-commercial.mp4'))).isFile());
}));
