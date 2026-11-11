import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {gitBlobSha,stagePublicAssets} from './stage-public-assets.mjs';
const manifest=JSON.parse(await readFile(new URL('./public-assets.manifest.json',import.meta.url),'utf8'));
function item(path,bytes){return {path,bytes:bytes.length,sha:gitBlobSha(bytes)};}
async function sandbox(t){
  const base=await mkdtemp(join(tmpdir(),'jackpot-canonical-'));
  t.after(()=>rm(base,{recursive:true,force:true}));
  const canonical=join(base,'published'),output=join(base,'generated');
  await mkdir(join(canonical,'assets','audio'),{recursive:true});
  const bytes=Buffer.from('Original Jackpot Maze media fixture');
  await writeFile(join(canonical,'assets','audio','fixture.mp3'),bytes);
  return {canonical,output,bytes,manifest:{version:1,count:1,bytes:bytes.length,files:[item('assets/audio/fixture.mp3',bytes)]}};
}
test('the 42 duplicate Git blobs are now sourced only from the canonical game assets',()=>{
  assert.equal(manifest.version,1);assert.equal(manifest.count,42);
  assert.equal(manifest.bytes,18089713);
  assert.equal(manifest.files.length,42);
  assert.equal(new Set(manifest.files.map(file=>file.path)).size,42);
  assert(manifest.files.every(file=>file.path.startsWith('assets/')&&/^[a-f0-9]{40}$/.test(file.sha)));
});
test('staging preserves original media bytes and exact paths',async t=>{
  const f=await sandbox(t);
  const r=await stagePublicAssets({manifest:f.manifest,canonicalRoot:f.canonical,outputRoot:f.output});
  assert.deepEqual(r,{count:1,bytes:f.bytes.length});
  assert.deepEqual(await readFile(join(f.output,'assets/audio/fixture.mp3')),f.bytes);
});
test('tampered canonical bytes refuse staging before modifying existing output',async t=>{
  const f=await sandbox(t);
  await mkdir(f.output,{recursive:true});await writeFile(join(f.output,'keep.txt'),'keep');
  await writeFile(join(f.canonical,'assets/audio/fixture.mp3'),Buffer.from('Altered Jackpot Maze media fixture'));
  await assert.rejects(stagePublicAssets({manifest:f.manifest,canonicalRoot:f.canonical,outputRoot:f.output}),/mismatch/);
  assert.equal(await readFile(join(f.output,'keep.txt'),'utf8'),'keep');
});
test('unsafe traversal, repeated files and incomplete manifests are refused',async t=>{
  const f=await sandbox(t);
  for(const replacement of [{...f.manifest,files:[{...f.manifest.files[0],path:'assets/../outside'}]},
    {...f.manifest,files:[...f.manifest.files,f.manifest.files[0]]},
    {...f.manifest,bytes:0}]){
    await assert.rejects(stagePublicAssets({manifest:replacement,canonicalRoot:f.canonical,outputRoot:f.output}));
  }
});
