import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {chromium} from 'playwright';

// This is a renderer-equivalence fixture, not the full game or a release test.
// Run from any directory; real street assets and the two actual source factories
// are bundled together. A failed comparison remains failed in report.json.
const game=fileURLToPath(new URL('../',import.meta.url));
const repo=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:game,encoding:'utf8'}).trim();
const sourcePath=path.relative(repo,path.join(game,'src/belle/streetDetails.ts'));
const baselineRef=process.env.BELLE_STREET_BASE??'6518764b9735f78bdc95ec6227d0ba26ba291b48';
const output=path.resolve(game,process.env.BELLE_STREET_PROOF_OUTPUT??'output/street-index-proof');
const baseline=execFileSync('git',['show',`${baselineRef}:${sourcePath}`],{cwd:repo,encoding:'utf8'});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const script=String.raw`
import * as T from 'three';
import {addStreetDetails as addBaseline} from 'proof:baseline';
import {addStreetDetails as addCandidate} from './src/belle/streetDetails.ts';
import {loadRealisticMaterials,applyRealisticMaterials} from './src/belle/realisticMaterials.ts';
import {applyPhotoReferenceSurfaces} from './src/belle/photoReferenceSurfaces.ts';

const width=1440,height=900;
const canvas=document.querySelector('canvas');
const renderer=new T.WebGLRenderer({canvas,antialias:false,preserveDrawingBuffer:true,powerPreference:'high-performance',outputBufferType:T.UnsignedByteType});
renderer.setPixelRatio(1);renderer.setSize(width,height);renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=true;
const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
let calls={},streetCalls={},activeStreet=false;
// Observe the actual street draw only, excluding the fixture's indexed ground
// and shadow caster. The original renderer and each native call still run once.
const direct=renderer.renderBufferDirect;
renderer.renderBufferDirect=function(...args){
 const previous=activeStreet;activeStreet=typeof args[4]?.name==='string'&&args[4].name.startsWith('Street detail ');
 try{return direct.apply(this,args);}finally{activeStreet=previous;}
};
for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
 const original=gl[name];gl[name]=function(...args){
  calls[name]=(calls[name]??0)+1;if(activeStreet)streetCalls[name]=(streetCalls[name]??0)+1;
  return original.apply(this,args);
 };
}
const metadata={revision:T.REVISION,width,height,pixelRatio:renderer.getPixelRatio(),antialias:gl.getContextAttributes().antialias,
 renderer:String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),vendor:String(gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL??gl.VENDOR)),
 technique:'Exact template vertex indexing with the original ordinary mesh renderer',
 scope:'Real mapped street assets in a controlled actual-WebGL fixture. This is not the full game, a 90-second ride, or release acceptance.'};
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
function makePlan(header,buffer){
 const data=new Float32Array(buffer),plan={...header,boxes:[]};
 for(let i=0;i<data.length;i+=header.stride)plan.boxes.push({x:data[i],y:data[i+1],z:data[i+2],w:data[i+3],h:data[i+4],l:data[i+5],yaw:data[i+6],material:header.materials[data[i+7]],grade:data[i+8]});
 return plan;
}
function sceneFor(add,plan){
 const scene=new T.Scene();scene.background=new T.Color(0x657a8d);
 const street=add(scene,plan);
 // Match the real world's material order; both stages share the loaded textures.
 applyRealisticMaterials(scene);applyPhotoReferenceSurfaces(scene);
 const sourceTiles=scene.children.filter(object=>object.name.startsWith('Street detail '));
 const ground=new T.Mesh(new T.PlaneGeometry(1000,1000),new T.MeshStandardMaterial({color:0x343a3c,roughness:.94}));
 ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.name='Proof ground';scene.add(ground);
 const caster=new T.Mesh(new T.BoxGeometry(6,8,6),new T.MeshStandardMaterial({color:0x787e86,roughness:.8}));
 caster.name='Proof shadow caster';caster.castShadow=true;scene.add(caster);
 const sun=new T.DirectionalLight(0xffe2be,3.2);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
 sun.shadow.camera.left=-85;sun.shadow.camera.right=85;sun.shadow.camera.bottom=-85;sun.shadow.camera.top=85;
 sun.shadow.camera.near=.1;sun.shadow.camera.far=350;sun.shadow.bias=-.0001;scene.add(sun,sun.target);
 scene.add(new T.HemisphereLight(0xb9cde2,0x343f2b,1.1));
 return {scene,street,ground,caster,sun,sourceTiles};
}
const views=[
 {name:'jefferson-near',eye:[-19,10,-30],target:[0,2,0],update:[0,0],ground:2.02},
 {name:'jefferson-oblique',eye:[42,26,-82],target:[15,2,-10],update:[0,0],ground:2.02},
 {name:'bridge-graded',eye:[285,23,538],target:[340,9.3,590],update:[340,590],ground:5.95},
 {name:'island-road',eye:[1195,16,748],target:[1229.36,2.14,784.88],update:[1229.36,784.88],ground:2.02},
 {name:'northern-road',eye:[1968,14,160],target:[2000.65,2.084,194.35],update:[2000.65,194.35],ground:2.02},
 // Same camera with positions on each side of an exact existing tile cutoff.
 {name:'visibility-inside',eye:[-26,25,-31],target:[0,2,0],update:[128-439.999,128],ground:2.02},
 {name:'visibility-outside',eye:[-26,25,-31],target:[0,2,0],update:[128-440.001,128],ground:2.02},
 // Narrow oblique views put original tile spheres near multiple frustum planes.
 {name:'frustum-edge',eye:[-80,5,-75],target:[80,2,-40],update:[0,0],ground:2.02,fov:31},
];
const camera=new T.PerspectiveCamera(60,width/height,.08,22000);
function configure(stage,view,shadows){
 stage.street.update(...view.update);camera.fov=view.fov??60;camera.updateProjectionMatrix();
 camera.position.fromArray(view.eye);camera.lookAt(...view.target);camera.updateMatrixWorld(true);
 stage.ground.position.set(view.target[0],view.ground,view.target[2]);
 stage.caster.position.set(view.target[0]-6,view.target[1]+4,view.target[2]+8);
 stage.sun.position.set(view.target[0]-45,view.target[1]+70,view.target[2]-35);
 stage.sun.target.position.fromArray(view.target);stage.sun.target.updateMatrixWorld(true);
 stage.sun.castShadow=shadows;renderer.shadowMap.enabled=shadows;renderer.shadowMap.needsUpdate=shadows;
 stage.scene.updateMatrixWorld(true);
}
async function capture(stage,view,shadows){
 configure(stage,view,shadows);
 await renderer.compileAsync(stage.scene,camera);
 // Compile/warm before taking counters. Every captured draw is a genuine draw.
 renderer.render(stage.scene,camera);gl.finish();
 calls={};streetCalls={};renderer.info.reset();renderer.render(stage.scene,camera);gl.finish();
 const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 const error=gl.getError();if(error!==gl.NO_ERROR)throw Error('WebGL error '+error);
 return {pixels,pixelSha256:await digest(pixels),png:canvas.toDataURL('image/png'),drawCalls:{...calls},streetDrawCalls:{...streetCalls},triangles:renderer.info.render.triangles,
 rendererCalls:renderer.info.render.calls,visibleSourceTiles:stage.sourceTiles.filter(o=>o.visible).length};
}
function differences(a,b){let bytes=0,pixels=0,max=0;for(let i=0;i<a.length;i+=4){let changed=false;
 for(let c=0;c<4;c++)if(a[i+c]!==b[i+c]){changed=true;bytes++;max=Math.max(max,Math.abs(a[i+c]-b[i+c]));}if(changed)pixels++;}
 return {bytes,pixels,maxChannelDelta:max};}
window.__streetProofReady=(async()=>{
 await loadRealisticMaterials(renderer);
 const [header,buffer]=await Promise.all([fetch('/belle/street-details.json').then(r=>r.json()),fetch('/belle/street-details.bin').then(r=>r.arrayBuffer())]);
 const before=sceneFor(addBaseline,makePlan(header,buffer)),after=sceneFor(addCandidate,makePlan(header,buffer));
 if(before.sourceTiles.length!==after.sourceTiles.length)throw Error('Source tile count changed');
 const sourceGeometry=[],storage={sourceVertices:0,candidateVertices:0,sourceAttributeBytes:0,candidateAttributeBytes:0,candidateIndexBytes:0,indexedTiles:0};
 for(let i=0;i<before.sourceTiles.length;i++){
  const a=before.sourceTiles[i],b=after.sourceTiles[i];
  if(a.name!==b.name)throw Error('Source tile order/name changed');
  if(a.geometry.index!==null)throw Error('The pinned baseline must remain nonindexed');
  const index=b.geometry.index;
  if(!index||!(index.array instanceof Uint16Array||index.array instanceof Uint32Array))throw Error(b.name+' is not indexed with native unsigned storage');
  const originalCount=a.geometry.getAttribute('position').count,uniqueCount=b.geometry.getAttribute('position').count;
  if(index.count!==originalCount)throw Error(b.name+' triangle-index count changed');
  if(uniqueCount>=originalCount)throw Error(b.name+' did not reduce its stored vertices');
  storage.sourceVertices+=originalCount;storage.candidateVertices+=uniqueCount;storage.candidateIndexBytes+=index.array.byteLength;storage.indexedTiles++;
  for(const name of ['position','normal']){
   const aa=a.geometry.getAttribute(name).array,bb=b.geometry.getAttribute(name).array;
   if(!(aa instanceof Float32Array)||!(bb instanceof Float32Array)||bb.length!==uniqueCount*3)throw Error('Unexpected attribute storage '+name);
   const originalBits=new Uint32Array(aa.buffer,aa.byteOffset,aa.length),uniqueBits=new Uint32Array(bb.buffer,bb.byteOffset,bb.length),expandedBits=new Uint32Array(aa.length);
   for(let vertex=0;vertex<index.count;vertex++){
    const at=index.getX(vertex);if(!Number.isInteger(at)||at<0||at>=uniqueCount)throw Error('Invalid native vertex index');
    for(let component=0;component<3;component++)expandedBits[vertex*3+component]=uniqueBits[at*3+component];
   }
   const ah=await digest(originalBits),bh=await digest(expandedBits);if(ah!==bh)throw Error(a.name+' expanded '+name+' bits changed');
   storage.sourceAttributeBytes+=aa.byteLength;storage.candidateAttributeBytes+=bb.byteLength;
   sourceGeometry.push({tile:a.name,attribute:name,sha256:ah,expandedScalarCount:aa.length,storedScalarCount:bb.length});
  }
  const sourceBytes=a.geometry.getAttribute('position').array.byteLength+a.geometry.getAttribute('normal').array.byteLength;
  const candidateBytes=b.geometry.getAttribute('position').array.byteLength+b.geometry.getAttribute('normal').array.byteLength+index.array.byteLength;
  if(candidateBytes>=sourceBytes)throw Error(b.name+' did not reduce combined attribute/index storage');
 }
 metadata.sourceTiles=before.sourceTiles.length;metadata.sourceGeometrySha256=await digest(new TextEncoder().encode(JSON.stringify(sourceGeometry)));
 metadata.storage={...storage,sourceBytes:storage.sourceAttributeBytes,candidateBytes:storage.candidateAttributeBytes+storage.candidateIndexBytes};
 metadata.actualMaterialProfiles=[...new Set(after.sourceTiles.map(o=>JSON.stringify({surface:o.material.userData.realisticProfile,finish:o.material.userData.photoSurfaceFinish,grime:/curb|gutter/.test(o.name)})))];
 window.__streetProofViews=views.map(v=>v.name);window.__streetProofMetadata=metadata;
 window.__runStreetProof=async(index)=>{
  const view=views[index];
  const captures={};
  for(const shadows of [false,true]){
   const a=await capture(before,view,shadows),b=await capture(after,view,shadows),diff=differences(a.pixels,b.pixels);
   captures[shadows?'shadow':'color']={baseline:a,candidate:b,diff,trianglesMatch:a.triangles===b.triangles};
  }
  const shadowDifference=differences(captures.color.baseline.pixels,captures.shadow.baseline.pixels);
  const output={name:view.name,camera:view,shadowDifference};
  for(const [name,capture]of Object.entries(captures)){
   for(const item of [capture.baseline,capture.candidate])delete item.pixels;
   output[name]=capture;
  }
  return output;
 };
 return metadata;
})();
`;
await fs.mkdir(output,{recursive:true});
const bundled=await build({absWorkingDir:game,stdin:{contents:script,sourcefile:'street-pixel-proof.ts',resolveDir:game,loader:'ts'},bundle:true,format:'iife',platform:'browser',write:false,metafile:true,logLevel:'error',
 plugins:[{name:'pinned-baseline',setup(b){b.onResolve({filter:/^proof:baseline$/},()=>({path:'baseline.ts',namespace:'baseline'}));b.onLoad({filter:/.*/,namespace:'baseline'},()=>({contents:baseline,loader:'ts',resolveDir:path.join(game,'src/belle')}));}}]});
