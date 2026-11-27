import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {nativeTypeaheadPlan} from './native-select-typeahead.mjs';
import {sites,views,retainedNames,legacyExteriorNames,viewportFor,sha256,assertObservedCamera,assertCameraMatch,assertModeInventory,
 assertNativeRoute,assertCapture,assertModeReport,compareReports,verifyCapturePng,assertGeneratedTimingChange} from './staged-landmark-comparison-contract.mjs';

const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const copy=structuredClone;
function camera(uuid='camera'){
 const world=[...identity];world[12]=1363.78;world[13]=3.55;world[14]=1167.42;
 const inverse=[...identity];inverse[12]=-world[12];inverse[13]=-world[13];inverse[14]=-world[14];
 const result={id:7,uuid,type:'PerspectiveCamera',name:'',matrixWorld:world,matrixWorldInverse:inverse,projectionMatrix:[...identity],
  projectionMatrixInverse:[...identity],position:world.slice(12,15),projection:{fov:55,aspect:1.6,near:.1,far:5000,zoom:1},gpu:{}};
 for(const [key,values] of [['viewMatrix',inverse],['projectionMatrix',identity],['cameraPosition',result.position]]){
  const floats=new Float32Array(values);result.gpu[key]=Array.from(floats);result.gpu[key+'Bits']=Array.from(new Uint32Array(floats.buffer));
 }
 return result;
}
const boundary=()=>({kind:'one-shot-native-pass-boundary',atMs:50,afterSequence:2,afterRendererFrame:2,preparationInvalidPasses:0});
function observed(mode='default',sequence=8){
 const nodes=retainedNames.map((name,i)=>({name:name.replaceAll(' ','_'),id:100+i,worldVisible:true}));
 if(mode==='default')for(const name of legacyExteriorNames)nodes.push({name:name.replaceAll(' ','_'),worldVisible:true});
 else for(const [index,site] of sites.entries()){
  const id=200+index;nodes.push({name:site.id+'_STAGED_LODS',id,worldVisible:true});
  for(let level=0;level<3;level++)nodes.push({name:site.id+'_STAGED_LOD'+level,parentId:id,worldVisible:level===0});
 }
 const count={calls:12,triangles:2471,lines:0,points:0},zero={calls:0,triangles:0,lines:0,points:0},cam=camera(mode+'-camera');
 const latest={valid:true,sequence,observationPhase:'capture',issues:[],scene:{uuid:mode+'-scene'},camera:cam,postCamera:copy(cam),
  colorDirectInvocations:5,colorSubmitted:count,shadowSubmitted:zero,otherSubmitted:zero,counters:copy(count),nativeEndTotals:copy(count)};
 return{ready:true,fresh:true,invalidPasses:0,captureInvalidPasses:0,captureWindow:boundary(),firstInvalidPasses:[],firstCaptureInvalidPasses:[],
  coverage:{renderer:true,render:true,direct:true,currentRenderHook:true,currentDirectHook:true},errors:[],inventory:{overflow:false,nodes},latest,
  history:Array.from({length:6},(_,index)=>({...copy(latest),sequence:sequence-5+index}))};
}
function nativeEvidence(layout='desktop'){
 const events=[{type:'click',target:'#start'}];
 for(const site of sites)for(const text of [site.travel,site.explore])events.push({type:'click',text,landmark:site.name});
 for(const code of ['KeyF','KeyV'])for(const type of ['keydown','keyup'])events.push({type,code});
 for(const [target,value] of [['#sky-preset','12'],['#sky-clouds','clear'],['#quality',layout==='phone'?'smooth':'high'],['#fps',layout==='phone'?'30':'60']])
  for(const type of ['input','change'])events.push({type,target,value});
 return{events:events.map(event=>({...event,trusted:true,at:event.target==='#start'||['input','change'].includes(event.type)?10:100})),overflow:false,held:[],focusLossDuringInput:[]};
}
function capture(mode,view,layout='desktop'){
 const viewport=viewportFor(layout);
 return{id:view.id,site:view.site,viewport,firstPerson:view.firstPerson,rideMode:view.rideMode,file:view.id+'.png',sha256:'a'.repeat(64),bytes:50000,
  gpu:{gpuFence:true,paintOpportunities:2,renderer:'ANGLE (Apple, Apple M1, Metal)',...viewport},
  settings:{focused:true,visible:true,reducedMotion:true,startupMotion:true,skyCycle:false,skyHour:12,clouds:'clear',quality:layout==='phone'?'smooth':'high',
   effectiveQuality:layout==='phone'?'smooth':'high',fps:layout==='phone'?'30':'60',devicePixelRatio:1,innerWidth:viewport.width,innerHeight:viewport.height,
   contextAttributes:{antialias:true},antiAliasing:'fxaa',adaptiveScale:1,renderPixelRatio:1,effectiveFrameCap:layout==='phone'?30:60},
  before:observed(mode),after:observed(mode,9)};
}
function sourceAssets(){
 const names=[['107227742','Aquarium_Arched_Entrance_Study'],['107310050','Conservatory_Architectural_Study'],['9146545','Scott_Fountain_Terraces_Study'],['107230534','Conservatory_Drive_Street_Detail_Study']];
 return names.flatMap(([site,name])=>[0,1,2].map(lod=>({site,lod,file:name+(lod?'_LOD'+lod:'')+'.glb',sha256:'b'.repeat(64),bytes:1000+lod})))
  .sort((a,b)=>a.file.localeCompare(b.file));
}
function modeReport(mode='default',layout='desktop'){
 const assets=sourceAssets(),sourceSha='c'.repeat(40),sourceTree='d'.repeat(40);
 return{passed:true,mode,layout,sourceSha,sourceTree,sourceAssets:assets,browser:'Chrome 142.0.0.0',errors:[],failedRequests:[],nativeEvidence:nativeEvidence(layout),captureWindow:boundary(),
  build:{sourceSha,sourceTree,mode,flag:mode==='staged'?'1':'0',sourceAssets:copy(assets),builtStagedAssets:mode==='staged'?copy(assets):[],
   stagedManifestPresent:mode==='staged',generatedTiming:{onlyBuildMsChanged:true,restoredOriginalBytes:true},indexSha256:'e'.repeat(64),assetManifestSha256:'f'.repeat(64),compiled:[{file:'assets/index-test.js',sha256:'1'.repeat(64),bytes:7000}]},
  stagedRequests:mode==='staged'?assets.filter(a=>sites.some(s=>s.id===a.site)).map(a=>({...a,status:200})):[],captures:views.map(view=>capture(mode,view,layout))};
}
function rejected(change,pattern){
 const a=modeReport(),b=modeReport('staged');change(a,b);assert.throws(()=>compareReports(a,b),pattern);
}

