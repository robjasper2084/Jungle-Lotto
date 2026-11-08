import test from 'node:test';import assert from 'node:assert/strict';
import {DEFAULT_SKY,CLOUD_TYPES,normalizeSky,advanceHour,clockLabel,sunDirection,skyKeyBlend,cloudShape,islandHazeDensity} from './skyModel.ts';
test('sky settings recover safely from invalid saved preferences',()=>{assert.deepEqual(normalizeSky({hour:NaN,dayMinutes:-1,clouds:'invalid' as any,cycle:'yes' as any}),DEFAULT_SKY);assert.equal(normalizeSky({hour:25}).hour,1);assert.equal(normalizeSky({hour:-1}).hour,23);});
test('haze leaves nearby routes crisp and retains the Detroit skyline across weather',()=>{
 const blend=(density:number,metres:number)=>1-Math.exp(-((density*metres)**2));
 for(const cover of [0,.5,1])for(const night of [0,.5,1]){
  const density=islandHazeDensity(cover,night);
  assert(blend(density,150)<.002,'nearby gates and road markings stay clear');
  assert(blend(density,3500)>.3&&blend(density,3500)<.55,'RenCen remains visible through atmospheric depth');
  assert(blend(density,6500)>blend(density,3500));
 }
 assert.equal(islandHazeDensity(NaN,Infinity),islandHazeDensity(0,0));
 assert.equal(islandHazeDensity(-1,2),islandHazeDensity(0,1));
});
test('day cycle wraps without background catch-up and respects hold',()=>{assert(Math.abs(advanceHour(23.999,.1,DEFAULT_SKY,true)-.001)<1e-8);assert.equal(advanceHour(17,120,DEFAULT_SKY,false),17);assert.equal(advanceHour(17,.1,{...DEFAULT_SKY,cycle:false},true),17);assert.equal(advanceHour(17,120,DEFAULT_SKY,true),advanceHour(17,.1,DEFAULT_SKY,true));assert.equal(advanceHour(17,-1,DEFAULT_SKY,true),17);assert.equal(advanceHour(17,Infinity,DEFAULT_SKY,true),17);});
test('sun moves through dawn, overhead daylight, skyline sunset and night',()=>{for(let h=0;h<24;h+=.05){const v=sunDirection(h);assert(Math.abs(Math.hypot(...v)-1)<1e-10);assert(v.every(Number.isFinite));}assert(sunDirection(12)[1]>.9);assert(sunDirection(0)[1]<-.9);assert(Math.abs(sunDirection(6)[1])<1e-10);assert(sunDirection(17)[0]<0);assert(sunDirection(7)[0]>0);assert.equal(clockLabel(24),'00:00');assert.equal(clockLabel(16.7),'16:42');});
test('cloud weather and sky keyframes blend continuously across midnight',()=>{for(const type of CLOUD_TYPES){const a=cloudShape(type,23.999999),b=cloudShape(type,0);for(const k of Object.keys(a) as (keyof typeof a)[])assert(Math.abs(a[k]-b[k])<.0001);for(let h=0;h<24;h+=.1){const s=cloudShape(type,h);assert(Object.values(s).every(Number.isFinite));assert(s.coverage>=0&&s.coverage<=1);assert(s.overcast>=0&&s.overcast<=1);}}const a=skyKeyBlend(23.999999),b=skyKeyBlend(0);assert.equal(a.b.top,b.a.top);assert.equal(a.b.horizon,b.a.horizon);});

test('afternoon changing clouds separate the upper sky rather than defaulting to blanket overcast',()=>{
 const now=cloudShape('changing',16.7),overcast=cloudShape('overcast',16.7);
 assert(now.coverage<overcast.coverage);assert(now.overcast<overcast.overcast*.60);
 const dusk=skyKeyBlend(16.7);assert.equal(dusk.a.hour,16.7);assert.notEqual(dusk.a.top,dusk.a.horizon);
});
