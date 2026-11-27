import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,stat,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve,dirname,sep} from 'node:path';
import {shareRidingMedia} from './share-riding-media.mjs';
import {sharePublishedRideTextures} from './share-published-ride-textures.mjs';

function model(uri='tree.png',payload=Buffer.alloc(0)){
  const json=Buffer.from(JSON.stringify({asset:{version:'2.0'},buffers:[{byteLength:payload.length}],images:[{uri}]}));
  const padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
  const bytes=Buffer.alloc(28+padded.length+payload.length);bytes.writeUInt32LE(0x46546c67,0);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(padded.length,12);bytes.writeUInt32LE(0x4e4f534a,16);padded.copy(bytes,20);bytes.writeUInt32LE(payload.length,20+padded.length);bytes.writeUInt32LE(0x004e4942,24+padded.length);payload.copy(bytes,28+padded.length);return bytes;
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

test('identical rigged hero variants share canonical models without losing per-game manifests',()=>fixture(async({root,swoop,elmwood})=>{
  const names=['DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01','DS_Armored_Rider_01'];
  const variants=['','mobile-512-20261017/'];
  for(const game of [swoop,elmwood])for(const variant of variants){
    const directory=resolve(game,'exports/rigged-heroes',variant);
    await mkdir(directory,{recursive:true});
    await writeFile(resolve(directory,'tree.png'),'identical rig pixels');
    for(const name of names)await writeFile(resolve(directory,name+'.glb'),model());
    await writeFile(resolve(directory,'manifest.json'),game===swoop?'swoop rig manifest':'elmwood rig manifest');
  }
  const original=await readFile(resolve(elmwood,'exports/rigged-heroes/DS_Man_01.glb'));
  await writeFile(resolve(swoop,'assets/game.js'),
    'film("./exports/polish/detroit-commercial.mp4");load("./exports/rigged-heroes/"+variant+name+".glb")');
  const result=await shareRidingMedia(root);
  assert.equal(result.files,16,'four nature models, film, map, ten rigged hero GLBs');
  assert.deepEqual(await readFile(resolve(elmwood,'exports/rigged-heroes/DS_Man_01.glb')),original);
  assert.match(await readFile(resolve(swoop,'assets/game.js'),'utf8'),/\.\.\/elmwood-explorer\/exports\/rigged-heroes\//);
  for(const variant of variants)for(const name of names){
    assert.equal(await stat(resolve(swoop,'exports/rigged-heroes',variant,name+'.glb')).catch(()=>null),null);
    assert.ok((await stat(resolve(elmwood,'exports/rigged-heroes',variant,name+'.glb'))).isFile());
  }
  assert.equal(await readFile(resolve(swoop,'exports/rigged-heroes/mobile-512-20261017/manifest.json'),'utf8'),'swoop rig manifest');
  assert.equal(await readFile(resolve(elmwood,'exports/rigged-heroes/mobile-512-20261017/manifest.json'),'utf8'),'elmwood rig manifest');
}));

test('rigged sharing fails closed on changed model bytes',()=>fixture(async({root,swoop,elmwood})=>{
  const names=['DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01','DS_Armored_Rider_01'];
  for(const game of [swoop,elmwood])for(const variant of ['','mobile-512-20261017/']){
    const directory=resolve(game,'exports/rigged-heroes',variant);
    await mkdir(directory,{recursive:true});
    await writeFile(resolve(directory,'tree.png'),'same');
    for(const name of names)await writeFile(resolve(directory,name+'.glb'),model());
  }
  await writeFile(resolve(swoop,'exports/rigged-heroes/DS_Man_01.glb'),Buffer.from('not a matching model'));
  await writeFile(resolve(swoop,'assets/game.js'),'load("./exports/rigged-heroes/"+name+".glb")');
  await shareRidingMedia(root);
  assert.ok((await stat(resolve(swoop,'exports/rigged-heroes/DS_Hoodie_Woman_01.glb'))).isFile());
  assert.equal(await readFile(resolve(swoop,'assets/game.js'),'utf8'),'load("./exports/rigged-heroes/"+name+".glb")');
}));

test('sharing rigged models before published texture aliases preserves payloads, URLs and byte accounting',async()=>{
  const results=[];
  for(const publishFirst of [true,false])await fixture(async({root,swoop,elmwood})=>{
    const names=['DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01','DS_Armored_Rider_01'];
    const variants=['','mobile-512-20261017/'];
    const pixels=Buffer.from('identical encoded image bytes');
    const sha256=createHash('sha256').update(pixels).digest('hex');
    const textureName=sha256+'.png';
    const base='https://example.invalid/immutable/arcade/';
    const spec={base,files:[]};
    const originals=new Map();
    for(const game of [swoop,elmwood]){
      const gameName=game===swoop?'swoop-detroit':'elmwood-explorer';
      await mkdir(resolve(game,'shared-textures'),{recursive:true});
      await writeFile(resolve(game,'shared-textures',textureName),pixels);
      spec.files.push({path:gameName+'/shared-textures/'+textureName,sha256});
      for(const variant of variants){
        const directory=resolve(game,'exports/rigged-heroes',variant);
        await mkdir(directory,{recursive:true});
        for(const [index,name] of names.entries()){
          const bytes=model((variant?'../../../':'../../')+'shared-textures/'+textureName,Buffer.alloc(64,index+1));
          await writeFile(resolve(directory,name+'.glb'),bytes);
          if(game===elmwood)originals.set(variant+name+'.glb',bytes);
        }
        await writeFile(resolve(directory,'manifest.json'),JSON.stringify({game:gameName,variant}));
      }
    }
    await writeFile(resolve(swoop,'assets/game.js'),'load("./exports/rigged-heroes/"+variant+name+".glb")');
    async function totalBytes(directory){
      let size=0;
      for(const entry of await readdir(directory,{withFileTypes:true})){
        const path=resolve(directory,entry.name);
        size+=entry.isDirectory()?await totalBytes(path):(await stat(path)).size;
      }
      return size;
    }
    const before=await totalBytes(root);
    let media,published;
    if(publishFirst){published=await sharePublishedRideTextures(root,spec);media=await shareRidingMedia(root);}
    else{media=await shareRidingMedia(root);published=await sharePublishedRideTextures(root,spec);}
    // Publishing first produces unequal absolute URI aliases and blocks exact-model sharing.
    assert.equal(media.files,publishFirst?5:15,'four nature models, unused map, and ten heroes only before publication');
    const expectedPrefix=publishFirst?'./exports/rigged-heroes/':'../elmwood-explorer/exports/rigged-heroes/';
    assert.equal(await readFile(resolve(swoop,'assets/game.js'),'utf8'),'load("'+expectedPrefix+'"+variant+name+".glb")');
    for(const variant of variants)for(const name of names){
      const key=variant+name+'.glb',original=originals.get(key);
      const originalLength=original.readUInt32LE(12);
      const canonical=await readFile(resolve(elmwood,'exports/rigged-heroes',key));
      const length=canonical.readUInt32LE(12);
      const originalJson=JSON.parse(original.toString('utf8',20,20+originalLength));
      const json=JSON.parse(canonical.toString('utf8',20,20+length));
      assert.equal(canonical.readUInt32LE(8),canonical.length);
      assert.deepEqual(canonical.subarray(20+length),original.subarray(20+originalLength),'complete BIN chunk preserved');
      assert.deepEqual(json,{...originalJson,images:[{uri:base+'elmwood-explorer/shared-textures/'+textureName}]});
      const copied=await stat(resolve(swoop,'exports/rigged-heroes',key)).catch(()=>null);
      assert.equal(Boolean(copied),publishFirst);
      // Both normal and mobile loader paths resolve to the retained physical model.
      const requested=new URL(expectedPrefix+key,'https://example.invalid/arcade/swoop-detroit/index.html');
      const local=resolve(root,'lottominded-ultra.io/games/gothtechnology2',requested.pathname.slice(1));
      assert.ok((await stat(local)).isFile());
    }
    for(const game of [swoop,elmwood])for(const variant of variants){
      const manifest=JSON.parse(await readFile(resolve(game,'exports/rigged-heroes',variant,'manifest.json'),'utf8'));
      assert.deepEqual(manifest,{game:game===swoop?'swoop-detroit':'elmwood-explorer',variant});
    }
    const saved=before-await totalBytes(root);
    assert.equal(saved,media.saved+published.saved,'declared saving equals actual regular-file byte difference');
    results.push(saved);
  });
  assert.ok(results[1]>results[0],'correct order recovers the previously missed duplicate model bytes');
});
