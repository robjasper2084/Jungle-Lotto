import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:[fileURLToPath(new URL('./rideProfile.ts',import.meta.url))],bundle:true,write:false,platform:'node',format:'esm',logLevel:'error'});
const {RideProfile}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
// Isolated DOM ownership tests; real hit-testing remains in the Chrome smoke test.
class Element {constructor(tag){this.tagName=tag;this.children=[];this.style={};this.hidden=false;this.open=false;this.attributes={};}append(child){this.children.push(child);child.parentElement=this;}setAttribute(k,v){this.attributes[k]=v;}click(){this.clicked=true;}remove(){if(this.parentElement)this.parentElement.children.splice(this.parentElement.children.indexOf(this),1);}}
function fixture(hasSettings=true,readSettings=()=>({quality:'automatic'}),context={}){const settings=new Element('dialog'),body=new Element('body');globalThis.document={hidden:false,createElement:t=>new Element(t),getElementById:id=>id==='settings'&&hasSettings?settings:null,addEventListener:()=>{},body};Object.assign(globalThis,{innerWidth:390,innerHeight:844,devicePixelRatio:1});const profile=new RideProfile(readSettings,context);const panel=settings.children[0];return{profile,panel,settings,body};}
test('diagnostics are nested in Settings instead of appended over the playfield',()=>{const f=fixture();assert.equal(f.panel.id,'ride-profile');assert.equal(f.panel.parentElement,f.settings);assert.equal(f.body.children.length,0);assert.doesNotMatch(f.panel.style.cssText,/position:fixed|z-index|bottom:/);});
test('diagnostics retain accessible summary and non-submitting 44px capture button',()=>{const {panel}=fixture();const [summary,button]=panel.children;assert.match(summary.style.cssText,/min-height:44px/);assert.equal(button.type,'button');assert.equal(button.style.minHeight,'44px');});
test('capture starts through the existing button and collapses only its own details',()=>{const {profile,panel}=fixture();panel.open=true;panel.children[1].onclick();assert.equal(profile.enabled,true);assert.equal(panel.open,false);assert.equal(panel.children[1].textContent,'Stop and show report');});
test('stop preserves the complete report and responsive text area',()=>{const {profile,panel}=fixture();panel.children[1].onclick();profile.sample(.1,[1,2,3,4,5],12,120,5,3,0,0,2,'fixture',true);panel.children[1].onclick();assert.equal(profile.enabled,false);assert.equal(panel.open,true);const output=panel.children[2];assert.equal(output.hidden,false);assert.equal(output.readOnly,true);assert.match(output.style.cssText,/width:100%;max-width:100%/);const report=JSON.parse(output.value);assert.equal(report.frames,1);assert.equal(report.activeSeconds,.1);assert.deepEqual(report.settings,{quality:'automatic'});});
test('a missing Settings host cannot introduce another blocking playfield overlay',()=>{const {body}=fixture(false);assert.equal(body.children.length,0);});
test('sampling stays disabled until deliberate capture',()=>{const {profile}=fixture();profile.sample(10,[1,2,3,4,5],12,120,5,3,0,0,2,'fixture',true);assert.equal(profile.enabled,false);});
test('capture snapshots settings and diagnostics before mutable live state changes',()=>{
 const settings={quality:'smooth',world:{trees:12}},pacing={pendingFenceSkippedCallbacks:2};let build={status:'pending'};
 const {profile,panel}=fixture(true,()=>settings,{build:()=>build,gpuPacing:()=>pacing});profile.start();
 settings.world.trees=20;settings.quality='high';pacing.pendingFenceSkippedCallbacks=9;build={status:'available',marker:{baseCommit:'base',patchSha256:'patch'}};
 profile.sample(.25,[1,2,3,4,5],12,120,5,3,0,0,2,'fixture',true);profile.finish();
 const report=JSON.parse(panel.children[2].value);
 assert.deepEqual(report.settingsAtStart,{quality:'smooth',world:{trees:12}});assert.deepEqual(report.settings,settings);
 assert.deepEqual(report.buildAtStart,{status:'pending'});assert.deepEqual(report.build,build);
 assert.deepEqual(report.gpuFramePacing.atStart,{pendingFenceSkippedCallbacks:2});assert.deepEqual(report.gpuFramePacing.atFinish,{pendingFenceSkippedCallbacks:9});
 assert.equal(report.activeSeconds,.25);assert.equal(report.observedFPS,4);assert.match(report.gpuFramePacing.note,/not GPU execution timings/);
 profile.start();profile.finish();assert.equal(JSON.parse(panel.children[2].value).settingsAtStart.world.trees,20);
});
test('download exports exactly the completed report, uses a JSON filename and releases its URL',async()=>{
 const {profile,panel,body}=fixture(),download=panel.children[3];assert.equal(download.hidden,true);assert.equal(download.type,'button');assert.equal(download.style.minHeight,'44px');
 const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL,originalTimeout=globalThis.setTimeout;
 let blob,link,release,released;const append=body.append.bind(body);body.append=value=>{link=value;append(value);};
 try{
  URL.createObjectURL=value=>{blob=value;return 'blob:test-report';};URL.revokeObjectURL=value=>{released=value;};globalThis.setTimeout=callback=>{release=callback;return 0;};
  profile.start();profile.sample(.1,[1,2,3,4,5],12,120,5,3,0,0,2,'fixture',true);profile.finish();assert.equal(download.hidden,false);
  download.onclick();assert.equal(blob.type,'application/json;charset=utf-8');assert.equal(await blob.text(),panel.children[2].value);
  assert.equal(link.href,'blob:test-report');assert.match(link.download,/^belle-isle-ride-profile-.*\.json$/);assert.doesNotMatch(link.download,/:/);assert.equal(link.clicked,true);assert.equal(body.children.length,0);
  assert.equal(released,undefined);release();assert.equal(released,'blob:test-report');profile.start();assert.equal(download.hidden,true);
 }finally{URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;globalThis.setTimeout=originalTimeout;}
});

