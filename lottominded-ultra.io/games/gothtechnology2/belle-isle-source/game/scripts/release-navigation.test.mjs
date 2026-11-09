import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {revealPracticeCourse} from './release-navigation.mjs';
function fixture({open=false,count=1,disabled=false,tapError=null}={}){
 const calls=[],state={open,count,disabled};
 const locator=selector=>({selector,evaluate:async fn=>{calls.push('read-open');return fn({open:state.open});},tap:async()=>{calls.push('native-tap');if(tapError)throw tapError;state.open=!state.open;}});
 const page={locator};const expect=element=>({toHaveCount:async n=>assert.equal(state.count,n),toBeVisible:async()=>{calls.push('visible:'+element.selector);if(element.selector!== '#trial-practice')assert(state.open,'Course inside closed details is not visible');},toHaveJSProperty:async(key,value)=>assert.equal(state[key],value),toBeEnabled:async()=>assert(!state.disabled)});
 return {page,expect,state,calls};
}
test('a closed practice section is opened through its existing native summary before focus',async()=>{
 const f=fixture();await revealPracticeCourse(f.page,f.expect,'[data-course="onewheel-island-cup-v1"]');assert(f.state.open);assert.equal(f.calls.filter(c=>c==='native-tap').length,1);assert(f.calls.indexOf('native-tap')<f.calls.indexOf('visible:[data-course="onewheel-island-cup-v1"]'));
});
test('already-open details are not toggled closed',async()=>{const f=fixture({open:true});await revealPracticeCourse(f.page,f.expect,'course');assert(!f.calls.includes('native-tap'));});
test('missing, disabled and unopenable courses fail rather than bypass setup',async()=>{
 for(const options of [{count:0},{disabled:true},{tapError:Error('Native tap failed')}]){const f=fixture(options);await assert.rejects(revealPracticeCourse(f.page,f.expect,'course'));}
});
test('release evidence retains the strict classifier, fresh hold and unchanged deadlines',async()=>{
 const source=await readFile(new URL('./release-evidence.mjs',import.meta.url),'utf8');assert.match(source,/await revealPracticeCourse\(page,expect,/);assert.match(source,/assert\.equal\(classification\.status,'passed'/);assert.match(source,/classification\.event\.elapsed,0/);assert.match(source,/classification\.event\.speed,0/);assert.match(source,/report\.checks\.countdownVerified=2/);assert.match(source,/actionMs:90000,loadMs:180000,screenshotMs:150000,closeMs:30000/);assert.match(source,/35\*60\*1000/);
 assert.doesNotMatch(source,/\.open\s*=\s*true/);
});

import {queueNativeCountdownTouch,receivedNativeTouch} from './release-navigation.mjs';
test('native start and touch commands are queued together before any acknowledgement',async()=>{
 const calls=[],release=[];const client={send:(method,params)=>{calls.push({method,params});return new Promise(resolve=>release.push(resolve));}};
 const result=queueNativeCountdownTouch(client,{key:'Enter',code:'Enter'},{x:80,y:240});
 assert.deepEqual(calls.map(c=>[c.method,c.params.type]),[['Input.dispatchKeyEvent','keyDown'],['Input.dispatchKeyEvent','keyUp'],['Input.dispatchTouchEvent','touchStart']]);
 assert.deepEqual(calls[2].params.touchPoints,[{id:1,x:80,y:240,radiusX:4,radiusY:4,force:1}]);
 for(const done of release)done({});await result;
});
test('invalid native coordinates and protocol failures remain fatal',async()=>{
 let calls=0;const client={send:()=>{calls++;return Promise.resolve({});}};
 for(const p of [{x:NaN,y:1},{x:1,y:Infinity},{x:-1,y:1},null])assert.throws(()=>queueNativeCountdownTouch(client,{},p),/Invalid/);
 assert.equal(calls,0);
 await assert.rejects(queueNativeCountdownTouch({send:()=>Promise.reject(Error('CDP failed'))},{},{x:1,y:2}),/CDP failed/);
});
test('receipt requires a fresh real touch down, never an acknowledgement, mouse, move or old event',()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'window');
 const events=[];Object.defineProperty(globalThis,'window',{value:{__releaseInput:events},configurable:true});
 try{
  assert.equal(receivedNativeTouch(0),false);
  for(const e of [{type:'keydown',trusted:true},{type:'pointermove',trusted:true,pointerType:'touch'},{type:'pointerdown',trusted:true,pointerType:'mouse'},{type:'pointerdown',trusted:false,pointerType:'touch'}]){events.push(e);assert.equal(receivedNativeTouch(0),false);}
  events.push({type:'pointerdown',trusted:true,pointerType:'touch'});assert.equal(receivedNativeTouch(0),true);assert.equal(receivedNativeTouch(events.length),false);
 }finally{if(old)Object.defineProperty(globalThis,'window',old);else delete globalThis.window;}
});
test('receipt is serialized without closures and precedes strict timing classification',async()=>{
 assert.doesNotThrow(()=>new Function('return ('+receivedNativeTouch.toString()+')')());
 const s=await readFile(new URL('./release-evidence.mjs',import.meta.url),'utf8');
 assert(s.indexOf('await page.waitForFunction(receivedNativeTouch')<s.indexOf('const classification=classifyCountdownInput'));
 assert.match(s,/receivedNativeTouch,before\.events,\{timeout:90000,polling:50\}/);
 assert.doesNotMatch(s,/emulateTouchFromMouseEvent|dispatchEvent\(new (PointerEvent|TouchEvent)|setSystemTime|clock\.install/);
 assert.match(s,/type:'touchEnd',touchPoints:\[\]/);
});
test('river filtering adds no textures, leaves wakes after filtering and does not change lagoon shading',async()=>{
 const s=await readFile(new URL('../src/belle/water.ts',import.meta.url),'utf8');
 assert.match(s,/kind==='lagoon'\?'':`\/\/ Filter subpixel normal detail/);
 assert.match(s,/max\(length\(dFdx\(p\)\),length\(dFdy\(p\)\)\)/);
 assert(s.indexOf('wave*=riverNormalVisibility')<s.indexOf('vec2 delta=p-hoverWash'));
 assert.equal((s.match(/texture2D\(riverNormals/g)||[]).length,5,'two lagoon and two river normal layers plus original wash');
 assert.match(s,/riverSunSparkle=\.78\+\.22\*clamp\(\(r1\.x\+r2\.y\)\*riverNormalVisibility,-1\.,1\.\)/);
 assert.match(s,/kind==='lagoon'\?\.60:0/);assert.match(s,/riverFarRing\(\)/);
});
test('normal-detail attenuation is finite, monotone and retains close views',()=>{
 const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 const visibility=(d,p)=>(.025+.975*(1-smooth(45,360,d)))*(1-smooth(.35,2.5,p));
 assert.equal(visibility(1,.1),1);assert.equal(visibility(500,3),0);
 for(const footprint of [0,.1,.35,1,2,2.5,10]){let last=1;for(let d=0;d<1000;d++){const v=visibility(d,footprint);assert(Number.isFinite(v)&&v>=0&&v<=last+1e-12);last=v;}}
});
