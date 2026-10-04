import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { shareModelTextures, shareRideTextures } from './share-ride-textures.mjs';
import {compressRideModel} from './compress-ride-models.mjs';
import {createRequire} from 'node:module';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { gothtechnologyPath, requiredStoreFiles, readGothtechnologyBuild, copyGothtechnologyBuild, shareShadowOpsAssets } from './gothtechnology-pages.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'goth-pages-'));
  t.after(async () => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith('goth-pages-'));
    await rm(root, {recursive:true, force:true});
  });
  return root;
}
async function write(root, path, content='fixture') {
  const target = join(root, path);
  await mkdir(dirname(target), {recursive:true});
  await writeFile(target, content);
}

function texturedModel(texture) {
  const mesh = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' },
    buffers: [{ byteLength: texture.length + mesh.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: texture.length }, { buffer: 0, byteOffset: texture.length, byteLength: mesh.length }],
    images: [{ bufferView: 0, mimeType: 'image/png' }],
    accessors: [{ bufferView: 1, componentType: 5121, count: 8, type: 'SCALAR' }],
  }));
  const paddedJson = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32);
  json.copy(paddedJson);
  const output = Buffer.alloc(28 + paddedJson.length + texture.length + mesh.length);
  [0x46546c67, 2, output.length, paddedJson.length, 0x4e4f534a].forEach((v, i) => output.writeUInt32LE(v, i * 4));
  paddedJson.copy(output, 20);
  output.writeUInt32LE(texture.length + mesh.length, 20 + paddedJson.length);
  output.writeUInt32LE(0x004e4942, 24 + paddedJson.length);
  Buffer.concat([texture, mesh]).copy(output, 28 + paddedJson.length);
  return output;
}

test('Pages shares identical ride textures and preserves mesh bytes and model-relative URLs', async t => {
  const root = await fixture(t), arcade = gothtechnologyPath + '/arcade/';
  const texture = Buffer.alloc(1024, 71), input = texturedModel(texture);
  const canonical = arcade + 'elmwood-explorer/shared-textures/dog.png';
  const model = arcade + 'swoop-detroit/exports/glb/dog/dog.glb';
  await write(root, canonical, texture);
  await write(root, model, input);
  const result = await shareRideTextures(root);
  assert.equal(result.models, 1);
  const output = await readFile(join(root, model));
  assert.equal(result.saved, input.length - output.length);
  const size = output.readUInt32LE(12), gltf = JSON.parse(output.toString('utf8', 20, 20 + size));
  assert.equal(gltf.accessors[0].bufferView, 0);
  assert.equal(gltf.images[0].bufferView, undefined);
  assert.equal(resolve(dirname(join(root, model)), gltf.images[0].uri), resolve(root, canonical));
  assert.deepEqual(output.subarray(28 + size), Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]));
  assert.deepEqual(await readFile(join(root, canonical)), texture);
});

test('ride sharing stores repeated embedded textures once without changing pixels', async t => {
  const root = await fixture(t), texture = Buffer.alloc(4096, 71);
  const base = 'lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit/exports/glb/';
  const input = texturedModel(texture);
  await write(root, base + 'first.glb', input);
  await write(root, base + 'second.glb', input);
  const result = await shareRideTextures(root);
  let total = 0, sharedPath;
  for (const name of ['first.glb', 'second.glb']) {
    const path = join(root, base, name), output = await readFile(path);
    total += output.length;
    const n = output.readUInt32LE(12), gltf = JSON.parse(output.toString('utf8', 20, 20 + n));
    const imagePath = resolve(dirname(path), gltf.images[0].uri);
    assert.deepEqual(await readFile(imagePath), texture);
    if (sharedPath) assert.equal(imagePath, sharedPath);
    sharedPath = imagePath;
  }
  assert.equal(result.models, 2);
  assert.equal(result.saved, input.length * 2 - total - texture.length);
  assert.ok(result.saved > 0);
});

test('Ride sharing leaves unmatched textures intact', () => {
  const texture = Buffer.alloc(1024, 71), input = texturedModel(texture);
  assert.equal(shareModelTextures(input, '/game/dog.glb', new Map()), input);
  const hash = createHash('sha256').update(texture).digest('hex');
  assert.equal(shareModelTextures(input, '/game/dog.glb', new Map([[hash, { path: '/other.jpg', mime: 'image/jpeg' }]])), input);
});

