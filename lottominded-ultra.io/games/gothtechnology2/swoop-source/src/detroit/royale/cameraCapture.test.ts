import test from 'node:test';
import assert from 'node:assert/strict';
import {neutral} from '../../../../ride-core/src/royale/rules.ts';
import {photographyInput,clipMime} from './cameraCapture.ts';
import {SurfaceMarks} from './surfaceMarks.ts';
test('camera shutter suppresses every offensive control while preserving travel and optics',()=>{const c={...neutral('test'),throttle:1,steer:.5,aimMode:2,fire:true,light:true,heavy:true,brawl:true,dogAttack:true,utility:true,reload:true,cycleMode:true};const safe=photographyInput(c);for(const k of ['fire','light','heavy','brawl','dogAttack','utility','reload','cycleMode'] as const)assert.equal(safe[k],false);assert.equal(safe.throttle,1);assert.equal(safe.steer,.5);assert.equal(safe.aimMode,2);assert(c.fire);});
test('clip format chooses a browser-supported video codec',()=>{assert.equal(clipMime(s=>s==='video/mp4'),'video/mp4');assert.equal(clipMime(s=>s==='video/webm'),'video/webm');assert.equal(clipMime(()=>false),'');});
test('impact marks have a fixed pool, deduplicate snapshots, expire, and reset',()=>{const marks=new SurfaceMarks(),hits=Array.from({length:100},(_,i)=>({id:String(i),tick:30,owner:'me',weapon:'static' as const,p:{x:i,y:1,z:2},normal:{x:0,y:0,z:-1}}));marks.update(hits,10);assert.equal(marks.count,64);marks.update(hits,100);assert.equal(marks.count,64);marks.update([],21000);assert.equal(marks.count,0);marks.reset();marks.update(hits.slice(0,1),22000);assert.equal(marks.count,1);marks.dispose();});
