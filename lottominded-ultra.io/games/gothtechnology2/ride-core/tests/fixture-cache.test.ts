import test from 'node:test';import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {loadFixture} from '../src/fixtureLoader.ts';import {takeFixtureBytes} from '../src/fixtureBytes.ts';
import {savePhysics} from '../src/fixtureCache.ts';

function store(t:any){
 const rows=new Map<string,Response>(),old=Object.getOwnPropertyDescriptor(globalThis,'caches');
 const cache={async match(url:string){return rows.get(String(url))?.clone();},async put(url:string,response:Response){rows.set(String(url),response.clone());},async delete(key:any){return rows.delete(typeof key==='string'?key:key.url);},async keys(){return [...rows.keys()].map(url=>({url}));}};
 Object.defineProperty(globalThis,'caches',{configurable:true,value:{async open(){return cache;}}});
 t.after(()=>{if(old)Object.defineProperty(globalThis,'caches',old);else delete(globalThis as any).caches;});return rows;
}
function fixture(t:any){
 const bytes=new Uint8Array([1,5,7,9]),hash=createHash('sha256').update(bytes).digest('hex');
 const name='swoop-detroit.physics-'+hash.slice(0,16)+'.bin.gz',url='https://game.test/love-tag/'+name;
 const manifest={version:1,physics:name,physicsHash:hash,physicsBytes:4,fixture:{physics:'',hash:'canonical'}};
 let downloads=0;
 t.mock.method(globalThis,'fetch',async(input:any)=>{if(String(input).includes('.browser.'))return new Response(gzipSync(JSON.stringify(manifest)));downloads++;return new Response(gzipSync(bytes));});
 return {bytes,url,get downloads(){return downloads;}};
}
test('a repeat load reuses verified compressed physics without a second large transfer',async t=>{
 const rows=store(t),data=fixture(t);
 for(let i=0;i<2;i++)assert.deepEqual(takeFixtureBytes(await loadFixture('https://game.test/love-tag/swoop-detroit.json')),data.bytes);
 assert.equal(data.downloads,1);assert.equal(rows.size,1);
});
test('a corrupt cached map is evicted, downloaded once and verified again',async t=>{
 const rows=store(t),data=fixture(t);rows.set(data.url,new Response(gzipSync(new Uint8Array([8,8,8,8]))));
 assert.deepEqual(takeFixtureBytes(await loadFixture('https://game.test/love-tag/swoop-detroit.json')),data.bytes);
 assert.equal(data.downloads,1);
 assert.deepEqual(takeFixtureBytes(await loadFixture('https://game.test/love-tag/swoop-detroit.json')),data.bytes);assert.equal(data.downloads,1);
});
test('denied storage leaves normal loading available',async t=>{
 store(t);t.mock.method(globalThis.caches,'open',async()=>{throw Error('Storage denied');});const data=fixture(t);
 assert.deepEqual(takeFixtureBytes(await loadFixture('https://game.test/love-tag/swoop-detroit.json')),data.bytes);
 assert.equal(data.downloads,1);
});
test('cache updates retain the other map and write only the requested byte view',async t=>{
 const rows=store(t);rows.set('https://game.test/swoop-detroit.physics-old.bin.gz',new Response('old'));
 rows.set('https://game.test/elmwood-explorer.physics-other.bin.gz',new Response('other'));
 const url='https://game.test/swoop-detroit.physics-new.bin.gz';await savePhysics(url,new Uint8Array([0,1,2,3]).subarray(1,3));
 assert.equal(rows.size,2);assert.deepEqual(new Uint8Array(await rows.get(url)!.arrayBuffer()),new Uint8Array([1,2]));
 assert(rows.has('https://game.test/elmwood-explorer.physics-other.bin.gz'));
});
