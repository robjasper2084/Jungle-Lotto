import test from 'node:test';
import assert from 'node:assert/strict';
import {RideProfileStats,type RideProfileFrame} from './rideProfileStats.ts';
import {NatureRenderProbe,type NatureRenderFrame} from './renderDiagnostics.ts';
function nature(refresh=false):NatureRenderFrame{const p=new NatureRenderProbe(()=>0);p.beginFrame(true);p.pass();if(refresh)p.refresh();p.pool(10,4);return p.finishFrame()!;}
const frame=(values:Partial<RideProfileFrame>={}):RideProfileFrame=>({dt:.1,times:[1,2,3,4,5],draws:10,triangles:100,textures:3,geometries:4,x:0,z:0,speed:2,place:'Bridge',eligible:true,hidden:false,nature:nature(),...values});
test('slow intervals keep current renderMs and identify the previous eligible profiled callback',()=>{
 const s=new RideProfileStats();s.sample(frame({times:[1,2,3,180,5],place:'Forest',x:1,nature:nature(true)}));
 s.sample(frame({dt:.4,times:[1,2,3,35,5],place:'Trail',x:2}));const r=s.report(),slow=r.slowFrames[0];
 assert.equal(slow.renderMs,35);assert.equal(slow.frameMs,400);assert.equal(slow.previousEligibleCallback?.renderMs,180);assert.equal(slow.previousEligibleCallback?.place,'Forest');assert.equal(slow.previousEligibleCallback?.x,1);assert.equal(slow.previousEligibleCallback?.sample,1);
 assert.equal(r.renderDiagnostics?.topRenderWork[0].place,'Forest');assert.equal(r.renderDiagnostics?.callbacksWithSelectionRefresh.frames,1);assert.equal(r.renderDiagnostics?.callbacksWithoutSelectionRefresh.frames,1);
});
test('all interval/metric/location/diagnostic exclusions break the previous-callback association',()=>{
 const cases:Partial<RideProfileFrame>[]=[{dt:NaN},{dt:0},{hidden:true},{eligible:false},{x:NaN},{speed:NaN},{times:[1,2,3,NaN,5]},{nature:undefined},{nature:{...nature(),captureCpuMs:Infinity}},{nature:{...nature(),invalidObservations:1}}];
 for(const value of cases){const s=new RideProfileStats();s.sample(frame({place:'Before'}));s.sample(frame(value));s.sample(frame({dt:.5,place:'After'}));const slow=s.report().slowFrames.find(row=>row.place==='After')!;assert.equal(slow.previousEligibleCallback,null,JSON.stringify(value));}
 for(const boundary of ['breakCallback','breakPosition'] as const){const s=new RideProfileStats();s.sample(frame());s[boundary]();s.sample(frame({dt:.5,place:'After'}));assert.equal(s.report().slowFrames[0].previousEligibleCallback,null);}
});
test('diagnostic inputs and returned reports cannot mutate retained previous/top work rows',()=>{
 const s=new RideProfileStats(),input=nature(true);s.sample(frame({nature:input,place:'Before',times:[1,2,3,180,5]}));input.selectionRefreshes=99;
 s.sample(frame({dt:.4,place:'After'}));let r=s.report();assert.equal(r.slowFrames[0].previousEligibleCallback?.nature.selectionRefreshes,1);
 r.slowFrames[0].previousEligibleCallback!.nature.selectionRefreshes=55;r.renderDiagnostics!.topRenderWork[0].nature.selectionRefreshes=66;
 r=s.report();assert.equal(r.slowFrames[0].previousEligibleCallback?.nature.selectionRefreshes,1);assert.equal(r.renderDiagnostics?.topRenderWork[0].nature.selectionRefreshes,1);
});
test('render work rows are capped at 100 independently of retained interval samples',()=>{
 const s=new RideProfileStats({frames:2,slowFrames:1});for(let i=1;i<=300;i++)s.sample(frame({dt:.02,times:[1,2,3,i,5],x:i*.01,place:String(i)}));
 const r=s.report();assert.equal(r.frames,300);assert.equal(r.sampledFrames,2);assert.equal(r.renderDiagnostics?.profiledCallbacks,300);assert.equal(r.renderDiagnostics?.topRenderWork.length,100);assert.equal(r.renderDiagnostics?.topRenderWork[0].renderMs,300);assert.equal(r.renderDiagnostics?.topRenderWork[99].renderMs,201);
});
test('additive diagnostics leave all original accepted-frame metrics and scores identical',()=>{
 const plain=new RideProfileStats({frames:3,slowFrames:3}),observed=new RideProfileStats({frames:3,slowFrames:3});
 const sequence=[frame({dt:.2,x:0}),frame({dt:3.2,x:1,times:[1,2,3,100,5]}),frame({eligible:false,dt:2}),frame({hidden:true,dt:5}),frame({dt:NaN}),frame({dt:.3,x:2,times:[NaN,-1,3,4,5]}),frame({dt:.4,x:3})];
 for(const f of sequence){assert.equal(observed.sample(f),plain.sample({...f,nature:undefined}));}
 const original=(r:ReturnType<RideProfileStats['report']>)=>{const {renderDiagnostics,...rest}=r;return {...rest,slowFrames:rest.slowFrames.map(({nature,previousEligibleCallback,...old})=>old)};};
 assert.deepEqual(original(observed.report()),original(plain.report()));
});
