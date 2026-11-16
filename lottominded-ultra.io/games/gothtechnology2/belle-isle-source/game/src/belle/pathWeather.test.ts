import test from 'node:test';
import assert from 'node:assert/strict';
import {pathWeatherFragment,type PathSurface} from './pathWeather.ts';
test('all pathways use world-space material variation without new textures or additional passes',()=>{
 const kinds:PathSurface[]=['concrete','pavers','gravel','wood'];
 for(const kind of kinds){
  const shader=pathWeatherFragment(kind);
  assert(shader.includes('weatherField'));
  assert(shader.includes('fwidth(q)'));
  assert(shader.includes('diffuseColor.rgb'));
  assert(!/texture2D|sampler2D|discard|gl_FragColor/.test(shader));
 }
 assert(pathWeatherFragment('gravel').includes('float clay'));
 assert(pathWeatherFragment('wood').includes('grain'));
 assert(pathWeatherFragment('pavers').includes('moss'));
 assert(pathWeatherFragment('concrete').includes('weatherStain'));
});
