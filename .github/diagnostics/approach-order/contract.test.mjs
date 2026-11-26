import assert from 'node:assert/strict';
import test from 'node:test';
import {analyze,compareDraws,validateCorrectnessCase,proofIdentity,PROOF_ORDER,MEASURED_ORDER,CASE_NAMES} from './contract.mjs';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {pins} from './provenance.mjs';
const clone=x=>structuredClone(x);
function fixture(factor=1){
 const result={applicationSource:pins.applicationSource,gpu:'ANGLE Metal',viewport:[1280,800,1],errors:[],queries:{available:true,created:240,resolved:240,deleted:240,live:0,disjoint:false,rows:[]},cases:[]};
 let id=0,frame=0;
 for(let index=0;index<14;index++){
  const quality=index<12?'smooth':'high',night=index<12?index%2===1:index===12,name=CASE_NAMES[index];
  const camera={world:clone(pins.observation.camera.matrixWorld),view:[1,0,0,1],projection:clone(pins.observation.camera.projectionMatrix)};
  const settings={viewport:[1280,800,1],quality,effectiveQuality:quality,scale:1,hour:night?22:13,artStyle:'authentic',sourceQualityPixelRatio:1,fixturePixelRatio:1,fixedResolutionOverride:false,simulationTime:12+index,
   context:{alpha:true,antialias:true,depth:true,stencil:false,preserveDrawingBuffer:false},shadow:{enabled:quality==='high',type:1},outputColorSpace:'srgb',toneMapping:4,exposure:1.02};
  const targets=[10,11],context={sky:{id:8,order:-100},mainland:[{id:9,order:0}],targets:targets.map(id=>({id}))};
  const owners=targets.map(id=>({id,vertices:1353,indices:7680,renderOrder:0,castShadow:false,receiveShadow:true}));
  const draw=(object,order,pass='color')=>({object,name:'object-'+object,geometry:object+100,material:'material-'+object,pass,camera:pass==='shadow'?2:1,order,start:0,count:300,calls:1,triangles:100,lines:0,points:0});
  const shadows=quality==='high'?[draw(40,0,'shadow')]:[];
  const base=[draw(7,-102),draw(8,-100),draw(9,0),...targets.map(id=>draw(id,0)),draw(12,0)];
  const candidate=[...targets.map(id=>draw(id,-103)),draw(7,-102),draw(8,-100),draw(9,0),draw(12,0)];
  const receipt=mode=>({mode,frameBefore:frame++,frameAfter:frame,camera:clone(camera),settings:clone(settings),draws:clone(mode==='baseline'?base:candidate)});
  const pose={name:name.startsWith('real-road')?'real-road-occlusion':name.split('-day')[0]};
  if(pose.name==='real-road-occlusion')pose.occlusion={front:{id:12,distance:2,name:'Joined island pavement · asphalt',ownerKind:'source-asphalt-road',effectiveVisible:true,materials:[{name:'Island asphalt',surface:'asphalt',visible:true}]},approach:{id:10,distance:3}};
  const nativePreparation={...receipt('baseline'),draws:clone([...shadows,...base]),shadowMaps:quality==='high'?[{castShadow:true,intensity:1,requestedSize:[2048,2048],allocatedSize:[2048,2048]}]:[]};
  const c={index,name,timing:index<12,night,quality,camera,settings,context,owners,pose,nativePreparation,proof:PROOF_ORDER.map((mode,i)=>({...receipt(mode),index:i,pixelSha256:'a'.repeat(64),difference:{pixels:0,maxChannelDelta:0},content:{nonzeroRgbPixels:1280*800,distinctColorsAtLeast:32,readback:'same-task before compositor yield'}})),samples:[]};
  if(c.timing)c.correctnessGate={passed:true,authorized:true,caseIndex:index,caseName:name,queriesBefore:index*20,independentPngRgba:true,drawConserved:true,baselineRestored:true,proofIdentity:proofIdentity(c),error:null};
  if(c.timing)for(const [phase,order]of [['warmup',PROOF_ORDER],['measured',MEASURED_ORDER]])for(const [i,mode]of order.entries()){
   const q={id:id++,case:name,mode,phase,index:i,status:'resolved',nanoseconds:mode==='candidate'?1e6*factor:1e6};result.queries.rows.push(q);c.samples.push({...receipt(mode),query:q});
  }
  result.cases.push(c);
 }
 return result;
}
test('complete improvements, neutral results and regressions all remain diagnostic evidence',()=>{
 for(const factor of [.8,1,1.2]){const r=analyze(fixture(factor));assert.equal(r.complete,true,JSON.stringify(r.errors));assert.equal(r.losslessAcrossRecordedCases,true);assert.equal(r.releaseAcceptance,false);assert.equal(r.cases[0].pairedDeltaPercent.all.length,8);assert(Math.abs(r.cases[0].pairedDeltaPercent.mean-(factor-1)*100)<1e-8);}
});
test('pixel differences, baseline drift, omitted images and altered pose/context fail closed',()=>{
 const edits=[r=>r.cases[0].proof[1].difference.pixels=1,r=>r.cases[0].proof[3].pixelSha256='b'.repeat(64),r=>r.cases[0].proof.pop(),
  r=>r.cases[0].camera.world[12]++,r=>r.cases[0].context.mainland[0].order=-102,r=>r.cases[0].settings.viewport[0]=640,
  r=>r.cases[12].settings.shadow.enabled=false,r=>r.cases[10].pose.occlusion.front.id=10,r=>r.cases[0].proof[0].content.nonzeroRgbPixels=0];
 for(const edit of edits){const r=fixture();edit(r);assert.equal(analyze(r).complete,false);}
});
test('an extra pass, omitted work, changed geometry/material or another reordered object is rejected',()=>{
 for(const edit of [r=>r.cases[0].proof[1].draws.pop(),r=>r.cases[0].proof[1].draws[0].geometry++,
  r=>r.cases[0].proof[1].draws[0].material='replacement',r=>r.cases[0].proof[1].frameAfter++,
  r=>r.cases[12].proof[1].draws[2].order=-103,r=>r.cases[0].proof[1].draws.reverse()]){const r=fixture();edit(r);assert.equal(analyze(r).complete,false);}
});
test('missing, duplicated, reassigned, disjoint or live elapsed queries cannot be interpreted',()=>{
 const edits=[r=>r.queries.live=1,r=>r.queries.disjoint=true,r=>r.queries.rows.pop(),r=>r.cases[0].samples.pop(),
  r=>r.cases[0].samples[4].query.id=0,r=>r.cases[0].samples[4].query.nanoseconds=0,
  r=>r.cases[0].samples[4].query.phase='warmup',r=>r.queries.rows[4]=clone(r.queries.rows[5])];
 for(const edit of edits){const r=fixture();edit(r);assert.equal(analyze(r).complete,false);}
});
test('balanced sample order and exact untouched alternative draw sequence are required',()=>{
 const r=fixture();[r.cases[0].samples[5],r.cases[0].samples[7]]=[r.cases[0].samples[7],r.cases[0].samples[5]];assert.equal(analyze(r).complete,false);
 const c=fixture().cases[0];assert.doesNotThrow(()=>compareDraws(c.proof[0].draws,c.proof[1].draws,[10,11]));
 const changed=clone(c.proof[1].draws);[changed[3],changed[4]]=[changed[4],changed[3]];assert.throws(()=>compareDraws(c.proof[0].draws,changed,[10,11]),/Non-approach/);
});
test('native preparation shadows, effective road visibility and distinct source times are required',()=>{
 const edits=[r=>delete r.cases[0].nativePreparation,r=>r.cases[12].nativePreparation.draws.splice(0,1),r=>r.cases[13].nativePreparation.shadowMaps[0].allocatedSize=null,
  r=>r.cases[10].pose.occlusion.front.name='decorative box',r=>r.cases[10].pose.occlusion.front.effectiveVisible=false,
  r=>{const c=r.cases[13];for(const settings of [c.settings,c.nativePreparation.settings,...c.proof.map(p=>p.settings)])settings.simulationTime=12;},
  r=>{const c=r.cases[10];for(const row of [c.nativePreparation,...c.proof,...c.samples])row.draws=row.draws.filter(d=>d.object!==12);},
  r=>r.cases[0].proof[0].frameBefore++];
 for(const edit of edits){const r=fixture();edit(r);assert.equal(analyze(r).complete,false);}
 const sw=fixture();sw.gpu='ANGLE SwiftShader';for(const c of sw.cases.filter(c=>c.quality==='high'))for(const settings of [c.settings,c.nativePreparation.settings,...c.proof.map(r=>r.settings)]){settings.sourceQualityPixelRatio=.7;settings.fixedResolutionOverride=true;}
 assert.equal(analyze(sw).complete,true,'Source-selected software DPR is distinct from the fixed fixture DPR');
});
function pendingCase(index=0){
 const r=fixture();r.cases=r.cases.slice(0,index+1);const c=r.cases[index];c.samples=[];delete c.correctnessGate;c.proofPassed=true;
 const count=Math.min(index,12)*20;r.queries.rows=r.queries.rows.slice(0,count);for(const key of ['created','resolved','deleted'])r.queries[key]=count;
 const captures=c.proof.map(p=>({case:c.name,index:p.index,mode:p.mode,file:p.index+'.png',rawFile:p.index+'.rgba',pixelSha256:p.pixelSha256,pngSha256:'b'.repeat(64),difference:clone(p.difference),independentDifference:{pixels:0,maxChannelDelta:0},
  encoding:{rawSha256:p.pixelSha256,pngSha256:'b'.repeat(64),decodedRgbaSha256:'c'.repeat(64),width:1280,height:800}}));
 return {r,c,captures};
}
test('independent current-case gate requires all four decoded captures and the original draw/restoration proof before timing',()=>{
 for(const index of [0,1,11,12,13]){const f=pendingCase(index),v=validateCorrectnessCase(f.r,index,f.captures);assert.equal(v.passed,true,v.error);assert.equal(v.queriesBefore,Math.min(index,12)*20);}
 for(const mutate of [f=>f.c.proof[1].difference.pixels=1,f=>f.c.proof[3].pixelSha256='d'.repeat(64),f=>f.c.proof[1].draws.pop(),
  f=>f.captures[1].independentDifference.maxChannelDelta=1,f=>delete f.captures[1].encoding,f=>f.captures[2].encoding.decodedRgbaSha256='d'.repeat(64),
  f=>f.captures.pop(),f=>f.r.queries.created++,f=>f.c.samples.push({}),f=>f.c.proof[3].draws.reverse()]){
  const f=pendingCase();mutate(f);assert.equal(validateCorrectnessCase(f.r,0,f.captures).passed,false);
 }
});
test('a later rejected case retains earlier proven timings while remaining ineligible overall',()=>{
 const f=pendingCase(1),prior=clone(f.r.queries);f.captures[2].independentDifference.pixels=1;
 assert.equal(validateCorrectnessCase(f.r,1,f.captures).passed,false);assert.deepEqual(f.r.queries,prior);assert.equal(prior.created,20);assert.equal(analyze(f.r).complete,false);
});
test('final interpretation rejects missing, stale or incomplete correctness authorization',()=>{
 for(const edit of [r=>delete r.cases[0].correctnessGate,r=>r.cases[0].correctnessGate.caseIndex=1,r=>r.cases[0].correctnessGate.proofIdentity[0].pixelSha256='e'.repeat(64),r=>r.cases[0].correctnessGate.independentPngRgba=false]){
  const r=fixture();edit(r);assert.equal(analyze(r).complete,false);
 }
});
// Exercise the actual browser gate/measure functions with a synthetic GL
// allocator. No native browser or GPU timing result is claimed by these tests.
function browserGateHarness(c){
 const source=readFileSync(new URL('./browser.ts',import.meta.url),'utf8');
 const gates=source.slice(source.indexOf('function proofIdentity(){'),source.indexOf('const ready=(async()=>'));
 const timing=source.slice(source.indexOf('async function timing(){'),source.indexOf('const wrap='));
 let allocations=0;const evidence={errors:[],queries:{created:0,resolved:0,deleted:0,live:0,rows:[],disjoint:false}};
 const context={currentCase:clone(c),evidence,queryId:0,same:(a,b)=>JSON.stringify(a)===JSON.stringify(b),check:(ok,message)=>{if(!ok)throw Error(message);},
  errorText:String,mode:'baseline',setMode(value){context.mode=value;},draw:()=>({mode:context.mode}),fence:async()=>{},performance:{now:()=>0},setTimeout,
  ext:{TIME_ELAPSED_EXT:1,GPU_DISJOINT_EXT:2},gl:{QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,getParameter:()=>false,
   createQuery:()=>{allocations++;return{};},beginQuery(){},endQuery(){},getQueryParameter:(_q,kind)=>kind===3?true:1000,deleteQuery(){}}};
 const api=runInNewContext(stripTypeScriptTypes(gates+timing+'\n({authorizeTiming,timing,measure})',{mode:'strip'}),context);
 return {api,context,allocations:()=>allocations};
}
test('actual browser query allocator is unreachable for missing, failed or stale proof authorization',async()=>{
 const mutations=[null,f=>f.c.proofPassed=false,f=>f.verdict.caseIndex=1,f=>f.verdict.independentPngRgba=false,f=>f.verdict.proofIdentity[0].pixelSha256='f'.repeat(64)];
 for(const edit of mutations){
  const f=pendingCase();f.verdict=validateCorrectnessCase(f.r,0,f.captures);edit?.(f);const h=browserGateHarness(f.c);
  if(edit)assert.throws(()=>h.api.authorizeTiming(f.verdict));
  await assert.rejects(h.api.timing(),/correctness|authorization|proof/i);await assert.rejects(h.api.measure('baseline','warmup',0),/correctness|authorization|proof/i);assert.equal(h.allocations(),0);
 }
});
test('actual browser passing gate preserves exactly the original 4 warmups and 16 balanced measurements',async()=>{
 const f=pendingCase(),verdict=validateCorrectnessCase(f.r,0,f.captures),h=browserGateHarness(f.c);
 h.api.authorizeTiming(verdict);await h.api.timing();assert.equal(h.allocations(),20);assert.equal(h.context.evidence.queries.created,20);assert.equal(h.context.evidence.queries.deleted,20);
 assert.deepEqual(Array.from(h.context.currentCase.samples,s=>s.query.mode),[...PROOF_ORDER,...MEASURED_ORDER]);
 await assert.rejects(h.api.timing(),/only once/);assert.equal(h.allocations(),20);
});