test('manual diagnostics reset on capture start, explicit callback breaks and capture stop',()=>{
 let resets=0;const {profile,panel}=fixture(true,()=>({quality:'smooth'}),{resetRenderDiagnostics:()=>resets++});
 const nature={renderPasses:1,selectionCpuMs:1,captureCpuMs:.5,cullCpuMs:.2,selectionRefreshes:1,captureCalls:4,farPoolViewCalls:4,farSourceInstancesAcrossViews:10,farSubmittedInstancesAcrossViews:5,compactions:4,captureAttributeMarks:2,captureBytesMarked:100,compactionAttributeMarks:2,compactionBytesMarked:50,invalidObservations:0};
 profile.start();assert.equal(resets,1);profile.sample(.1,[1,2,3,180,5],12,120,5,3,0,0,2,'before',true,nature);profile.breakFrameAssociation();assert.equal(resets,2);profile.sample(.4,[1,2,3,30,5],12,120,5,3,1,0,2,'after',true,nature);profile.finish();assert.equal(resets,3);
 let report=JSON.parse(panel.children[2].value);assert.equal(report.version,6);assert.equal(report.slowFrames[0].previousEligibleCallback,null);assert.equal(report.renderDiagnostics.profiledCallbacks,2);
 profile.start();profile.sample(.4,[1,2,3,20,5],12,120,5,3,1,0,2,'new capture',true,nature);profile.finish();report=JSON.parse(panel.children[2].value);assert.equal(resets,5);assert.equal(report.frames,1);assert.equal(report.slowFrames[0].previousEligibleCallback,null);
});

test('submission hook coverage is snapshotted at both capture boundaries',()=>{
 const coverage={installed:true,status:'partial',hooks:[{name:'bufferData',status:'installed'}],notes:['CPU only']};
 const {profile,panel}=fixture(true,()=>({quality:'smooth'}),{submissionCoverage:()=>coverage});
 profile.start();coverage.status='disposed';coverage.hooks[0].status='failed';
 profile.sample(.1,[1,2,3,4,5],12,120,5,3,0,0,2,'fixture',true);profile.finish();
 const report=JSON.parse(panel.children[2].value);
 assert.equal(report.version,6);assert.equal(report.submissionInstrumentation.atStart.status,'partial');
 assert.equal(report.submissionInstrumentation.atStart.hooks[0].status,'installed');
 assert.equal(report.submissionInstrumentation.atFinish.status,'disposed');assert.equal(report.submissionInstrumentation.atFinish.hooks[0].status,'failed');
 assert.match(report.submissionInstrumentation.note,/not GPU execution timings/);
 assert.equal(report.frames,1);assert.equal(report.activeSeconds,.1);
});