test('six desktop and six compact-phone pairs require exact camera inputs while leaving human review open',()=>{
 for(const layout of ['desktop','phone']){
  const a=modeReport('default',layout),b=modeReport('staged',layout),result=compareReports(a,b);
  assert.equal(result.pairs.length,6);assert.equal(result.automatedEvidencePassed,true);assert.equal(result.manualVisualReviewRequired,true);
  for(const key of ['appearanceAccepted','visualOverlapAccepted','collisionAccepted','performanceAccepted'])assert.equal(result[key],null);
  assert.notEqual(a.captures[0].before.latest.camera.uuid,b.captures[0].before.latest.camera.uuid,'Cross-build allocation IDs are intentionally independent');
 }
});
test('one representable GPU bit of camera position is never accepted with a broad tolerance',()=>{
 const a=observed(),b=observed('staged'),bits=new Uint32Array(b.latest.camera.gpu.cameraPositionBits);bits[0]++;
 const value=new Float32Array(bits.buffer)[0];b.latest.camera.position[0]=value;b.latest.camera.matrixWorld[12]=value;
 b.latest.camera.gpu.cameraPosition[0]=value;b.latest.camera.gpu.cameraPositionBits[0]=bits[0];b.latest.postCamera=copy(b.latest.camera);
 for(const row of b.history){row.camera=copy(b.latest.camera);row.postCamera=copy(b.latest.camera);}
 assert.throws(()=>assertCameraMatch(a,b),/cameraPosition differs/);
});

