import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ART_STYLE_IDS,ART_DIRECTIONS,DEFAULT_ART_STYLE,normalizeArtStyle,artStyleSkyPreset} from './artDirection.ts';
test('four selectable looks and safe default for corrupt local storage',()=>{
 assert.deepEqual(ART_STYLE_IDS,['authentic','golden','noir','detroit2084']);
 for(const id of ART_STYLE_IDS)assert.equal(normalizeArtStyle(id),id);
 for(const x of [null,undefined,'',{},false,'unknown','__proto__'])assert.equal(normalizeArtStyle(x),DEFAULT_ART_STYLE);
});
test('bounded environmental grade and unchanged graphic settings',()=>{
 for(const id of ART_STYLE_IDS){
  const look=ART_DIRECTIONS[id],v=artStyleSkyPreset(id);
  assert(Number.isFinite(v.hour)&&v.hour>=0&&v.hour<24);
  assert.equal(v.cycle,false);
  assert(['changing','clear','wispy','scattered','layered','overcast'].includes(v.clouds));
  assert.deepEqual(Object.keys(v).sort(),['clouds','cycle','hour']);
  for(const key of ['mix','fogMix','reflectionMix'] as const)assert(look[key]>=0&&look[key]<=.6);
  for(const key of ['ambientScale','sunScale','hazeScale','environmentScale'] as const)assert(look[key]>=.85&&look[key]<=1.15);
  for(const color of Object.values(look.palette))assert.match(color,/^#[0-9a-f]{6}$/i);
 }
 assert.equal(ART_DIRECTIONS.authentic.mix,0);assert.equal(ART_DIRECTIONS.authentic.hazeScale,1);
});
test('settings HTML includes accessible four-style control',()=>{
 const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
 assert.match(html,/<select id="art-style"/);
 for(const id of ART_STYLE_IDS)assert(html.includes('<option value="'+id+'">'));
 assert.match(html,/Visual atmosphere/);
});
