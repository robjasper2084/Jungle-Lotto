import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {shareRideVehicles} from './share-ride-vehicles.mjs';

async function fixture(run){
  const root=await mkdtemp(resolve(tmpdir(),'ride-vehicle-sharing-'));
  const arcade=resolve(root,'lottominded-ultra.io/games/gothtechnology2/arcade');
  const source=resolve(arcade,'swoop-detroit/exports/electric'),canonical=resolve(arcade,'elmwood-explorer/exports/electric'),assets=resolve(arcade,'swoop-detroit/assets');
  try{
    await Promise.all([source,canonical,assets].map(p=>mkdir(p,{recursive:true})));
    for(const name of ['Ebike_talaria','Ebike_ultra','Ebike_sr','Ebike_varg','Euc_city','Euc_tour','Euc_trail','Euc_speed'])await Promise.all([source,canonical].map(p=>writeFile(resolve(p,name+'.glb'),Buffer.from(name.repeat(100)))));
    const loader=resolve(assets,'game.js');await writeFile(loader,'load("./exports/electric/"+id+".glb")');
    await run({root,source,canonical,loader});
  }finally{
    assert.ok(root.startsWith(resolve(tmpdir())+'\\ride-vehicle-sharing-')||root.startsWith(resolve(tmpdir())+'/ride-vehicle-sharing-'));
    await rm(root,{recursive:true,force:true});
  }
}
test('identical vehicles retain canonical bytes and rewrite the published loader',async()=>fixture(async({root,source,canonical,loader})=>{
  const original=await readFile(resolve(canonical,'Euc_speed.glb'));
  const result=await shareRideVehicles(root);assert.equal(result.models,8);assert.ok(result.saved>0);
  assert.deepEqual(await readFile(resolve(canonical,'Euc_speed.glb')),original);
  assert.equal(await stat(resolve(source,'Euc_speed.glb')).catch(()=>null),null);
  assert.match(await readFile(loader,'utf8'),/\.\.\/elmwood-explorer\/exports\/electric\//);
}));
test('a mismatch fails before any loader edit or model deletion',async()=>fixture(async({root,source,canonical,loader})=>{
  await writeFile(resolve(canonical,'Euc_speed.glb'),'different model');
  await assert.rejects(shareRideVehicles(root),/differs between games/);
  assert.ok((await stat(resolve(source,'Ebike_talaria.glb'))).isFile());
  assert.equal(await readFile(loader,'utf8'),'load("./exports/electric/"+id+".glb")');
}));

function imageModel(uri){
 const json=Buffer.from(JSON.stringify({asset:{version:'2.0'},buffers:[{byteLength:16}],bufferViews:[{buffer:0,byteOffset:0,byteLength:16}],images:[{uri,mimeType:'image/png'}]}));
 const padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);const glb=Buffer.alloc(28+padded.length+16);glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(padded.length,12);glb.writeUInt32LE(0x4e4f534a,16);padded.copy(glb,20);glb.writeUInt32LE(16,20+padded.length);glb.writeUInt32LE(0x004e4942,24+padded.length);return glb;
}

test('different relative texture names share only after actual pixels and geometry match',async()=>fixture(async({root,source,canonical})=>{
 await writeFile(resolve(source,'own.png'),'same original pixels');await writeFile(resolve(canonical,'shared.png'),'same original pixels');
 await writeFile(resolve(source,'Euc_speed.glb'),imageModel('own.png'));const expected=imageModel('shared.png');await writeFile(resolve(canonical,'Euc_speed.glb'),expected);
 assert.equal((await shareRideVehicles(root)).models,8);assert.deepEqual(await readFile(resolve(canonical,'Euc_speed.glb')),expected);
}));

test('different external pixels cannot be mistaken for the same vehicle',async()=>fixture(async({root,source,canonical,loader})=>{
 await writeFile(resolve(source,'own.png'),'one skin');await writeFile(resolve(canonical,'shared.png'),'different skin');
 await writeFile(resolve(source,'Euc_speed.glb'),imageModel('own.png'));await writeFile(resolve(canonical,'Euc_speed.glb'),imageModel('shared.png'));
 await assert.rejects(shareRideVehicles(root),/differs between games/);assert.ok((await stat(resolve(source,'Euc_speed.glb'))).isFile());assert.equal(await readFile(loader,'utf8'),'load("./exports/electric/"+id+".glb")');
}));