function setCameraInput(observation,key,index,value){
 for(const row of [observation.latest,...observation.history])for(const cam of [row.camera,row.postCamera]){
  const raw=key==='viewMatrix'?cam.matrixWorldInverse:key==='projectionMatrix'?cam.projectionMatrix:cam.position;
  const floats=new Float32Array([value]);raw[index]=value;cam.gpu[key][index]=floats[0];
  cam.gpu[key+'Bits'][index]=new Uint32Array(floats.buffer)[0];
  if(key==='cameraPosition')cam.matrixWorld[12+index]=value;
 }
}

test('JSON signed-zero loss in redundant camera values replays without changing authoritative bits',()=>{
 const inputs=[['viewMatrix',7],['projectionMatrix',3],['cameraPosition',1]];
 const original=observed();for(const [key,index] of inputs)setCameraInput(original,key,index,-0);
 assert.doesNotThrow(()=>assertObservedCamera(original));
 const saved=JSON.stringify(original),parsed=JSON.parse(saved);
 for(const [key,index] of inputs){
  assert(Object.is(parsed.latest.camera.gpu[key][index],0));
  assert.equal(parsed.latest.camera.gpu[key+'Bits'][index],0x80000000);
 }
 assert.doesNotThrow(()=>assertObservedCamera(parsed));
 assert.equal(assertCameraMatch(original,parsed).matched,true);
 assert.equal(JSON.stringify(parsed),saved,'Validation must not rewrite any receipt');
});

test('signed-zero bit differences across builds remain exact failures after JSON serialization',()=>{
 for(const [key,index] of [['viewMatrix',7],['projectionMatrix',3],['cameraPosition',1]]){
  const a=observed(),b=observed('staged');setCameraInput(a,key,index,0);setCameraInput(b,key,index,-0);
  const baseline=JSON.parse(JSON.stringify(a)),candidate=JSON.parse(JSON.stringify(b));
  assert.doesNotThrow(()=>assertObservedCamera(baseline));assert.doesNotThrow(()=>assertObservedCamera(candidate));
  assert.throws(()=>assertCameraMatch(baseline,candidate),new RegExp(key+' differs'));
 }
});

test('zero reconciliation rejects nonzero camera mismatches and nonfinite encodings',()=>{
 for(const [key,index] of [['viewMatrix',7],['projectionMatrix',3],['cameraPosition',1]]){
  for(const bits of [1,0x80000001,0x3f800000,0x7f800000,0xff800000,0x7fc00000]){
   const o=observed();setCameraInput(o,key,index,0);o.latest.camera.gpu[key+'Bits'][index]=bits;
   assert.throws(()=>assertObservedCamera(o),/values and bit patterns disagree/);
  }
  const valueMismatch=observed();setCameraInput(valueMismatch,key,index,1);
  valueMismatch.latest.camera.gpu[key][index]=Math.fround(1+2**-23);
  assert.throws(()=>assertObservedCamera(valueMismatch),/values and bit patterns disagree/);
  const rawMismatch=observed();setCameraInput(rawMismatch,key,index,1);
  const raw=key==='viewMatrix'?rawMismatch.latest.camera.matrixWorldInverse:key==='projectionMatrix'?rawMismatch.latest.camera.projectionMatrix:rawMismatch.latest.camera.position;
  raw[index]=Math.fround(1+2**-23);
  assert.throws(()=>assertObservedCamera(rawMismatch),/actual raw camera input/);
 }
});

