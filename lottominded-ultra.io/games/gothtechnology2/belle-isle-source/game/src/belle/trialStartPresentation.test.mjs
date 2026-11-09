import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TrialStartPresentation} from './trialStartPresentation.ts';

function fixture(){
 let now=0,next=0,countdown=false,lost=false,status=1,target=null,renderError=null;
 const callbacks=new Map(),paints=new Map(),calls={draw:0,after:0,deleted:0,flush:0,wait:0};
 const timing={now:()=>now,later:(fn,ms)=>{const id=++next;callbacks.set(id,{fn,at:now+ms});return id;},cancelLater:id=>callbacks.delete(id),paint:fn=>{const id=++next;paints.set(id,fn);return id;},cancelPaint:id=>paints.delete(id)};
 const gl={SYNC_GPU_COMMANDS_COMPLETE:10,ALREADY_SIGNALED:1,CONDITION_SATISFIED:2,WAIT_FAILED:3,TIMEOUT_EXPIRED:4,isContextLost:()=>lost,fenceSync:()=>({}),deleteSync:()=>calls.deleted++,flush:()=>calls.flush++,clientWaitSync:(_f,flags,timeout)=>{assert.equal(flags,0);assert.equal(timeout,0);calls.wait++;return status;}};
 const scene={onAfterRender:()=>calls.after++},camera={},canvas={width:390,height:340};
 const original=(s,c)=>{calls.draw++;if(renderError)throw renderError;s.onAfterRender?.(renderer,s,c);};
 const renderer={xr:{isPresenting:false},domElement:canvas,getRenderTarget:()=>target,getContext:()=>gl,render:original};
 const controller=new TrialStartPresentation(scene,()=>countdown,timing);
 const draw=()=>renderer.render(scene,camera);
 const paint=()=>{const all=[...paints.values()];paints.clear();now+=16;all.forEach(f=>f());};
 const advance=ms=>{now+=ms;for(const [id,t] of [...callbacks])if(t.at<=now){callbacks.delete(id);t.fn();}};
 return {controller,scene,renderer,gl,canvas,calls,original,draw,paint,advance,callbacks,paints,setCountdown:v=>countdown=v,setLost:v=>lost=v,setStatus:v=>status=v,setTarget:v=>target=v,setError:v=>renderError=v};
}
const tick=()=>Promise.resolve();
test('a submitted real starting-line draw and GPU completion precede two paint opportunities',async()=>{
 const f=fixture(),abort=new AbortController();let ready=false;
 const p=f.controller.prepare(abort.signal).then(()=>ready=true);assert.equal(f.calls.draw,0);
 f.draw();assert.equal(f.calls.draw,1);assert.equal(f.calls.flush,1);assert.equal(ready,false);
 f.draw();assert.equal(f.calls.draw,1,'no second costly draw while handoff is pending');
 f.paint();await tick();assert.equal(ready,false);f.paint();await p;
 assert.equal(f.controller.snapshot.state,'ready');assert.equal(f.calls.deleted,1);assert.equal(f.callbacks.size,0);
 f.setCountdown(true);f.draw();assert.equal(f.calls.draw,1);
 f.setCountdown(false);f.draw();assert.equal(f.calls.draw,2,'GO restores real drawing immediately');
 f.controller.dispose();assert.equal(f.renderer.render,f.original);
});
test('pending GPU work is polled without blocking, not declared complete on submission',async()=>{
 const f=fixture();f.setStatus(f.gl.TIMEOUT_EXPIRED);let ready=false;
 const p=f.controller.prepare(new AbortController().signal).then(()=>ready=true);f.draw();
 f.advance(16);f.draw();assert.equal(f.calls.draw,1);assert.equal(ready,false);
 f.setStatus(f.gl.CONDITION_SATISFIED);f.advance(16);f.paint();f.paint();await p;
 assert.equal(f.calls.deleted,1);assert(f.controller.snapshot.gpuReadyAtMs>=32);f.controller.dispose();
});
test('shadow/offscreen/other-scene and XR draws are never mistaken for a ready visible game frame',async()=>{
 const f=fixture(),abort=new AbortController(),p=f.controller.prepare(abort.signal);p.catch(()=>{});
 f.setTarget({});f.draw();assert.equal(f.calls.flush,0);
 f.setTarget(null);f.renderer.xr.isPresenting=true;f.draw();assert.equal(f.calls.flush,0);
 f.renderer.xr.isPresenting=false;f.renderer.render({},{});assert.equal(f.calls.flush,0);
 f.draw();f.paint();f.paint();await p;f.setCountdown(true);
 const before=f.calls.draw;f.setTarget({});f.draw();f.setTarget(null);f.renderer.xr.isPresenting=true;f.draw();f.renderer.render({},{});
 assert.equal(f.calls.draw,before+3);f.controller.dispose();
});
test('both early cancellation and cancellation during the GPU fence clean all owned work',async()=>{
 for(const afterDraw of [false,true]){const f=fixture(),abort=new AbortController();f.setStatus(f.gl.TIMEOUT_EXPIRED);
  const p=f.controller.prepare(abort.signal);if(afterDraw)f.draw();abort.abort();await assert.rejects(p,{name:'AbortError'});
  assert.equal(f.callbacks.size,0);assert.equal(f.paints.size,0);assert.equal(f.calls.deleted,afterDraw?1:0);
  assert.equal(f.controller.snapshot.holding,false);f.draw();assert.equal(f.calls.draw,afterDraw?2:1);f.controller.dispose();
 }
});
test('late paint callbacks from a replaced preparation cannot approve or unlock its successor',async()=>{
 const f=fixture(),a=f.controller.prepare(new AbortController().signal);a.catch(()=>{});f.draw();const stale=[...f.paints.values()];
 const b=f.controller.prepare(new AbortController().signal);await assert.rejects(a,{name:'AbortError'});
 stale.forEach(fn=>fn());assert.equal(f.controller.snapshot.state,'preparing');
 f.draw();f.paint();f.paint();await b;assert.equal(f.calls.draw,2);f.controller.dispose();
});
test('missing frames and a never-ready GPU fail at the bounded 45-second preparation deadline',async()=>{
 for(const draw of [false,true]){const f=fixture();f.setStatus(f.gl.TIMEOUT_EXPIRED);const p=f.controller.prepare(new AbortController().signal);
  if(draw)f.draw();f.advance(45000);await assert.rejects(p,/45 seconds/);assert.equal(f.controller.snapshot.holding,false);
  assert.equal(f.callbacks.size,0);assert.equal(f.paints.size,0);f.controller.dispose();}
});
test('context loss, a failed fence and a renderer exception cannot become readiness',async()=>{
 for(const kind of ['lost','fence','draw']){const f=fixture();f.draw();const p=f.controller.prepare(new AbortController().signal);p.catch(()=>{});
  if(kind==='lost')f.setLost(true);if(kind==='fence')f.setStatus(f.gl.WAIT_FAILED);if(kind==='draw')f.setError(Error('draw failed'));
  if(kind==='draw')assert.throws(f.draw,/draw failed/);else f.draw();
  await assert.rejects(p);assert.notEqual(f.controller.snapshot.state,'ready');f.controller.dispose();}
});
test('resizing during the countdown renders a new surface, and exit returns ordinary rendering',async()=>{
 const f=fixture(),p=f.controller.prepare(new AbortController().signal);f.draw();f.paint();f.paint();await p;f.setCountdown(true);
 f.draw();assert.equal(f.calls.draw,1);f.canvas.width=844;f.draw();assert.equal(f.calls.draw,2);f.draw();assert.equal(f.calls.draw,2);
 f.controller.release();f.draw();assert.equal(f.calls.draw,3);f.controller.dispose();
});
test('disposal is idempotent and does not overwrite a later renderer or scene wrapper',async()=>{
 const f=fixture();f.draw();const later=()=>{};f.renderer.render=later;f.scene.onAfterRender=later;
 f.controller.dispose();f.controller.dispose();assert.equal(f.renderer.render,later);assert.equal(f.scene.onAfterRender,later);
 await assert.rejects(f.controller.prepare(new AbortController().signal),/disposed/);
});
test('integration freezes no clocks or physics and keeps input locked only during real preparation/countdown',async()=>{
 const s=await readFile(new URL('./islandTrials.ts',import.meta.url),'utf8');
 assert.match(s,/if \(this\.run && !this\.preparing\)/);
 assert.match(s,/else this\.run\.step\(seconds, actor, true\)/);
 assert(s.indexOf('await this.startPresentation.prepare')<s.indexOf('this.preparing = false; this.skipNext = true;'));
 assert.match(s,/get inputCaptureLocked\(\) \{ return this\.active && \(this\.preparing \|\| !this\.run/);
 assert.match(s,/this\.preparation\?\.abort\(\); this\.startPresentation\.release\(\)/);
 const helper=await readFile(new URL('./trialStartPresentation.ts',import.meta.url),'utf8');
 assert.doesNotMatch(helper,/\.finish\(|setAnimationLoop|Date\.now\s*=|performance\.now\s*=|dispatchEvent|localStorage|setPixelRatio|toDataURL/);
});

import {NatureViewSelection} from './natureViewSelection.ts';
test('nature detail primes normally then follows each real view without player/view double rebuilds',()=>{
 const calls=[],view=new NatureViewSelection((x,z)=>calls.push([x,z]));
 view.prepare(10,20);view.render(200,150);view.prepare(10,20);view.render(-200,30);view.prepare(10,20);
 assert.deepEqual(calls,[[10,20],[200,150],[-200,30]]);
});
test('invalid view coordinates cannot consume the valid startup fallback or poison the selector',()=>{
 const calls=[],view=new NatureViewSelection((x,z)=>calls.push([x,z]));
 view.render(NaN,20);view.prepare(1,2);view.render(3,Infinity);view.render(4,5);view.prepare(1,2);
 assert.deepEqual(calls,[[1,2],[4,5]]);
});
test('camera-based nature selection preserves original pools, near-count caps and six-metre hysteresis',async()=>{
 const s=await readFile(new URL('./nature.ts',import.meta.url),'utf8');
 assert.match(s,/args\[2\]\.getWorldPosition\(eye\);view\.render\(eye\.x,eye\.z\)/);
 assert.match(s,/before\.apply\(scene,args\)/);assert.match(s,/view\.prepare\(x,z\)/);
 assert.match(s,/Math\.hypot\(x-lastX,z-lastZ\)<6/);
 assert.match(s,/slice\(0,budget\.trees\)/);assert.match(s,/slice\(0,budget\.ground\)/);
 assert.match(s,/treeLodBlend\(Math\.hypot\(p\.x-x,p\.z-z\),budget\.treeRadius\)/);
});
