import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GRAPHICS_PRESETS,resolveGraphics,antialiasForDevice} from './sharedGraphicsQuality.ts';
test('Android and Apple mobile auto budgets stay light regardless of reported CPU or memory',()=>{
 for(const [cores,memory]of [[4,4],[6,undefined],[8,8],[12,16]] as const){
  const tier=resolveGraphics('auto',cores,memory,true);
  assert.equal(tier,'low');assert.equal(GRAPHICS_PRESETS[tier].fps,30);
  assert.equal(GRAPHICS_PRESETS[tier].shadows,0);
  assert.equal(antialiasForDevice('auto',cores,memory,true),false);
 }
 assert.equal(resolveGraphics('auto',12,16,false,'NVIDIA GeForce'),'high');
});
test('explicit mobile quality and antialiasing preferences still win',()=>{
 for(const preset of ['low','balanced','high','ultra'])assert.equal(resolveGraphics(preset,4,4,true),preset);
 assert.equal(antialiasForDevice('on',4,4,true),true);
 assert.equal(antialiasForDevice('off',16,16,true),false);
});
