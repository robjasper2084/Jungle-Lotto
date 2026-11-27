import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pins,sha256,artifactMetadata} from './provenance.mjs';
import {assertScenePair,assertDrawPair,assertCamera,assertSourcePair,assertFence,analyze} from './contract.mjs';
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