const bundle=bundled.outputFiles[0].contents;
const mime={'.js':'text/javascript','.json':'application/json','.bin':'application/octet-stream','.webp':'image/webp','.png':'image/png'};
const html='<!doctype html><meta charset="utf-8"><title>Street indexing exact pixel proof</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block}</style><canvas></canvas><script src="/proof.js"></script>';
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://local').pathname;
  if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
  if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}
  if(pathname==='/proof.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle);return;}
  const file=path.resolve(game,'public','.'+decodeURIComponent(pathname));
  if(!file.startsWith(path.join(game,'public')+path.sep)){res.writeHead(403).end();return;}
  const bytes=await fs.readFile(file);res.setHeader('Content-Type',mime[path.extname(file)]??'application/octet-stream');res.end(bytes);
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const report={baselineRef,baselineSha256:sha(baseline),candidateFiles:{},sharedSourceSha256:{},assetSha256:{},baselineAssetSha256:{},bundleSha256:sha(bundle),scope:'Exact renderer-equivalence fixture only; not release acceptance.',views:[],errors:[],pass:false};
for(const name of ['streetDetails.ts','realisticMaterials.ts','photoReferenceSurfaces.ts'])report.candidateFiles[name]=sha(await fs.readFile(path.join(game,'src/belle',name)));
for(const name of ['street-details.json','street-details.bin'])report.assetSha256[name]=sha(await fs.readFile(path.join(game,'public/belle',name)));
let browser;
try{
 // A baseline factory cannot stand in for the baseline if an unreviewed shader
 // dependency has drifted. Verify every bundled application dependency except
 // the deliberately changed street factory against the pinned baseline revision.
 const changedAdapters=new Set(['src/belle/streetDetails.ts']);
 for(const name of Object.keys(bundled.metafile.inputs)){
  if(!name.startsWith('src/belle/')||changedAdapters.has(name))continue;
  const file=path.join(game,name),relative=path.relative(repo,file);
  const before=execFileSync('git',['show',`${baselineRef}:${relative}`],{cwd:repo});
  const current=await fs.readFile(file);assert.equal(sha(current),sha(before),`Shared dependency changed: ${name}`);
  report.sharedSourceSha256[name]=sha(current);
 }
 for(const file of [path.join(game,'package-lock.json'),path.resolve(game,'../../package-lock.json')]){
  const name=path.relative(repo,file),before=execFileSync('git',['show',`${baselineRef}:${name}`],{cwd:repo});
  const current=await fs.readFile(file);assert.equal(sha(current),sha(before),`Dependency lock changed: ${name}`);
  report.sharedSourceSha256[name]=sha(current);
 }
 // The superseded batching candidate must not leak into this ordinary-mesh
 // comparison or the game integration accompanying it.
 for(const name of ['world.ts','staticArchitectureBatch.ts','staticPaletteBatch.ts']){
  const file=path.join(game,'src/belle',name),relative=path.relative(repo,file);
  const before=execFileSync('git',['show',`${baselineRef}:${relative}`],{cwd:repo});
  const current=await fs.readFile(file);assert.equal(sha(current),sha(before),`Original render integration changed: ${name}`);
  report.sharedSourceSha256['src/belle/'+name]=sha(current);
 }
 for(const name of ['street-details.json','street-details.bin']){
  const relative=path.relative(repo,path.join(game,'public/belle',name));
  const before=execFileSync('git',['show',`${baselineRef}:${relative}`],{cwd:repo,maxBuffer:8*1024*1024});
  report.baselineAssetSha256[name]=sha(before);
  assert.equal(report.assetSha256[name],report.baselineAssetSha256[name],`Mapped street asset changed: ${name}`);
 }
 const mac=process.platform==='darwin';
 const runtime=mac?{channel:'chrome'}:process.env.BELLE_PROOF_CHROME?{executablePath:process.env.BELLE_PROOF_CHROME}:{};
 browser=await chromium.launch({...runtime,headless:!mac,args:mac?['--use-gl=angle','--use-angle=metal']:['--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
 page.setDefaultTimeout(180000);
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});
 report.renderer=await page.evaluate(()=>window.__streetProofReady);
 if(mac)assert(/Metal/i.test(report.renderer.renderer)&&!/SwiftShader|llvmpipe|software rasterizer/i.test(report.renderer.renderer),'Actual Metal renderer required on macOS');
 const views=await page.evaluate(()=>window.__streetProofViews);
 assert(views?.length>0,'No proof views initialized');
 for(let index=0;index<views.length;index++){
  const result=await page.evaluate(index=>window.__runStreetProof(index),index);
  for(const mode of ['color','shadow'])for(const variant of ['baseline','candidate']){
   const value=result[mode][variant],bytes=Buffer.from(value.png.split(',')[1],'base64');
   const filename=`${result.name}-${mode}-${variant}.png`;
   await fs.writeFile(path.join(output,filename),bytes);value.png={filename,sha256:sha(bytes),bytes:bytes.length};
  }
  report.views.push(result);
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({view:result.name,colorPixels:result.color.diff.pixels,shadowPixels:result.shadow.diff.pixels,shadowEvidencePixels:result.shadowDifference.pixels,triangles:[result.color.baseline.triangles,result.color.candidate.triangles],draws:[result.color.baseline.rendererCalls,result.color.candidate.rendererCalls]}));
 }
 assert.equal(report.errors.length,0,'Browser errors occurred');
 for(const result of report.views)for(const mode of ['color','shadow']){
  assert.equal(result[mode].diff.pixels,0,`${result.name} ${mode}: pixel mismatch`);
  assert(result[mode].trianglesMatch,`${result.name} ${mode}: submitted triangle mismatch`);
 }
 assert(report.views.some(v=>v.shadowDifference.pixels>0),'Fixture did not produce actual receiver-shadow pixels');
 assert(report.views.some(v=>(v.color.baseline.streetDrawCalls.drawArrays??0)>0),'Baseline did not submit actual nonindexed streets');
 assert(report.views.some(v=>(v.color.candidate.streetDrawCalls.drawElements??0)>0),'Candidate did not submit actual indexed streets');
 for(const view of report.views)for(const mode of ['color','shadow'])assert.equal(view[mode].candidate.streetDrawCalls.drawArrays??0,0,'Candidate retained a nonindexed street draw');
 assert(report.renderer.storage.candidateVertices<report.renderer.storage.sourceVertices,'No stored-vertex reduction observed');
 assert(report.renderer.storage.candidateBytes<report.renderer.storage.sourceBytes,'No combined attribute/index storage reduction observed');
 report.pass=true;
}catch(error){report.failure=String(error?.stack??error);process.exitCode=1;console.error(report.failure);}
finally{
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 await browser?.close();await new Promise(resolve=>server.close(resolve));
}
