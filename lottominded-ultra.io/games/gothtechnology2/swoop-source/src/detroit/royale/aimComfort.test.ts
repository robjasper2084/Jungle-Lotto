import {test} from 'node:test';import assert from 'node:assert/strict';
import {aimFriction,readAimSettings,ShotPreview,autoReloadAllowed} from './aimComfort.ts';

test('automatic reload waits through recovery, stagger and pickup but resumes during normal movement',()=>{
 assert.equal(autoReloadAllowed(2,0,true),false);
 assert.equal(autoReloadAllowed(2,.4,false),false);
 assert.equal(autoReloadAllowed(3,0,false),false);
 for(const mode of [0,1,2])assert.equal(autoReloadAllowed(mode,0,false),true);
});
test('aim slowdown never assists mouse, occluded or distant opponents',()=>{for(const device of ['touch','controller']){assert.equal(aimFriction(0,20,.6,false,device),1);assert.equal(aimFriction(0,70,.6,true,device),1);assert.equal(aimFriction(.1,20,.6,true,device),1);}assert.equal(aimFriction(0,20,.6,true,'mouse'),1);assert.equal(aimFriction(0,20,0,true,'touch'),1);assert.equal(aimFriction(0,20,99,true,'touch'),.4);assert.ok(aimFriction(.03,20,.4,true,'controller')<1);});
test('invalid persisted settings cannot corrupt aim or color CSS',()=>{const s=readAimSettings({x:NaN,y:10,deadzone:-1,assist:Infinity,reticleColor:'red;display:none',reticleSize:100});assert.equal(s.x,1);assert.equal(s.y,2);assert.equal(s.deadzone,.02);assert.equal(s.assist,.35);assert.equal(s.reticleColor,'#a3fff1');assert.equal(s.reticleSize,30);});
const shot={round:'one',tick:10,counter:0,fire:true,allowed:true,mode:0,magazine:20,interval:9,weapon:'static'};
test('semi preview needs a fresh press and respects cooldown',()=>{const p=new ShotPreview();assert.equal(p.sample(shot,0),true);assert.equal(p.sample(shot,200),false);p.sample({...shot,fire:false},210);assert.equal(p.sample(shot,220),true);assert.equal(p.confirm(1,230),false);assert.equal(p.confirm(1,240),false);});
test('preview cannot fire when empty, reloading, dead or protected',()=>{for(const value of [{...shot,magazine:0},{...shot,allowed:false}])assert.equal(new ShotPreview().sample(value,0),false);});
test('automatic preview is bounded by magazine and resumes after reload',()=>{const p=new ShotPreview(),s={...shot,mode:2,magazine:2};assert.equal(p.sample(s,0),true);assert.equal(p.sample(s,100),false);assert.equal(p.sample(s,160),true);assert.equal(p.sample(s,320),false);p.sample({...s,magazine:0,allowed:false},330);assert.equal(p.sample({...s,magazine:20},500),true);});
test('late confirmations and new rounds do not suppress future shots forever',()=>{const p=new ShotPreview();p.sample(shot,0);assert.equal(p.confirm(1,800),true);assert.equal(p.sample({...shot,round:'two'},900),true);p.reset();assert.equal(p.sample({...shot,round:'two'},1000),true);});
