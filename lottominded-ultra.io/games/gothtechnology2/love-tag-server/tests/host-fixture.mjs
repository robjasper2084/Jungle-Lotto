import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {loadHostFixture} from '../dist/hostFixture.js';

const root=resolve(import.meta.dirname,'../fixtures');
for(const product of ['swoop-detroit','elmwood-explorer']){
  const original=JSON.parse(gunzipSync(await readFile(resolve(root,product+'.json.gz'))));
  const prepared=await loadHostFixture(root,product);
  const bytes=await prepared.physics();
  const digest=value=>createHash('sha256').update(value).digest('hex');
  assert.equal(digest(bytes),digest(Buffer.from(original.physics,'base64')));
  assert.deepEqual(prepared.fixture,{...original,physics:''});
  console.log('PASS '+product+': identical physics bytes, map hash, navigation and heights');
}
const testRoot=await mkdtemp(resolve(tmpdir(),'love-tag-fixture-'));
try{
  const fixture={product:'swoop-detroit',physics:'AQID',hash:'unchanged'};
  await writeFile(resolve(testRoot,'swoop-detroit.json.gz'),gzipSync(JSON.stringify(fixture)));
  const fallback=await loadHostFixture(testRoot,'swoop-detroit');
  assert.deepEqual(fallback.fixture,fixture);assert.equal(await fallback.physics(),undefined);
  await writeFile(resolve(testRoot,'swoop-detroit.server.json'),JSON.stringify({fixture:{...fixture,physics:''},physicsHash:'0'.repeat(64)}));
  await writeFile(resolve(testRoot,'swoop-detroit.physics.bin'),Buffer.from([1,2,3]));
  const corrupted=await loadHostFixture(testRoot,'swoop-detroit');
  await assert.rejects(corrupted.physics(),/checksum/);
  await writeFile(resolve(testRoot,'swoop-detroit.server.json'),'invalid');
  await assert.rejects(loadHostFixture(testRoot,'swoop-detroit'));
  console.log('PASS missing-prepared fallback and fail-closed corrupted metadata/physics');
}finally{await rm(testRoot,{recursive:true,force:true});}
