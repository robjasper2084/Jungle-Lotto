import test from 'node:test';import assert from 'node:assert/strict';import {gzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {loadFixture} from '../src/fixtureLoader.ts';import {takeFixtureBytes} from '../src/fixtureBytes.ts';
test('binary fixture preserves bytes, checks integrity and consumes the temporary buffer once',async t=>{
 const bytes=new Uint8Array([1,2,3,255]),hash=createHash('sha256').update(bytes).digest('hex'),name='swoop-detroit.physics-'+hash.slice(0,16)+'.bin.gz';
 const manifest={version:1,physics:name,physicsHash:hash,physicsBytes:4,fixture:{physics:'',hash:'same-authoritative-map'}};const urls:string[]=[];
 t.mock.method(globalThis,'fetch',async(url:any)=>{urls.push(String(url));return new Response(gzipSync(String(url).includes('.browser.')?JSON.stringify(manifest):bytes));});
 const fixture=await loadFixture('https://game.test/love-tag/swoop-detroit.json?version=2');assert.equal(fixture.hash,'same-authoritative-map');assert.deepEqual(takeFixtureBytes(fixture),bytes);assert.equal(takeFixtureBytes(fixture),undefined);
 assert.match(urls[0],/swoop-detroit.browser.json.gz\?version=2$/);assert.equal(urls[1],'https://game.test/love-tag/'+name);
 manifest.physicsHash='0'.repeat(64);await assert.rejects(loadFixture('https://game.test/swoop-detroit.json'),/integrity/);
});
test('legacy package fallback only follows a missing manifest; server errors do not start another massive download',async t=>{
 let status=404;const urls:string[]=[];t.mock.method(globalThis,'fetch',async(url:any)=>{urls.push(String(url));return String(url).includes('.browser.')?new Response('',{status}):new Response(gzipSync('{"hash":"legacy"}'));});
 assert.equal((await loadFixture('https://game.test/map.json?x=1')).hash,'legacy');assert.match(urls[1],/map.json.gz\?x=1$/);
 status=500;urls.length=0;await assert.rejects(loadFixture('https://game.test/map.json'),/metadata/);assert.equal(urls.length,1);
});
