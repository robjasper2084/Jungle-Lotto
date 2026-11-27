import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {snapshotOwnedSubmission} from './submission-receipt.ts';
import {assertSubmittedOwner} from './contract.mjs';
import {pins,sha256,artifactMetadata} from './provenance.mjs';
import {assertScenePair,assertDrawPair,assertCamera,assertSourcePair,assertFence,assertTransition,analyze} from './contract.mjs';
import {decodePng,verifyCapture} from './png-evidence.mjs';
import {encodeRgba,cropRgba,comparePixels} from './png-derived.mjs';

const clone=x=>structuredClone(x),path=i=>'Scene#0/107227742_STAGED_LODS#0/107227742_STAGED_LOD'+i+'#0/RoofPatinatedCopperPanels__copper#0';
function attribute(count,prefix='old',sha=prefix){return {type:'Float32Array',bytes:count*12,count,itemSize:3,normalized:false,interleaved:false,offset:0,stride:3,gpuType:1015,usage:35044,meshPerAttribute:null,sha256:sha,prefixSha256:prefix};}
function scenePair(){
 const before={scene:{fog:'original'},objects:[{path:'Scene#0/Tree#0',isRoof:false,geometry:{sha256:'tree'},materials:['leaf'],matrixWorld:[1],castShadow:true,receiveShadow:true}]};
 for(let i=0;i<3;i++)before.objects.push({path:path(i),isRoof:true,materials:['copper'],matrixWorld:[1],castShadow:true,receiveShadow:true,
  geometry:{attributes:{position:attribute(96)},index:{...attribute(144),type:'Uint16Array',itemSize:1,stride:1,bytes:288},groups:[],drawRange:{start:0,count:'Infinity'},boundingBox:null,boundingSphere:null}});
 const candidate=clone(before);for(const r of candidate.objects.filter(r=>r.isRoof)){
  r.geometry.attributes.position=attribute(150,'old','appended');r.geometry.index={...r.geometry.index,count:294,bytes:588,sha256:'appended'};
 }
 return [before,candidate];
}
function drawPair(){
 const a=[{path:'Scene#0/Tree#0',pass:'color',calls:1,triangles:500,submittedGeometry:{positionCount:300,indexCount:1500,start:0,count:'Infinity'}},
  {path:path(0),pass:'color',calls:1,triangles:48,submittedGeometry:{positionCount:96,indexCount:144,start:0,count:'Infinity'}},
  {path:path(0),pass:'shadow',calls:1,triangles:48,submittedGeometry:{positionCount:96,indexCount:144,start:0,count:'Infinity'}}];
 const b=clone(a);for(const r of b.slice(1)){r.triangles=98;r.submittedGeometry.positionCount=150;r.submittedGeometry.indexCount=294;}return[a,b];
}
test('Only three append-only roof geometries may differ; all other objects stay exact',()=>{
 const [a,b]=scenePair();assert.deepEqual(assertScenePair(a,b),{objects:4,roofExceptions:3});
 for(const edit of [x=>x.objects[0].geometry.sha256='changed',x=>x.objects[0].castShadow=false,x=>x.objects[1].materials=['new-copper'],
  x=>x.objects[1].geometry.attributes.position.prefixSha256='changed',x=>x.objects[1].geometry.index.prefixSha256='changed',
  x=>x.objects[1].geometry.attributes.normal=attribute(150),x=>x.objects.pop()]){const c=clone(b);edit(c);assert.throws(()=>assertScenePair(a,c));}
});
test('Native color and shadow submissions add exactly 50 triangles per roof draw',()=>{
 const [a,b]=drawPair();assert.deepEqual(assertDrawPair(a,b),{roofColor:1,roofShadow:1});
 for(const edit of [x=>x[0].triangles--,x=>x[1].calls=0,x=>x[2].triangles=97,x=>x.reverse(),x=>x[1].submittedGeometry.start=3]){
  const c=clone(b);edit(c);assert.throws(()=>assertDrawPair(a,c));
 }
});
test('Every native reference retains its exact Float32 bits, including signed zero',()=>{
 for(const {camera:c} of pins.nativeBeforeEvidence.views){
  const receipt={projection:c.projection,gpu:{view:{bits:c.gpu.viewMatrixBits},projection:{bits:c.gpu.projectionMatrixBits},position:{bits:c.gpu.cameraPositionBits}}};
  assertCamera(receipt,c);const changed=clone(receipt);changed.gpu.view.bits[0]^=1;assert.throws(()=>assertCamera(changed,c));
  for(const [values,bits] of [[c.matrixWorldInverse,c.gpu.viewMatrixBits],[c.projectionMatrix,c.gpu.projectionMatrixBits],[c.position,c.gpu.cameraPositionBits]]){
   const a=new Float32Array(values.map((v,i)=>v===0&&bits[i]===0x80000000?-0:v));assert.deepEqual([...new Uint32Array(a.buffer)],bits);
  }
 }
 assert(pins.nativeBeforeEvidence.views.some(v=>v.camera.gpu.viewMatrixBits.includes(0x80000000)),'Test must cover negative zero');
});
test('Both application pins and the sole bundled loader source difference are binding',()=>{
 const path=pins.gamePath+'/src/belle/stagedLandmarkStudies.ts';
 const props={path:pins.gamePath+'/'+pins.detroitProps.path,bytes:pins.detroitProps.bytes,sha256:pins.detroitProps.sha256,gitBlob:pins.detroitProps.gitBlob};
 const a={source:pins.sources.before,inputs:[{path,sha256:'before'},{path:'world.ts',sha256:'world'},props]},b={source:pins.sources.candidate,inputs:[{path,sha256:'after'},{path:'world.ts',sha256:'world'},props]};
 assertSourcePair(a,b);const changed=clone(b);changed.inputs[1].sha256='changed';assert.throws(()=>assertSourcePair(a,changed));
 assert.throws(()=>assertSourcePair(a,{...b,source:pins.sources.before}));
});
test('GPU completion requires a successful native fence and ordered finite times',()=>{
 for(const result of ['ALREADY_SIGNALED','CONDITION_SATISFIED'])assertFence({submittedAt:5,completedAt:6,result});
 for(const value of [null,{}, {submittedAt:5,completedAt:4,result:'ALREADY_SIGNALED'}, {submittedAt:5,completedAt:6,result:'WAIT_FAILED'}, {submittedAt:NaN,completedAt:6,result:'ALREADY_SIGNALED'}])assert.throws(()=>assertFence(value));
});
function transitionCase(index=0,mode='before'){
 const view=pins.nativeBeforeEvidence.views[index],c=clone(view.camera);
 const camera={projection:c.projection,gpu:{view:{bits:c.gpu.viewMatrixBits},projection:{bits:c.gpu.projectionMatrixBits},position:{bits:c.gpu.cameraPositionBits}}};
 const frame={camera,frameBefore:40,frameAfter:41,
  observer:{latest:{valid:true,camera:{gpu:c.gpu}},fresh:true,ready:true,captureInvalidPasses:0,errors:[],
   coverage:{renderer:true,render:true,direct:true,currentRenderHook:true,currentDirectHook:true}},
  settings:{viewport:{width:1280,height:800,pixelRatio:1,devicePixelRatio:1},quality:'high',effectiveQuality:'high',scale:1,hour:12,reducedMotion:true,focused:true,visible:true,
   skySettings:{cycle:false,clouds:'clear'},artStyle:'authentic',exposure:.85,shadow:{enabled:true,type:1},actualContext:{preserveDrawingBuffer:false}},
  preparationActivity:{events:12,loads:0,compiles:0,errors:[]},completion:{submittedAt:51,completedAt:52,result:'CONDITION_SATISFIED'},
  draws:drawPair()[mode==='before'?0:1].filter(d=>d.pass==='color')};
 const time=pins.construction.simulationTimeSeconds+index,last={...clone(frame),frameBefore:39,frameAfter:40,completion:{submittedAt:49,completedAt:50,result:'ALREADY_SIGNALED'}};
 return {time,captures:[clone(last),last],...(index<3?{transitionAfterCapture:{time:time+1/60,stepSeconds:1/60,updateFlags:{running:false,allowDeferred:false},...frame}}:{})};
}
test('Inter-view cadence uses one recorded native color-only frame while keeping all capture clocks',()=>{
 for(let index=0;index<4;index++)for(const mode of ['before','candidate'])assertTransition(transitionCase(index,mode),pins.nativeBeforeEvidence.views[index],mode,index);
 const e=transitionCase(0);e.time+=1/60;assert.throws(()=>assertTransition(e,pins.nativeBeforeEvidence.views[0],'before',0));
 const last=transitionCase(3);last.transitionAfterCapture=transitionCase(0).transitionAfterCapture;
 assert.throws(()=>assertTransition(last,pins.nativeBeforeEvidence.views[3],'before',3));
});
test('Inter-view evidence rejects missing, reordered, changed-camera or forced-shadow transitions',()=>{
 const edits=[e=>delete e.transitionAfterCapture,e=>e.transitionAfterCapture.time=e.time,
  e=>e.transitionAfterCapture.stepSeconds=.1,e=>e.transitionAfterCapture.updateFlags.allowDeferred=true,
  e=>e.transitionAfterCapture.frameBefore--,e=>e.transitionAfterCapture.frameAfter++,
  e=>e.transitionAfterCapture.completion.submittedAt=49,e=>e.transitionAfterCapture.completion.result='WAIT_FAILED',
  e=>e.transitionAfterCapture.camera.gpu.view.bits[0]^=1,e=>e.transitionAfterCapture.settings.shadow.enabled=false,
  e=>e.transitionAfterCapture.settings.exposure=1,
  e=>e.transitionAfterCapture.preparationActivity.events++,e=>e.transitionAfterCapture.preparationActivity.loads++,
  e=>e.transitionAfterCapture.draws.push({...e.transitionAfterCapture.draws[1],pass:'shadow'}),
  e=>e.transitionAfterCapture.observer.coverage.currentDirectHook=false];
 for(const [index,edit] of edits.entries()){const e=transitionCase();edit(e);assert.throws(()=>assertTransition(e,pins.nativeBeforeEvidence.views[0],'before',0),undefined,'transition mutation '+index);}
});
test('Incomplete native evidence cannot become comparison acceptance',()=>{
 for(const value of [{},{before:{}},{before:{...pins.sources.before},candidate:{}}]){
  const r=analyze(value);assert.equal(r.complete,false);assert.equal(r.releaseAcceptance,false);assert.equal(r.pixelEquivalent,false);assert(r.errors.length);
 }
});
test('Archive identity binds exact build, bytes, head, digest and expiration',()=>{
 const p=pins.artifact,a={id:p.id,name:p.name,size_in_bytes:p.bytes,digest:'sha256:'+p.sha256,expired:false,workflow_run:{id:p.run,head_sha:p.head}};
 artifactMetadata(a);
 for(const edit of [x=>x.id++,x=>x.size_in_bytes--,x=>x.digest='sha256:bad',x=>x.expired=true,x=>x.workflow_run.head_sha=pins.sources.before.head]){const b=clone(a);edit(b);assert.throws(()=>artifactMetadata(b));}
});
test('PNG decoder binds native top-down channels to original bottom-up GL bytes',()=>{
 const top=Buffer.from([10,20,30,255,40,50,60,255,70,80,90,255,100,110,120,255]),bottom=Buffer.concat([top.subarray(8),top.subarray(0,8)]);
 const png=encodeRgba(top,2,2);assert.deepEqual(decodePng(png,{width:2,height:2}),top);
 verifyCapture(png,bottom,{width:2,height:2,pixelSha256:sha256(bottom)});
 const bad=Buffer.from(bottom);bad[0]^=1;assert.throws(()=>verifyCapture(png,bad,{width:2,height:2,pixelSha256:sha256(bad)}));
 const crc=Buffer.from(png);crc[40]^=1;assert.throws(()=>decodePng(crc,{width:2,height:2}));
 const alpha=Buffer.from(bottom);alpha[3]=254;assert.throws(()=>verifyCapture(png,alpha,{width:2,height:2,pixelSha256:sha256(alpha)}));
});
test('Roof crop has no resampling and difference accounting retains outside pixels',()=>{
 const a=Buffer.alloc(4*3*4);for(let i=3;i<a.length;i+=4)a[i]=255;
 const b=Buffer.from(a),rect={x:1,y:1,width:2,height:1};b[(1*4+1)*4]=25;b[(0*4+0)*4+1]=9;
 const {image,statistics}=comparePixels(a,b,4,3,rect);assert.equal(statistics.changedPixels,2);assert.equal(statistics.insideRoofRegion,1);assert.equal(statistics.outsideRoofRegion,1);
 assert.equal(statistics.maxChannelDelta,25);assert.deepEqual(cropRgba(b,4,3,rect),b.subarray(20,28));
 assert.deepEqual(decodePng(encodeRgba(image,4,3),{width:4,height:3}),image);assert.throws(()=>cropRgba(a,4,3,{x:-1,y:0,width:1,height:1}));
});
test('Source fixture keeps complete original world, source policy and raw readback',async()=>{
 const [browser,build,driver]=await Promise.all(['browser.ts','build.mjs','driver.mjs'].map(f=>readFile(new URL('./'+f,import.meta.url),'utf8')));
 assert(browser.includes('world=await createWorld(scene,renderer,map,terrain,'));assert(browser.includes('installSharedGeometryBuffers(renderer,scene,{rendererOutput})'));
 assert(browser.includes("enableHardwareAntialiasing('automatic',aaDevice)"));assert(!browser.includes('installShadowMatrixCache'));
 assert(!/\.material\s*=|\.geometry\s*=|\.renderOrder\s*=|\.visible\s*=/.test(browser),'Fixture must not replace or hide world surfaces');
 assert(browser.indexOf('gl.readPixels(')<browser.indexOf("canvas.toDataURL('image/png')"));
 assert(build.includes("'import.meta.env.VITE_STAGED_BELLE_ARCHITECTURE':JSON.stringify('1')"));
 assert(driver.includes('await context.addInitScript(installLandmarkComparisonObserver'));
 assert(!driver.includes('staged-landmark-walk-proof.mjs'));assert(!driver.includes("page.keyboard"));
 assert(driver.includes("if(e.code==='DIAGNOSTIC_TIMEOUT'||page.isClosed())throw e"),'Timed-out native operations must terminate their context');
 assert(driver.includes('if(abortVariants)'),'An unconfirmed context close must block a subsequent variant');
 assert(browser.includes("check(matches.length<=1,'Ambiguous published original Detroit prop stages')"));
 assert(browser.includes('published&&!pendingWork.loads&&!pendingWork.compiles'),'A quiet network alone cannot prove native pack publication');
});
test('Dedicated workflow pins both source heads and preserves original gates',async()=>{
 const workflow=await readFile(new URL('../../workflows/belle-pr248-roof-comparison.yml',import.meta.url),'utf8');
 for(const p of Object.values(pins.sources))assert(workflow.includes('ref: '+p.head));
 assert.equal((workflow.match(/persist-credentials: false/g)||[]).length,3);
 assert(workflow.includes('branches: [upgrade-redesign-aquarium-roof-ends-20261126]'));
 assert(workflow.includes("github.event.pull_request.head.ref == 'upgrade-redesign-pr248-roof-comparison-20261126'"));
 assert(workflow.includes('if: always()'));assert(workflow.includes('runs-on: macos-15'));
 assert(!/staged-landmark-walk-proof|sustained-ride-profile|continue-on-error/.test(workflow));
});