test('ride compression preserves exact accessor bytes, index order, image payload and metadata',async()=>{
 const require=createRequire(new URL('../lottominded-ultra.io/games/gothtechnology2/package.json',import.meta.url));
 const {MeshoptDecoder}=require('meshoptimizer');await MeshoptDecoder.ready;
 const texture=Buffer.alloc(4096,71),input=texturedModel(texture);
 // Enlarge the geometry buffer enough for actual attribute compression.
 const n=input.readUInt32LE(12),gltf=JSON.parse(input.toString('utf8',20,20+n));
 const geometry=Buffer.alloc(12288);for(let i=0;i<1024;i++){geometry.writeFloatLE(i%16,i*12);geometry.writeFloatLE(0,i*12+4);geometry.writeFloatLE(Math.floor(i/16),i*12+8);}
 gltf.buffers[0].byteLength=texture.length+geometry.length;
 gltf.bufferViews[1].byteLength=geometry.length;gltf.bufferViews[1].target=34962;
 gltf.accessors[0]={bufferView:1,componentType:5126,count:1024,type:'VEC3'};
 gltf.extras={identity:'keep-me'};
 const json=Buffer.from(JSON.stringify(gltf)),pad=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(pad);
 const full=Buffer.alloc(28+pad.length+texture.length+geometry.length);
 [0x46546c67,2,full.length,pad.length,0x4e4f534a].forEach((v,i)=>full.writeUInt32LE(v,i*4));pad.copy(full,20);
 full.writeUInt32LE(texture.length+geometry.length,20+pad.length);full.writeUInt32LE(0x004e4942,24+pad.length);texture.copy(full,28+pad.length);geometry.copy(full,28+pad.length+texture.length);
 const output=await compressRideModel(full);assert.ok(output.length<full.length);
 const size=output.readUInt32LE(12),result=JSON.parse(output.toString('utf8',20,20+size)),binary=output.subarray(28+size);
 assert.deepEqual(result.accessors,gltf.accessors);assert.deepEqual(result.images,gltf.images);assert.deepEqual(result.extras,gltf.extras);
 const image=result.bufferViews[0];assert.deepEqual(binary.subarray(image.byteOffset,image.byteOffset+image.byteLength),texture);
 const ext=result.bufferViews[1].extensions.EXT_meshopt_compression,decoded=new Uint8Array(geometry.length);
 MeshoptDecoder.decodeGltfBuffer(decoded,ext.count,ext.byteStride,binary.subarray(ext.byteOffset,ext.byteOffset+ext.byteLength),ext.mode,ext.filter);
 assert.deepEqual(Buffer.from(decoded),geometry);
 assert.ok(result.extensionsRequired.includes('EXT_meshopt_compression'));
});

test('Pages assembly fails before publishing an absent or partial store build', async t => {
  const root = await fixture(t);
  await assert.rejects(readGothtechnologyBuild(root), /missing index.html/);
  await write(root, gothtechnologyPath + '/dist/index.html');
  await assert.rejects(readGothtechnologyBuild(root), /missing shop\/index.html/);
});

test('Pages assembly includes compiled routes, lazy chunks and videos without touching other apps', async t => {
  const root = await fixture(t);
  const files = [...requiredStoreFiles, '_store/lazy.js', 'media/keychain.webp', '.nojekyll'];
  for (const file of files) await write(root, gothtechnologyPath + '/dist/' + file, file);
  await write(root, '_site/another-game/index.html', 'unchanged');
  const entries = await readGothtechnologyBuild(root);
  assert.equal(entries.length, files.length);
  const bytes = await copyGothtechnologyBuild(entries, join(root, '_site'));
  assert.equal(bytes, files.reduce((sum, name) => sum + Buffer.byteLength(name), 0));
  assert.equal(await readFile(join(root, '_site', gothtechnologyPath, '_store/lazy.js'), 'utf8'), '_store/lazy.js');
  assert.equal(await readFile(join(root, '_site/another-game/index.html'), 'utf8'), 'unchanged');
});

test('Pages assembly refuses private environment files in generated output', async t => {
  const root = await fixture(t);
  for (const file of requiredStoreFiles) await write(root, gothtechnologyPath + '/dist/' + file);
  await write(root, gothtechnologyPath + '/dist/.env', 'not-a-real-secret');
  await assert.rejects(readGothtechnologyBuild(root), /Refusing to publish/);
});

test('Pages shares identical cabinet assets and resolves both document and module URLs',async t=>{
  const root=await fixture(t),cabinet=gothtechnologyPath+'/arcade/shadow-ops-canvas/';
  const entries=[];
  for(const [path,content] of [['assets/hero.png','same-image'],['src/game.js','const image="./assets/hero.png";'],['src/title-3d.js','new URL("../assets/hero.png",import.meta.url)'],['style.css','url("./assets/hero.png")']]){
    const source=join(root,'build',path);await write(root,'build/'+path,content);entries.push({source,path:cabinet+path,bytes:Buffer.byteLength(content)});
  }
  const canonical='lottominded-ultra.io/games/shadow-ops-canvas/assets/hero.png';
  await write(root,'_site/'+canonical,'same-image');
  const shared=await shareShadowOpsAssets(entries,join(root,'_site'));assert.equal(shared.length,3);
  await copyGothtechnologyBuild(shared,join(root,'_site'));
  const pageURL=new URL('https://example.test/Jungle-Lotto/'+cabinet);
  for(const entry of shared){
    const url=entry.content.match(/"([^"]*assets\/hero.png)"/)[1];
    const base=entry.path.endsWith('title-3d.js')?new URL('src/title-3d.js',pageURL):pageURL;
    assert.equal(new URL(url,base).href,'https://example.test/Jungle-Lotto/'+canonical);
  }
  assert.equal(await readFile(entries[1].source,'utf8'),'const image="./assets/hero.png";','the original local build is unchanged');
  await write(root,'_site/'+canonical,'different-image');
  assert.equal((await shareShadowOpsAssets(entries,join(root,'_site'))).length,4,'different media must remain independent');
});

test('Pages retains original media URLs consumed by Vault Rush and the arcade catalog',async t=>{
  const root=await fixture(t),cabinet=gothtechnologyPath+'/arcade/shadow-ops-canvas/';
  const names=['mascot/lottomind-mascot-runner-atlas.png','backgrounds/higgsfield-soul-location-backplate.png','other.png'];
  const entries=[];
  for(const name of names){
    const source=join(root,'build/assets',name);
    await write(root,'build/assets/'+name,'same');
    await write(root,'_site/lottominded-ultra.io/games/shadow-ops-canvas/assets/'+name,'same');
    entries.push({source,path:cabinet+'assets/'+name,bytes:4});
  }
  const shared=await shareShadowOpsAssets(entries,join(root,'_site'));assert.equal(shared.length,2);
  await copyGothtechnologyBuild(shared,join(root,'_site'));
  for(const name of names.slice(0,2))assert.equal(await readFile(join(root,'_site',cabinet,'assets',name),'utf8'),'same');
});
