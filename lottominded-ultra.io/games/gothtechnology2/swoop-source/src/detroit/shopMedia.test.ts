import {test} from 'node:test';
import assert from 'node:assert/strict';
import {streamUrl,mediaBadge,STUDIO_SCREEN_WALLS} from './mediaSources.ts';
import {lottoMap,lottoCoordinates,LOTTO_FIXTURES,practiceNumbers,validPracticePick} from './lottoShopSite.ts';

test('live screen accepts direct HTTPS media and rejects page URLs and credentials',()=>{
 for(const url of ['javascript:alert(1)','http://example.com/x.m3u8','https://user:pass@example.com/x.mp4','https://youtube.com/watch?v=1','https://example.com/x.svg'])assert.equal(streamUrl(url),null);
 assert.equal(streamUrl(' https://example.com/live.m3u8?token=public '),'https://example.com/live.m3u8?token=public');
 assert.equal(mediaBadge(false,true),'PAUSED');assert.equal(mediaBadge(true,false),'PLAYING');assert.equal(mediaBadge(true,true),'LIVE');
});
test('both wall video surfaces face inward with room for their frames',()=>{
 for(const screen of STUDIO_SCREEN_WALLS){
  const inward=-screen.u*Math.sin(screen.angle)-screen.v*Math.cos(screen.angle);
  assert.ok(inward>0,`${screen.id} faces into the room`);
  assert.ok(Math.abs(screen.u)<24.02-.09&&Math.abs(screen.v)<21.70-.09,`${screen.id} sits ahead of the wall chassis`);
  assert.equal(screen.width/screen.height,16/9);
 }
});
test('LottoMind entrance and direct app aisle remain physically clear',()=>{
 for(let v=-4.5;v<13;v+=.1)for(const fixture of LOTTO_FIXTURES)assert.ok(Math.abs(fixture.u)>fixture.width/2+.5||Math.abs(v-fixture.v)>fixture.depth/2+.5,`Entry blocked at ${v}`);
 for(const [u,v]of [[0,6.6],[-5.55,-4.5],[6,8]]){const m=lottoMap(u,v),p=lottoCoordinates(m.x,m.z);assert.ok(Math.abs(p.u-u)<1e-8&&Math.abs(p.v-v)<1e-8);}
});
test('practice lottery generates six unique in-range numbers, including RNG extremes',()=>{
 for(const random of [()=>0,()=>.999999999,Math.random]){const numbers=practiceNumbers(random);assert.ok(validPracticePick(numbers));assert.equal(numbers.length,6);assert.equal(new Set(numbers).size,6);}
 for(const invalid of [[1,1,2,3,4,5],[0,2,3,4,5,6],[1,2,3,4,5,48],[1,2,3,4,5]])assert.equal(validPracticePick(invalid),false);
});
