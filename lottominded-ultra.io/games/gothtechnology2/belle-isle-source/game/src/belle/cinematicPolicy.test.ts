import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hudPreset, cockpitScale, clearanceWarning, BELLE_SUNSET, LAWN_DETAIL} from './cinematicPolicy.ts';
import {cockpitTelemetry} from './cockpitTelemetry.ts';
test('HUD presets reject corrupt storage and preserve explicit choices', () => {
  for (const value of [null, undefined, {}, 'bad', 42]) assert.equal(hudPreset(value), 'exploration');
  for (const value of ['racing', 'cinematic'] as const) assert.equal(hudPreset(value), value);
});
test('compact cockpit keeps full-size opt-out and phone legibility', () => {
  for (const width of [320,390,844,1440,NaN,Infinity]) assert.equal(cockpitScale(false,width),1);
  assert.equal(cockpitScale(true,390),.90); assert.equal(cockpitScale(true,1440),.82);
  for (const width of [NaN,Infinity,-1,320]) assert.ok(Number.isFinite(cockpitScale(true,width)));
});
test('clearance advice only uses finite moving airborne telemetry', () => {
  assert.equal(clearanceWarning(.5,15,false),true); assert.equal(clearanceWarning(2,15,false),false);
  assert.equal(clearanceWarning(.5,0,false),false); assert.equal(clearanceWarning(.5,15,true),false);
  for (const height of [-1,NaN,Infinity]) assert.equal(clearanceWarning(height,15,false),false);
});
test('collision warning wins and input telemetry is never changed', () => {
  const input={speed:15,height:.5,heading:0,landed:false,landing:false,boost:false,collision:true,lights:true};
  const original={...input}; assert.equal(cockpitTelemetry(input).warning,'OBSTACLE');assert.deepEqual(input,original);
  assert.equal(cockpitTelemetry({...input,collision:false}).warning,'LOW CLEARANCE');
});
test('sunset is an opt-in slow cycle, not an initialization override', () => {
  assert.deepEqual(BELLE_SUNSET,{hour:17.55,cycle:true,dayMinutes:60,clouds:'wispy'});assert.ok(Object.isFrozen(BELLE_SUNSET));
});
test('lawn detail is stable, filtered and has no extra sampled textures or time input', () => {
  assert.match(LAWN_DETAIL,/fwidth/);assert.match(LAWN_DETAIL,/terrainXZ/);
  assert.doesNotMatch(LAWN_DETAIL,/sampler|texture2D|time|discard/);
});
test('cinematic layout does not hide race guidance or critical controls', () => {
  const css=readFileSync(new URL('./visualPolish.css',import.meta.url),'utf8');
  assert.match(css,/data-hud-preset=cinematic.*:not\(\.island-trial\)/);
  const hideRules=css.match(/[^{}]+\{[^{}]*display:none[^{}]*\}/g)||[];
  for (const rule of hideRules.filter(r=>r.includes('data-hud-preset'))) assert.doesNotMatch(rule,/#trial-hud|#hover-boost|hover-actions|hover-touch|#pause|#settings-open/);
});