const byteHash=b=>createHash('sha256').update(b).digest('hex');
const typedBytes=a=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
function ownerGeometry(vertices=3,indices=3){
 const position=new Float32Array(vertices*3);for(let i=0;i<position.length;i++)position[i]=i/8;
 const index=new Uint16Array(indices);for(let i=0;i<indices;i++)index[i]=i%vertices;
 const attribute=(array,itemSize)=>({array,itemSize,count:array.length/itemSize,normalized:false,gpuType:1015,usage:35044});
 return {attributes:{position:attribute(position,3)},index:attribute(index,1),drawRange:{start:0,count:Infinity},getAttribute(name){return this.attributes[name];}};
}
function ownerPage(source,vertexOffset=2,indexOffset=5,vertices=300,indices=900){
 const page=ownerGeometry(vertices,indices);page.attributes.position.array.fill(0);page.index.array.fill(0);
 page.attributes.position.array.set(source.attributes.position.array,vertexOffset*3);
 for(let i=0;i<source.index.count;i++)page.index.array[indexOffset+i]=source.index.array[i]+vertexOffset;
 const start=Math.max(0,source.drawRange.start),count=Math.min(source.index.count,source.drawRange.start+source.drawRange.count)-start;
 page.drawRange={start:indexOffset+start,count};return page;
}
function ownerScene(source,isRoof=false){
 const row=a=>({type:a.array.constructor.name,count:a.count,itemSize:a.itemSize,normalized:a.normalized,gpuType:a.gpuType,usage:a.usage,sha256:byteHash(typedBytes(a.array)),
  ...(isRoof?{prefixSha256:byteHash(typedBytes(a.array).subarray(0,(a.itemSize===1?144:96*a.itemSize)*a.array.BYTES_PER_ELEMENT))}:{})});
 return {isRoof,geometry:{attributes:{position:row(source.attributes.position)},index:row(source.index),drawRange:{start:source.drawRange.start,count:Number.isFinite(source.drawRange.count)?source.drawRange.count:'Infinity'}}};
}
async function ownerDraw(source,page,{isRoof=false,pass='color',name='Scene#0/Tree#0'}={}){
 const copy=snapshotOwnedSubmission(page,source,null,isRoof);const submittedOwnership=await copy.settle(async b=>byteHash(b));
 return {path:name,pass,calls:1,triangles:source.index.count/3,submittedGeometry:{positionCount:page.getAttribute('position').count,indexCount:page.index.count,start:page.drawRange.start,count:page.drawRange.count},submittedOwnership};
}
test('Actual shared owner bytes survive page growth and index relocation without weakening source proof',async()=>{
 const source=ownerGeometry(),a=await ownerDraw(source,ownerPage(source)),b=await ownerDraw(source,ownerPage(source,56,155,462,1350));
 const scene=ownerScene(source);assertSubmittedOwner(a,scene);assertSubmittedOwner(b,scene);
 const [ra,rb]=drawPair();assertDrawPair([a,...ra.slice(1)],[b,...rb.slice(1)]);
 for(const mutate of [d=>delete d.submittedOwnership,d=>d.submittedOwnership.attributes.position.submittedSha256='0'.repeat(64),
  d=>d.submittedOwnership.index.submittedSha256='1'.repeat(64),d=>d.submittedOwnership.vertexOffset=-1,
  d=>d.submittedOwnership.indexOffset++,d=>d.submittedOwnership.sourceActive.count--,
  d=>d.submittedGeometry.count--,d=>delete d.submittedOwnership.index.rawSubmittedSha256]){
  const c=clone(b);mutate(c);assert.throws(()=>assertSubmittedOwner(c,scene));
 }
 const wrongGrowth=clone(b);wrongGrowth.submittedGeometry.positionCount++;assert.throws(()=>assertDrawPair([a,...ra.slice(1)],[wrongGrowth,...rb.slice(1)]));
});
test('Owner snapshot rejects actual vertex/index changes, signed-zero changes and unsupported ranges',()=>{
 for(const mutate of [p=>p.attributes.position.array[6]+=.125,p=>p.index.array[6]++,p=>p.drawRange.count--,
  p=>p.drawRange.start++,p=>p.index.array=new Uint32Array(p.index.array),p=>p.attributes.position.normalized=true]){
  const source=ownerGeometry(),page=ownerPage(source);mutate(page);assert.throws(()=>snapshotOwnedSubmission(page,source,null));
 }
 const source=ownerGeometry();source.attributes.position.array[0]=-0;const page=ownerPage(source);page.attributes.position.array[6]=0;
 assert.throws(()=>snapshotOwnedSubmission(page,source,null),'Signed zero must be compared as original bytes');
 assert.throws(()=>snapshotOwnedSubmission(ownerPage(source),source,{}),'Unknown group cannot claim exact owner coverage');
});
test('Owner bytes are copied before any asynchronous hashing or later shared-page changes',async()=>{
 const source=ownerGeometry(),page=ownerPage(source),expected=byteHash(typedBytes(source.attributes.position.array));
 const copied=snapshotOwnedSubmission(page,source,null);
 source.attributes.position.array[0]=111;page.attributes.position.array.fill(222);page.index.array.fill(333);
 const proof=await copied.settle(async bytes=>{await Promise.resolve();return byteHash(bytes);});
 assert.equal(proof.attributes.position.sourceSha256,expected);assert.equal(proof.attributes.position.submittedSha256,expected);
 assert.notEqual(proof.attributes.position.sourceSha256,byteHash(typedBytes(source.attributes.position.array)));
});
test('Pooled roof color/shadow draws retain exact old prefixes and add only the intended fifty triangles',async()=>{
 const before=ownerGeometry(96,144),candidate=ownerGeometry(150,294);
 candidate.index.array.set(before.index.array);
 const a=await ownerDraw(before,ownerPage(before,2,5,300,900),{isRoof:true,name:path(0)});
 const b=await ownerDraw(candidate,ownerPage(candidate,2,5,462,1350),{isRoof:true,name:path(0)});
 assertSubmittedOwner(a,ownerScene(before,true));assertSubmittedOwner(b,ownerScene(candidate,true));
 assert.deepEqual(assertDrawPair([a,{...a,pass:'shadow'}],[b,{...b,pass:'shadow'}]),{roofColor:1,roofShadow:1});
 const c=clone(b);c.submittedOwnership.attributes.position.submittedPrefixSha256='0'.repeat(64);assert.throws(()=>assertSubmittedOwner(c,ownerScene(candidate,true)));
 const d=clone(b);d.triangles--;assert.throws(()=>assertDrawPair([a],[d]));
});
test('Active-owner hashing cannot introduce an async boundary before the native PNG/readback',async()=>{
 const browser=await readFile(new URL('./browser.ts',import.meta.url),'utf8');
 const capture=browser.slice(browser.indexOf('async function capture('),browser.indexOf('async function finishCase('));
 const draw=capture.indexOf('const receipt=draw()'),raw=capture.indexOf('gl.readPixels('),png=capture.indexOf("canvas.toDataURL('image/png')"),settle=capture.indexOf('await receipt.settleOwners()');
 assert(draw>=0&&draw<raw&&raw<png&&png<settle);assert(!capture.slice(draw,png).includes('await '));
 assert(browser.includes('snapshotOwnedSubmission(geometry,(object as T.Mesh).geometry,args[5],roofPath(row.path))'));
 assert(browser.includes('await frame.settleOwners()'),'Preparation and inter-view hashes must be settled too');
 const contract=await readFile(new URL('./contract.mjs',import.meta.url),'utf8');
 assert(contract.includes('...(e.transitionAfterCapture?[e.transitionAfterCapture]:[])'),'Inter-view owner bytes must be verified');
 assert(!browser.includes('shadowMap.needsUpdate='));
});