test('nonzero raw underflow cannot borrow the serialized signed-zero exception',()=>{
 for(const [key,index] of [['viewMatrix',7],['projectionMatrix',3],['cameraPosition',1]]){
  const o=observed();setCameraInput(o,key,index,-0);
  const raw=key==='viewMatrix'?o.latest.camera.matrixWorldInverse:key==='projectionMatrix'?o.latest.camera.projectionMatrix:o.latest.camera.position;
  raw[index]=1e-50;
  assert.throws(()=>assertObservedCamera(o),/actual raw camera input/);
 }
});
test('raw double precision differences are retained but may match when every submitted Float32 input is identical',()=>{
 const a=observed(),b=observed('staged');
 b.latest.camera.matrixWorld[12]+=1e-10;b.latest.camera.position[0]+=1e-10;b.latest.postCamera=copy(b.latest.camera);
 assert.equal(assertCameraMatch(a,b).matched,true);assert.notEqual(a.latest.camera.position[0],b.latest.camera.position[0]);
});
test('invented GPU values cannot disagree with the actual raw matrices',()=>{
 const o=observed();o.latest.camera.matrixWorldInverse[12]+=1;o.latest.postCamera=copy(o.latest.camera);
 assert.throws(()=>assertObservedCamera(o),/actual raw camera input/);
});
test('partial counters, stale passes, post-render camera mutation and displaced renderer hooks fail closed',()=>{
 for(const change of [
  o=>{o.latest.nativeEndTotals.calls++;},o=>{o.fresh=false;},o=>{o.latest.postCamera.matrixWorld[12]++;},
  o=>{o.coverage.currentRenderHook=false;},o=>{o.coverage.currentDirectHook=false;},o=>{o.invalidPasses=1;},
  o=>{o.latest.colorDirectInvocations=0;},o=>{o.latest.issues=['unobserved extra draw'];},o=>{o.inventory.overflow=true;},
 ]){
  const o=observed();change(o);assert.throws(()=>assertObservedCamera(o));
 }
});

test('a preserved preparation failure is distinct from a forbidden capture-window failure',()=>{
 const report=modeReport();report.captureWindow.preparationInvalidPasses=1;
 for(const capture of report.captures)for(const o of [capture.before,capture.after]){
  o.invalidPasses=1;o.captureWindow.preparationInvalidPasses=1;
  o.firstInvalidPasses=[{sequence:1,valid:false,observationPhase:'preparation',issues:['nested-render'],threw:false}];
 }
 assert.doesNotThrow(()=>assertModeReport(report));
 const missed=copy(report);missed.captures[0].before.firstInvalidPasses=[];
 assert.throws(()=>assertModeReport(missed),/receipts were lost/);
 const later=copy(report);later.captures[0].before.captureInvalidPasses=1;
 assert.throws(()=>assertModeReport(later),/capture-window island pass/);
});

test('capture boundaries cannot precede native settings or move between views',()=>{
 rejected(a=>{a.captureWindow.atMs=5;},/predates trusted/);
 rejected(a=>{a.nativeEvidence.events.find(e=>e.text==='Travel to path').at=49;},/before the capture boundary/);
 rejected(a=>{a.captures[1].before.captureWindow.atMs++;},/changed or reset/);
 rejected(a=>{a.captures[0].before.captureWindow=null;},/capture boundary/);
});

