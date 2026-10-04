import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {loadFixture} from '../src/fixtureLoader.ts';

test('compressed fixtures retain cache revisions and fragments on the gzip path',async()=>{
  const originalFetch=globalThis.fetch,originalStream=globalThis.DecompressionStream;
  const fixture={product:'elmwood-explorer',revision:'full-map-test'},bytes=gzipSync(JSON.stringify(fixture));
  try {
    for(const fallback of [false,true]){
      if(fallback)globalThis.DecompressionStream=undefined as any;
      for(const [input,expected] of [
        ['https://game.test/love-tag/map.json','https://game.test/love-tag/map.json.gz'],
        ['https://game.test/love-tag/map.json?v=revision','https://game.test/love-tag/map.json.gz?v=revision'],
        ['./map.json?v=revision#map','./map.json.gz?v=revision#map'],
      ]){
        let requested='';
        globalThis.fetch=(async(url)=>{requested=String(url);return new Response(bytes);}) as typeof fetch;
        assert.deepEqual(await loadFixture(input),fixture);
        assert.equal(requested,expected);
      }
    }
  } finally {globalThis.fetch=originalFetch;globalThis.DecompressionStream=originalStream;}
});

test('uncompressed fallback requests the original versioned fixture',async()=>{
  const originalFetch=globalThis.fetch,calls:string[]=[];
  try {
    globalThis.fetch=(async(url)=>{calls.push(String(url));return calls.length===1?new Response('',{status:404}):Response.json({revision:'fallback'});}) as typeof fetch;
    assert.deepEqual(await loadFixture('/map.json?v=2'),{revision:'fallback'});
    assert.deepEqual(calls,['/map.json.gz?v=2','/map.json?v=2']);
  }finally{globalThis.fetch=originalFetch;}
});
