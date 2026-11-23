import test from 'node:test';
import assert from 'node:assert/strict';
import {RideProfileStats,type RideProfileFrame} from './rideProfileStats.ts';
import {NatureRenderProbe} from './renderDiagnostics.ts';
import {createEmptyRenderSubmissionFrame,type RenderSubmissionFrame} from './renderSubmissionDiagnostics.ts';

function nature(){const p=new NatureRenderProbe(()=>0);p.beginFrame(true);p.pass();p.refresh();p.pool(10,4);return p.finishFrame()!;}
function submission(cost=20,label='tree'):RenderSubmissionFrame{
 const value=createEmptyRenderSubmissionFrame();
 value.operations.directDraw={calls:2,cpuMs:cost,maxCpuMs:cost*.75,outsideDirectCalls:0,outsideDirectCpuMs:0};
 value.operations.bufferData={calls:1,cpuMs:3,maxCpuMs:3,outsideDirectCalls:1,outsideDirectCpuMs:3};
 value.operations.programLink={calls:1,cpuMs:5,maxCpuMs:5,outsideDirectCalls:0,outsideDirectCpuMs:0};
 value.topDirectDraws=[{cpuMs:cost*.75,objectId:10,object:label,parentId:11,parent:'world',geometryId:12,materialId:13,material:'leaf',materialType:'MeshStandardMaterial'}];
 return value;
}
const frame=(values:Partial<RideProfileFrame>={}):RideProfileFrame=>({dt:.1,times:[1,2,3,40,5],draws:10,triangles:100,textures:3,geometries:4,x:0,z:0,speed:2,place:'Bridge',eligible:true,hidden:false,nature:nature(),submission:submission(),...values});

test('submission totals retain inclusive scopes and outside-direct values separately',()=>{
 const s=new RideProfileStats();s.sample(frame());s.sample(frame({submission:submission(40),dt:.2}));
 const r=s.report(),summary=r.submissionDiagnostics!;
 assert.equal(summary.profiledCallbacks,2);assert.equal(summary.invalidDiagnosticSamples,0);
 assert.deepEqual(summary.operations.directDraw,{calls:4,cpuMs:60,maxCallCpuMs:30,maxFrameCpuMs:40,outsideDirectCalls:0,outsideDirectCpuMs:0,maxOutsideDirectFrameCpuMs:0});
 assert.equal(summary.operations.bufferData.cpuMs,6);assert.equal(summary.operations.bufferData.outsideDirectCpuMs,6);
 assert.equal(summary.operations.programLink.cpuMs,10);assert.equal(summary.operations.programLink.outsideDirectCpuMs,0);
 assert.match(summary.note,/do not sum/);assert.match(summary.note,/not GPU execution time/);
 assert.equal(r.metrics.renderSubmitCpuMs!.mean,40);
});

test('slow intervals and top render work retain the correct current and previous submission',()=>{
 const s=new RideProfileStats();s.sample(frame({place:'Before',x:1,times:[1,2,3,180,5],submission:submission(150,'slow-material')}));
 s.sample(frame({dt:.4,place:'After',x:2,times:[1,2,3,35,5],submission:submission(20,'next-material')}));
 const r=s.report(),slow=r.slowFrames[0],previous=slow.previousEligibleCallback!;
 assert.equal(slow.frameMs,400);assert.equal(slow.renderMs,35);assert.equal(slow.submission!.topDirectDraws[0].object,'next-material');
 assert.equal(previous.sample,1);assert.equal(previous.place,'Before');assert.equal(previous.renderMs,180);assert.equal(previous.submission!.operations.directDraw.cpuMs,150);
 assert.equal(r.renderDiagnostics!.topRenderWork[0].submission!.topDirectDraws[0].object,'slow-material');
});

test('submission inputs and returned report objects cannot mutate retained evidence',()=>{
 const s=new RideProfileStats(),input=submission(150,'original');
 s.sample(frame({dt:.3,place:'Before',times:[1,2,3,180,5],submission:input}));
 input.operations.directDraw.cpuMs=999;input.topDirectDraws[0].object='changed input';
 s.sample(frame({dt:.4,place:'After'}));
 let r=s.report();assert.equal(r.slowFrames[0].previousEligibleCallback!.submission!.operations.directDraw.cpuMs,150);
 r.slowFrames[0].previousEligibleCallback!.submission!.topDirectDraws[0].object='changed report';
 r.slowFrames[1].submission!.operations.directDraw.cpuMs=888;
 r.renderDiagnostics!.topRenderWork[0].submission!.operations.bufferData.cpuMs=999;
 r.submissionDiagnostics!.operations.directDraw.cpuMs=777;
 r=s.report();assert.equal(r.slowFrames[0].previousEligibleCallback!.submission!.topDirectDraws[0].object,'original');
 assert.equal(r.slowFrames[1].submission!.operations.directDraw.cpuMs,150);
 assert.equal(r.renderDiagnostics!.topRenderWork[0].submission!.operations.bufferData.cpuMs,3);
 assert.equal(r.submissionDiagnostics!.operations.directDraw.cpuMs,170);
});