test('six consecutive settled post-boundary passes are mandatory in retained receipts',()=>{
 for(const change of [
  o=>{o.history.shift();},o=>{o.history[0].sequence=2;},o=>{o.history[1].sequence++;},
  o=>{o.history[0].observationPhase='preparation';},o=>{o.history[1].valid=false;},
  o=>{o.history[1].camera.gpu.cameraPositionBits[0]++;},o=>{o.history.at(-1).sequence--;},
 ]){const o=observed();change(o);assert.throws(()=>assertObservedCamera(o));}
});
test('actual GLTFLoader normalized names are accepted without renaming the receipt',()=>{
 const o=observed('staged');assert(o.inventory.nodes.some(n=>n.name==='107227742_Aquarium_illuminated_habitat'));
 assert.doesNotThrow(()=>assertModeInventory(o,'staged'));
});
test('metadata alone cannot claim an installed candidate or disabled default swap',()=>{
 for(const mode of ['default','staged']){
  const o=observed(mode==='default'?'staged':'default');assert.throws(()=>assertModeInventory(o,mode));
 }
 rejected((a,b)=>{b.captures[0].before.inventory.nodes.push({name:legacyExteriorNames[0]});},/still attached/);
 rejected((a,b)=>{b.captures[0].before.inventory.nodes=b.captures[0].before.inventory.nodes.filter(n=>n.name!==retainedNames[1].replaceAll(' ','_'));},/Retained interior detail/);
});
test('an absent or wrong selected full-detail model level is not accepted',()=>{
 rejected((a,b)=>{b.captures[0].before.inventory.nodes.find(n=>n.name==='107227742_STAGED_LOD0').worldVisible=false;},/LOD0/);
 rejected((a,b)=>{b.captures[0].before.inventory.nodes=b.captures[0].before.inventory.nodes.filter(n=>n.name!=='107310050_STAGED_LOD2');},/level is missing/);
});
test('all twelve source models and all six active loaded model byte hashes are mandatory',()=>{
 rejected((a,b)=>{b.sourceAssets.pop();},/twelve/);
 rejected((a,b)=>{b.stagedRequests.pop();},/network bytes/);
 rejected((a,b)=>{b.stagedRequests[0].sha256='9'.repeat(64);},/network bytes/);
 rejected((a,b)=>{b.stagedRequests[0].status=404;},/request did not succeed/);
 rejected(a=>{a.stagedRequests=[{file:'Conservatory_Architectural_Study.glb'}];},/Default runtime requested/);
});
test('default packaging absence and exact head/tree/browser binding are independent requirements',()=>{
 rejected(a=>{a.build.builtStagedAssets=[a.sourceAssets[0]];});
 rejected(a=>{a.build.stagedManifestPresent=true;});
 for(const key of ['sourceSha','sourceTree','browser'])rejected((a,b)=>{b[key]=key==='browser'?'Other Chrome':'9'.repeat(40);});
 rejected((a,b)=>{b.build.flag='0';});
});
test('a guide label at the wrong building or synthetic native input cannot satisfy the route',()=>{
 for(const change of [
  e=>{e.events.find(event=>event.text==='Travel to path').landmark='Wrong building';},
  e=>{e.events[0].trusted=false;},e=>{e.events=e.events.filter(event=>event.code!=='KeyV');},
  e=>{e.held=['KeyF'];},e=>{e.focusLossDuringInput=[{reason:'blur'}];},e=>{e.overflow=true;},
  e=>{e.events.push({type:'keydown',code:'KeyW',trusted:true});},
 ]){
  const e=nativeEvidence();change(e);assert.throws(()=>assertNativeRoute(e));
 }
});
test('settings must have trusted final input and change receipts as well as matching values',()=>{
 for(const change of [
  e=>{e.events.find(event=>event.type==='change'&&event.target==='#quality').trusted=false;},
  e=>{e.events=e.events.filter(event=>event.type!=='input');},
  e=>{e.events.find(event=>event.type==='change'&&event.target==='#sky-preset').value='17.8';},
 ]){
  const e=nativeEvidence();change(e);assert.throws(()=>assertNativeRoute(e));
 }
});
test('only buildMs can differ before restoring the exact tracked generated-report bytes',()=>{
 const before=Buffer.from('{"tiles":429,"buildMs":10,"notes":["retain geometry"]}');
 const after=Buffer.from('{\n  "tiles": 429,\n  "buildMs": 27,\n  "notes": ["retain geometry"]\n}');
 const receipt=assertGeneratedTimingChange(before,after);assert.equal(receipt.onlyBuildMsChanged,true);
 assert.equal(receipt.beforeSha256,sha256(before));assert.equal(receipt.afterSha256,sha256(after));
 assert.throws(()=>assertGeneratedTimingChange(before,Buffer.from('{"tiles":428,"buildMs":27,"notes":["retain geometry"]}')),/beyond buildMs/);
 assert.throws(()=>assertGeneratedTimingChange(before,Buffer.from('{"tiles":429,"buildMs":27,"notes":["removed geometry"]}')),/beyond buildMs/);
 assert.throws(()=>assertGeneratedTimingChange(before,Buffer.from('{"tiles":429,"notes":["retain geometry"]}')),/timing/);
});
test('missing pairs and duplicate captures cannot satisfy the six-view coverage',()=>{
 rejected((a,b)=>{b.captures.pop();});
 rejected((a,b)=>{b.captures[5]=copy(b.captures[4]);});
});
test('software fallback, altered quality, unfocused captures and changed view modes fail',()=>{
 for(const change of [
  c=>{c.gpu.renderer='ANGLE SwiftShader';},c=>{c.settings.quality='smooth';},c=>{c.settings.effectiveQuality='automatic';},
  c=>{c.settings.focused=false;},c=>{c.settings.visible=false;},c=>{c.settings.skyCycle=true;},
  c=>{c.settings.skyHour=17.8;},c=>{c.settings.reducedMotion=false;},c=>{c.settings.devicePixelRatio=2;},
  c=>{c.settings.effectiveFrameCap=10;},c=>{c.settings.adaptiveScale=undefined;},c=>{c.settings.adaptiveScale=.8;},c=>{c.settings.renderPixelRatio=.8;},
  c=>{c.firstPerson=true;},c=>{c.rideMode='ON FOOT';},c=>{c.settings.innerWidth=1024;},c=>{c.gpu.width=1024;},
 ]){
  const c=capture('default',views[0]);change(c);assert.throws(()=>assertCapture(c,{mode:'default',layout:'desktop'}));
 }
 rejected((a,b)=>{for(const mode of [a,b])for(const c of mode.captures)c.settings.adaptiveScale=.8;},/full rendering scale/);
});
test('a screenshot without a GPU fence, paint opportunities or advanced observed pass fails',()=>{
 for(const change of [c=>{c.gpu.gpuFence=false;},c=>{c.gpu.paintOpportunities=0;},c=>{c.after.latest.sequence=c.before.latest.sequence;}]){
  const c=capture('default',views[0]);change(c);assert.throws(()=>assertCapture(c,{mode:'default',layout:'desktop'}));
 }
});
test('capture-time camera drift and failed cleanup/network receipts cannot be hidden by passed metadata',()=>{
 rejected((a,b)=>{b.captures[0].after.latest.camera=camera('different-camera');b.captures[0].after.latest.postCamera=copy(b.captures[0].after.latest.camera);});
 rejected((a,b)=>{b.errors=['Browser close failed'];});
 rejected((a,b)=>{b.failedRequests=[{url:'missing-model.glb'}];});
});
test('PNG header/dimensions and independently reread byte digest are checked',async()=>{
 const directory=await mkdtemp(resolve(tmpdir(),'landmark-comparison-contract-'));
 try{
  const bytes=Buffer.alloc(15001);Buffer.from('89504e470d0a1a0a','hex').copy(bytes);bytes.write('IHDR',12,'ascii');bytes.writeUInt32BE(1280,16);bytes.writeUInt32BE(800,20);
  const row={file:'aquarium-exterior.png',sha256:sha256(bytes),bytes:bytes.length};await writeFile(resolve(directory,row.file),bytes);
  await verifyCapturePng(row,directory,viewportFor('desktop'));
  await assert.rejects(()=>verifyCapturePng(row,directory,viewportFor('phone')));
  bytes[bytes.length-1]=1;await writeFile(resolve(directory,row.file),bytes);
  await assert.rejects(()=>verifyCapturePng(row,directory,viewportFor('desktop')));
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('one failed mode cannot produce a successful matched comparison',()=>{
 const failed=modeReport('staged');failed.passed=false;assert.throws(()=>assertModeReport(failed));assert.throws(()=>compareReports(modeReport(),failed));
});

test('closed native select plans use unique real labels and record a change when already selected',()=>{
 const sky=[['','Choose a time'],['6.2','Sunrise'],['9','Morning'],['12','Midday'],['16.7','Golden hour'],['17.8','Sunset'],['18.5','Dusk'],['22','Night'],['17.55','Photo-reference sunset · clear']]
  .map(([value,label])=>({value,label,disabled:false}));
 assert.deepEqual(nativeTypeaheadPlan(sky,'','12'),[{value:'12',prefix:'mi'}]);
 assert.deepEqual(nativeTypeaheadPlan(sky,'12','12'),[{value:'',prefix:'c'},{value:'12',prefix:'mi'}]);
 const quality=[{value:'automatic',label:'Automatic'},{value:'smooth',label:'Smooth · lighter shadows'},{value:'high',label:'High detail'}];
 assert.deepEqual(nativeTypeaheadPlan(quality,'automatic','smooth'),[{value:'smooth',prefix:'s'}]);
 assert.deepEqual(nativeTypeaheadPlan(quality,'high','high'),[{value:'automatic',prefix:'a'},{value:'high',prefix:'h'}]);
 const fps=[{value:'60',label:'60 FPS target'},{value:'30',label:'Stable 30 FPS target'}];
 assert.deepEqual(nativeTypeaheadPlan(fps,'60','60'),[{value:'30',prefix:'s'},{value:'60',prefix:'6'}]);
});
test('native typeahead rejects disabled, missing, ambiguous and popup-key option plans',()=>{
 const options=[{value:'a',label:'Morning'},{value:'b',label:'Midday',disabled:true}];
 assert.throws(()=>nativeTypeaheadPlan(options,'a','b'),/enabled/);
 assert.throws(()=>nativeTypeaheadPlan(options,'a','missing'),/enabled/);
 assert.throws(()=>nativeTypeaheadPlan([{value:'a',label:'Choice'},{value:'a',label:'Other'}],'','a'),/Ambiguous/);
 assert.throws(()=>nativeTypeaheadPlan([{value:'a',label:'Same'},{value:'b',label:'Same'}],'a','b'),/unique/);
 assert.throws(()=>nativeTypeaheadPlan([{value:'a',label:'High one'},{value:'b',label:'High two'}],'a','b'),/unique/);
 assert.throws(()=>nativeTypeaheadPlan([{value:'a',label:'Morning'},{value:'b',label:'Éclair'}],'a','b'),/unique/);
 assert.throws(()=>nativeTypeaheadPlan(options,'a','a'),/second enabled/);
});
test('setting typeahead cannot admit gameplay movement, closed-dialog keys or post-boundary input',()=>{
 const accepted=nativeEvidence('phone');
 accepted.events.push({type:'keydown',code:'KeyS',trusted:true,target:'#quality',phase:'configure-settings',settingsOpen:true,at:20});
 assert.doesNotThrow(()=>assertNativeRoute(accepted,'phone'));
 for(const change of [
  e=>{e.target='#game';},e=>{e.settingsOpen=false;},e=>{delete e.settingsOpen;},
  e=>{e.phase='aquarium-travel-to-entrance';},e=>{e.trusted=false;},
  e=>{e.code='KeyW';},e=>{e.code='KeyD';}
 ]){
  const rejected=copy(accepted);change(rejected.events.at(-1));assert.throws(()=>assertNativeRoute(rejected,'phone'));
 }
 const mode=modeReport('default','phone');mode.nativeEvidence=accepted;assert.doesNotThrow(()=>assertModeReport(mode));
 mode.nativeEvidence.events.at(-1).at=mode.captureWindow.atMs+1;
 assert.throws(()=>assertModeReport(mode),/settings keys occurred after/);
});