function withoutSubmission(value:unknown):unknown{
 if(Array.isArray(value))return value.map(withoutSubmission);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='submission'&&key!=='submissionDiagnostics').map(([key,item])=>[key,withoutSubmission(item)]));
 return value;
}
test('missing or malformed submission observations preserve original metrics and nature associations',()=>{
 const plain=new RideProfileStats({frames:3,slowFrames:3}),observed=new RideProfileStats({frames:3,slowFrames:3});
 const bad=submission();bad.operations.bufferData.cpuMs=NaN;
 const clockFault=submission();clockFault.invalidObservations=1;
 const sequence=[frame({dt:.2,x:0}),frame({dt:3.2,x:1}),frame({eligible:false,dt:2}),frame({hidden:true,dt:5}),frame({dt:NaN}),frame({dt:.3,x:2,times:[NaN,-1,3,4,5]}),frame({dt:.4,x:3,submission:bad}),frame({dt:.5,x:4,submission:clockFault}),frame({dt:.6,x:5,submission:undefined}),frame({dt:.7,x:6})];
 for(const f of sequence)assert.equal(observed.sample(f),plain.sample({...f,submission:undefined}));
 assert.deepEqual(withoutSubmission(observed.report()),withoutSubmission(plain.report()));
 assert.equal(observed.report().submissionDiagnostics!.profiledCallbacks,3);
 assert.equal(observed.report().submissionDiagnostics!.invalidDiagnosticSamples,3);
});

test('invalid submission is explicit while the valid preceding nature callback stays associated',()=>{
 const s=new RideProfileStats(),bad=submission();bad.invalidObservations=1;
 s.sample(frame({place:'Before',submission:bad}));s.sample(frame({dt:.4,place:'After'}));
 const r=s.report();assert.equal(r.slowFrames[0].previousEligibleCallback!.place,'Before');
 assert.equal(r.slowFrames[0].previousEligibleCallback!.submission,null);
 assert.equal(r.renderDiagnostics!.profiledCallbacks,2);assert.equal(r.submissionDiagnostics!.profiledCallbacks,1);assert.equal(r.submissionDiagnostics!.invalidDiagnosticSamples,1);
});

test('submission evidence shares bounded lists and totals cover all valid eligible callbacks',()=>{
 const s=new RideProfileStats({frames:2,slowFrames:1});
 for(let i=1;i<=300;i++)s.sample(frame({dt:.2,times:[1,2,3,i,5],x:i*.01,place:String(i),submission:submission(i)}));
 const r=s.report();assert.equal(r.sampledFrames,2);assert.equal(r.slowFrames.length,1);assert.equal(r.renderDiagnostics!.topRenderWork.length,100);
 assert.equal(r.submissionDiagnostics!.profiledCallbacks,300);assert.equal(r.submissionDiagnostics!.operations.directDraw.cpuMs,45150);
 assert.equal(r.renderDiagnostics!.topRenderWork[0].submission!.operations.directDraw.cpuMs,300);
 assert.equal(r.renderDiagnostics!.topRenderWork[99].submission!.operations.directDraw.cpuMs,201);
});

test('exclusions and explicit breaks never associate a stale submission across callbacks',()=>{
 for(const boundary of [{eligible:false},{hidden:true},{dt:NaN},{x:NaN},{nature:undefined}] as Partial<RideProfileFrame>[]){
  const s=new RideProfileStats();s.sample(frame({place:'Before'}));s.sample(frame(boundary));s.sample(frame({dt:.5,place:'After'}));
  assert.equal(s.report().slowFrames.find(row=>row.place==='After')!.previousEligibleCallback,null);
 }
 for(const method of ['breakCallback','breakPosition'] as const){
  const s=new RideProfileStats();s.sample(frame());s[method]();s.sample(frame({dt:.5}));assert.equal(s.report().slowFrames[0].previousEligibleCallback,null);
 }
});
