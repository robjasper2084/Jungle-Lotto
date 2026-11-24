import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {dirname,resolve,relative,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';

const BASE='e424aac64ad82f2448c11717c38c592d666c2af9';
const WOODLAND_BASE='e424aac64ad82f2448c11717c38c592d666c2af9';
const COMPOSITION_BASE='318a94f7ce3fd47b12ec980b855e56469fcecca8';
const game=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(process.env.BELLE_SURFACE_OUTPUT??resolve(game,'surface-program-evidence'));
const source=resolve(game,'src/belle/realisticMaterials.ts');
const woodlandSource=resolve(game,'src/belle/woodland.ts');
const woodlandMap=resolve(game,'public/belle/map.json');
const fixture=resolve(game,'scripts/surface-program-fixture.ts');
const virtual='\0belle-surface-baseline';
const woodlandVirtual='\0belle-woodland-baseline';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',['-C',game,...args],{encoding:'utf8',maxBuffer:16*1024*1024}).trim();
const report={version:1,baseline:BASE,passed:false,setupComplete:false,buildOnly:process.env.BELLE_SURFACE_BUILD_ONLY==='1',
 comparisons:[],controls:[],woodlandControls:[],errors:[],consoleErrors:[],failedRequests:[],note:'Exact RGBA comparisons on native Metal. Fixture rendering/readback is validation, not a performance measurement. Counts are linked WebGL program identities, not native Metal pipeline identities. Woodland composes its original hook with the same current a3 WorldAtmosphere and realisticMaterials on both sides, including actual leaf profile/roughness bindings; it additionally records native drawElements/drawArrays submissions and exact no-subject/filled-hole pixel coverage. Its supplemental hole is explicitly derived test geometry, not a shipped map hole.'};
let browser,page,server,closing=false,deadline;
const checkpoint=()=>writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
function compare(a,b){
 assert.equal(a.length,b.length,'RGBA sizes differ');let channels=0,pixels=0,maxDifference=0;const firstPixels=[];
 for(let i=0;i<a.length;i+=4){let changed=false;for(let j=0;j<4;j++)if(a[i+j]!==b[i+j]){channels++;changed=true;maxDifference=Math.max(maxDifference,Math.abs(a[i+j]-b[i+j]));}
  if(changed){pixels++;if(firstPixels.length<16)firstPixels.push({x:(i/4)%320,yFromBottom:Math.floor(i/4/320),baseline:[...a.subarray(i,i+4)],candidate:[...b.subarray(i,i+4)]});}}
 return {equal:channels===0,differingChannels:channels,differingPixels:pixels,maxDifference,firstPixels};
}
function holeBackgroundPixels(before,filled,background){
 assert.equal(before.length,filled.length);assert.equal(before.length,background.length);
 let exposedPixels=0,filledPixels=0;const firstPixels=[];
 for(let i=0;i<before.length;i+=4){
  const open=[0,1,2,3].every(channel=>before[i+channel]===background[i+channel]);
  const changed=[0,1,2,3].some(channel=>before[i+channel]!==filled[i+channel]);
  if(changed)filledPixels++;
  if(open&&changed){exposedPixels++;if(firstPixels.length<16)firstPixels.push({x:(i/4)%320,yFromBottom:Math.floor(i/4/320)});}
 }
 return {exposedPixels,filledPixels,firstPixels};
}
async function saveCapture(name,capture){
 const rgba=Buffer.from(capture.rgba,'base64'),png=Buffer.from(capture.png,'base64');assert.equal(rgba.length,capture.width*capture.height*4);
 const colors=new Set();for(let i=0;i<rgba.length;i+=4)colors.add(rgba.readUInt32LE(i));
 await writeFile(join(output,'captures',name+'.rgba'),rgba);await writeFile(join(output,'captures',name+'.png'),png);
 const {rgba:_,png:__,...metadata}=capture;return {bytes:rgba,metadata:{...metadata,rgbaSha256:sha(rgba),pngSha256:sha(png),uniqueColors:colors.size}};
}
async function capture(id,side,view,target,name){
 const value=await page.evaluate(({id,side,view,target})=>window.__surfaceProgramFixture.render(id,side,view,target),{id,side,view,target});
 return saveCapture(name,value);
}
async function saveProgramEvidence(){
 const evidence=await page.evaluate(()=>window.__surfaceProgramFixture.programEvidence());report.final=evidence.state;report.programs=[];
 for(const program of evidence.programs){
  const {vertexSource,fragmentSource,...metadata}=program;assert(typeof vertexSource==='string'&&typeof fragmentSource==='string','Native linked shader sources unavailable for program '+program.id);
  await writeFile(join(output,'programs',program.id+'-vertex.glsl'),vertexSource);await writeFile(join(output,'programs',program.id+'-fragment.glsl'),fragmentSource);
  report.programs.push({...metadata,vertexSha256:sha(vertexSource),fragmentSha256:sha(fragmentSource)});
 }
 return evidence.state;
}
async function main(){
 await mkdir(join(output,'captures'),{recursive:true});await mkdir(join(output,'programs'),{recursive:true});
 const repo=git('rev-parse','--show-toplevel');const relativeSource=relative(repo,source).split(sep).join('/');
 const baselineSource=execFileSync('git',['-C',repo,'show',BASE+':'+relativeSource],{maxBuffer:16*1024*1024});
 const candidateSource=await readFile(source);report.source={head:git('rev-parse','HEAD'),baseline:BASE,path:relativeSource,baselineSha256:sha(baselineSource),candidateSha256:sha(candidateSource),fixtureSha256:sha(await readFile(fixture)),driverSha256:sha(await readFile(fileURLToPath(import.meta.url)))};
 await writeFile(join(output,'baseline-realisticMaterials.ts'),baselineSource);await writeFile(join(output,'candidate-realisticMaterials.ts'),candidateSource);
 const relativeWoodland=relative(repo,woodlandSource).split(sep).join('/'),relativeMap=relative(repo,woodlandMap).split(sep).join('/');
 const baselineWoodland=execFileSync('git',['-C',repo,'show',WOODLAND_BASE+':'+relativeWoodland],{maxBuffer:16*1024*1024});
 const surfaceBaselineWoodland=execFileSync('git',['-C',repo,'show',BASE+':'+relativeWoodland],{maxBuffer:16*1024*1024});
 const candidateWoodland=await readFile(woodlandSource),mapBytes=await readFile(woodlandMap);
 const baselineMap=execFileSync('git',['-C',repo,'show',WOODLAND_BASE+':'+relativeMap],{maxBuffer:16*1024*1024});
 assert(baselineWoodland.equals(surfaceBaselineWoodland),'Pinned original woodland must equal the e424 authored baseline');
 assert(mapBytes.equals(baselineMap),'Woodland comparison must use the unchanged shipped authored map');
 report.woodlandSource={head:report.source.head,baseline:WOODLAND_BASE,path:relativeWoodland,baselineSha256:sha(baselineWoodland),candidateSha256:sha(candidateWoodland),surfaceBaseline:BASE,surfaceBaselineSha256:sha(surfaceBaselineWoodland),baselineMatchesSurfaceBaseline:true};
 report.woodlandMap={path:relativeMap,baseline:WOODLAND_BASE,bytes:mapBytes.length,sha256:sha(mapBytes),baselineSha256:sha(baselineMap),unchangedFromBaseline:true};
 report.woodlandCompositionSources=[];
 for(const name of ['realisticMaterials.ts','realisticMaterialRules.ts','worldAtmosphere.ts','atmosphereShaders.ts','physicalLighting.ts']){
  const path=relative(repo,resolve(game,'src/belle',name)).split(sep).join('/'),bytes=await readFile(resolve(repo,path));
  const pinned=execFileSync('git',['-C',repo,'show',COMPOSITION_BASE+':'+path],{maxBuffer:16*1024*1024});
  assert(bytes.equals(pinned),'Woodland must use the unchanged owner-corrected current composition on both sides: '+name);
  report.woodlandCompositionSources.push({path,baseline:COMPOSITION_BASE,sha256:sha(bytes),baselineSha256:sha(pinned),sameModuleForBothSides:true});
 }
 await writeFile(join(output,'baseline-woodland.ts'),baselineWoodland);await writeFile(join(output,'candidate-woodland.ts'),candidateWoodland);
 const skinRoot=resolve(game,'public/belle/skins'),textureFiles=(await readdir(skinRoot)).filter(name=>name.endsWith('.webp')).sort();
 assert.equal(textureFiles.length,57,'Expected all57 real surface textures');const textureManifest=[];
 for(const name of textureFiles){const bytes=await readFile(join(skinRoot,name));assert(bytes.length>100,'Texture missing or placeholder: '+name);textureManifest.push({path:'belle/skins/'+name,bytes:bytes.length,sha256:sha(bytes)});}
 report.textureFiles=textureManifest.length;await writeFile(join(output,'texture-manifest.json'),JSON.stringify(textureManifest,null,2)+'\n');
 const buildDir=join(output,'bundle');
 await build({configFile:false,root:game,publicDir:false,logLevel:'warn',plugins:[{
  name:'exact-baseline-surface-module',
  async resolveId(id,importer){
   if(id==='virtual:belle-surface-baseline')return virtual;
   if(id==='virtual:belle-woodland-baseline')return woodlandVirtual;
   if(importer===virtual&&id.startsWith('.'))return this.resolve(resolve(dirname(source),id),undefined,{skipSelf:true});
   // Baseline and candidate must share the same Three and helper module objects.
   // Resolve the virtual woodland as though it occupied the real source path.
   if(importer===woodlandVirtual)return this.resolve(id.startsWith('.')?resolve(dirname(woodlandSource),id):id,woodlandSource,{skipSelf:true});
  },
  load(id){if(id===virtual)return {code:baselineSource.toString('utf8'),map:null};if(id===woodlandVirtual)return {code:baselineWoodland.toString('utf8'),map:null};},
  transform(code,id){if(id===virtual||id===woodlandVirtual)return import('typescript').then(({default:ts})=>({code:ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,map:null}));}
 }],build:{outDir:buildDir,emptyOutDir:true,target:'es2022',minify:false,sourcemap:true,lib:{entry:fixture,formats:['es'],fileName:()=> 'fixture.js'}}});
 const html=Buffer.from('<!doctype html><meta charset="utf-8"><title>Native surface comparison</title><style>body{margin:16px;background:#18212b;color:#fff;font:14px sans-serif}canvas{display:block;width:320px;height:240px}</style><script type="module" src="/fixture.js"></script>');
 await writeFile(join(buildDir,'index.html'),html);report.bundleSha256=sha(await readFile(join(buildDir,'fixture.js')));await checkpoint();
 if(report.buildOnly){report.status='build-only; native validation not executed';await checkpoint();return;}
 assert.equal(process.platform,'darwin','This fixture requires the native macOS Chrome/Metal runner');
 const allowedTextures=new Set(textureManifest.map(t=>'/'+t.path));
 server=createServer(async(req,res)=>{
  try{const path=new URL(req.url,'http://localhost').pathname;
   if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}
   let file,type;if(path==='/'||path==='/index.html'){file=join(buildDir,'index.html');type='text/html';}
   else if(path==='/fixture.js'){file=join(buildDir,'fixture.js');type='application/javascript';}
   else if(path==='/fixture.js.map'){file=join(buildDir,'fixture.js.map');type='application/json';}
   else if(allowedTextures.has(path)){file=join(skinRoot,path.split('/').at(-1));type='image/webp';}
   else{res.writeHead(404);res.end('Not found');return;}
   const bytes=await readFile(file);res.writeHead(200,{'Content-Type':type,'Content-Length':bytes.length,'Cache-Control':'no-store'});res.end(bytes);
  }catch(error){res.writeHead(500);res.end(String(error));}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const require=createRequire(resolve(game,'../../package.json')),{chromium}=require('@playwright/test');
 report.runtime={node:process.version,platform:process.platform,arch:process.arch,playwright:require('@playwright/test/package.json').version};
 report.launch={channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']};
 browser=await chromium.launch(report.launch);report.browserVersion=browser.version();
 page=await browser.newPage({viewport:{width:800,height:600},deviceScaleFactor:1,isMobile:false,hasTouch:false});page.setDefaultTimeout(120000);await page.bringToFront();
 page.on('pageerror',error=>report.errors.push(error.stack??String(error)));
 page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
 page.on('response',response=>{if(response.status()>=400)report.failedRequests.push('HTTP'+response.status()+' '+response.url());});
 page.on('requestfailed',request=>{if(!closing)report.failedRequests.push((request.failure()?.errorText??'failed')+' '+request.url());});
 // One bounded attempt. Timeout closes the browser and remains a setup failure;
 // it never starts another browser, switches backend, or retries comparisons.
 deadline=setTimeout(()=>{report.errors.push('Native fixture exceeded180seconds');void browser?.close().catch(error=>report.errors.push('Timeout browser cleanup: '+String(error)));},180000);
 report.url='http://127.0.0.1:'+server.address().port;
 await page.goto(report.url,{waitUntil:'load'});await page.waitForFunction(()=>!!window.__surfaceProgramFixture);
 report.initial=await page.evaluate(()=>window.__surfaceProgramFixture.ready);report.setupComplete=true;await checkpoint();
 assert.equal(report.initial.woodland.mapSha256,report.woodlandMap.sha256,'Browser woodland map bytes differ from the hashed shipped map');
 assert.equal(report.initial.woodland.cases.length,2,'Both shipped-map and supplemental-hole woodland cases are required');
 for(const id of report.initial.cases)for(const view of [0,1])for(const target of ['screen-msaa4','target-samples0']){
  const name=[id,'view'+view,target].join('-');
  const a=await capture(id,'baseline',view,target,name+'-baseline');
  const b=await capture(id,'candidate',view,target,name+'-candidate');
  // A genuine dark zero-pigment surface may use fewer than 20 encoded colors.
  // Prove the subject contributes pixels by rendering the same scene with only
  // that subject hidden, instead of treating low color diversity as a blank.
  // Retain every raw capture before any assertion, including failed evidence.
  const backgroundValue=await page.evaluate(({id,view,target})=>window.__surfaceProgramFixture.renderWithoutSubject(id,'baseline',view,target),{id,view,target});
  const background=await saveCapture(name+'-without-subject',backgroundValue);
  const baselineCoverage=compare(a.bytes,background.bytes),candidateCoverage=compare(b.bytes,background.bytes);
  const subjectVisible=baselineCoverage.differingPixels>=16&&candidateCoverage.differingPixels>=16;
  const woodland=a.metadata.woodlandProof?{
   baselineDrawCalls:a.metadata.woodlandProof.nativeDrawCalls,candidateDrawCalls:b.metadata.woodlandProof.nativeDrawCalls,
   baselineSubmittedTriangles:a.metadata.woodlandProof.submittedTriangles,candidateSubmittedTriangles:b.metadata.woodlandProof.submittedTriangles,
   actualDrawReduction:a.metadata.woodlandProof.nativeDrawCalls>b.metadata.woodlandProof.nativeDrawCalls&&b.metadata.woodlandProof.nativeDrawCalls===1,
   backgroundHasNoDraws:background.metadata.woodlandProof.nativeDrawCalls===0,
   baselineDrawPixels:baselineCoverage.differingPixels,candidateDrawPixels:candidateCoverage.differingPixels,
   surfaceBindingsMatch:JSON.stringify({...a.metadata.woodlandProof.binding,programId:undefined})===JSON.stringify({...b.metadata.woodlandProof.binding,programId:undefined})
  }:undefined;
  const comparison={name,...compare(a.bytes,b.bytes),subjectVisible,baselineCoverage,candidateCoverage,background:background.metadata,baseline:a.metadata,candidate:b.metadata,woodland};report.comparisons.push(comparison);
  await writeFile(join(output,'captures',name+'-comparison.json'),JSON.stringify(comparison,null,2)+'\n');
  await checkpoint();
  assert(subjectVisible,'Subject must visibly contribute pixels: '+name);
 }
 const controlId='axis-triplanar-pigment',controlTarget='screen-msaa4';
 const controlBefore=await capture(controlId,'candidate',0,controlTarget,'control-before');let controlChanged;
 try{await page.evaluate(()=>window.__surfaceProgramFixture.setNegativeControl(true));controlChanged=await capture(controlId,'candidate',0,controlTarget,'control-changed');}
 finally{await page.evaluate(()=>window.__surfaceProgramFixture.setNegativeControl(false));}
 const controlRestored=await capture(controlId,'candidate',0,controlTarget,'control-restored');
 const difference=compare(controlBefore.bytes,controlChanged.bytes),restoration=compare(controlBefore.bytes,controlRestored.bytes);
 report.controls.push({name:'mutate-real-candidate-skinPlanar-uniform',passed:!difference.equal&&restoration.equal,difference,restoration,before:controlBefore.metadata,changed:controlChanged.metadata,restored:controlRestored.metadata});
 await checkpoint();
 const batchId='static-palette-projection-bindings';
 const batchBefore=await capture(batchId,'candidate',0,controlTarget,'batch-control-before');let batchChanged;
 try{await page.evaluate(()=>window.__surfaceProgramFixture.setBatchNegativeControl(true));batchChanged=await capture(batchId,'candidate',0,controlTarget,'batch-control-changed');}
 finally{await page.evaluate(()=>window.__surfaceProgramFixture.setBatchNegativeControl(false));}
 const batchRestored=await capture(batchId,'candidate',0,controlTarget,'batch-control-restored');
 const batchDifference=compare(batchBefore.bytes,batchChanged.bytes),batchRestoration=compare(batchBefore.bytes,batchRestored.bytes);
 const bindingMismatch=batchChanged.metadata.batchProof.some(p=>!p.matchesExpected);
 report.controls.push({name:'mutate-real-triplanar-batch-binding',passed:!batchDifference.equal&&batchRestoration.equal&&bindingMismatch,difference:batchDifference,restoration:batchRestoration,bindingMismatch,before:batchBefore.metadata,changed:batchChanged.metadata,restored:batchRestored.metadata});
 await checkpoint();
 const woodlandId='woodland-supplemental-hole';
 for(const view of [0,1])for(const target of ['screen-msaa4','target-samples0']){
  const name=['woodland-hole-control','view'+view,target].join('-');
  const before=await capture(woodlandId,'candidate',view,target,name+'-before');
  const backgroundValue=await page.evaluate(({id,view,target})=>window.__surfaceProgramFixture.renderWithoutSubject(id,'candidate',view,target),{id:woodlandId,view,target});
  const background=await saveCapture(name+'-without-subject',backgroundValue);let changed;
  try{await page.evaluate(()=>window.__surfaceProgramFixture.setWoodlandHoleNegativeControl(true));changed=await capture(woodlandId,'candidate',view,target,name+'-filled');}
  finally{await page.evaluate(()=>window.__surfaceProgramFixture.setWoodlandHoleNegativeControl(false));}
  const restored=await capture(woodlandId,'candidate',view,target,name+'-restored');
  const difference=compare(before.bytes,changed.bytes),restoration=compare(before.bytes,restored.bytes),coverage=holeBackgroundPixels(before.bytes,changed.bytes,background.bytes);
  const additionalNativeDraw=changed.metadata.woodlandProof.nativeDrawCalls===before.metadata.woodlandProof.nativeDrawCalls+1;
  report.woodlandControls.push({name,view,target,passed:difference.differingPixels>=16&&restoration.equal&&coverage.exposedPixels>=16&&additionalNativeDraw,
   difference,restoration,coverage,additionalNativeDraw,before:before.metadata,filled:changed.metadata,restored:restored.metadata,background:background.metadata});
  await checkpoint();
 }
 await saveProgramEvidence();
 await page.screenshot({path:join(output,'fixture-window.png')});
 assert.equal(sha(await readFile(source)),report.source.candidateSha256,'Candidate source changed duringfixture');
 assert.equal(sha(await readFile(woodlandSource)),report.woodlandSource.candidateSha256,'Woodland candidate source changed during fixture');
 assert.equal(sha(await readFile(woodlandMap)),report.woodlandMap.sha256,'Shipped map changed during fixture');
 for(const file of report.woodlandCompositionSources)assert.equal(sha(await readFile(resolve(repo,file.path))),file.sha256,'Woodland composition source changed during fixture: '+file.path);
 // Output tone mapping is a native Three program axis. Require4→1 separately
 // for screen and offscreen, rather than conflating their distinct shaders.
 report.cohortReduction=Object.fromEntries(Object.entries(report.final.programCounts.cohortByOutput).map(([target,counts])=>[target,{baselinePrograms:counts.baseline,candidatePrograms:counts.candidate,expectedBaseline:4,expectedCandidate:1,passed:counts.baseline.length===4&&counts.candidate.length===1}]));
 report.batchLifecyclePassed=report.final.batching.length===1&&Object.values(report.final.batching[0].sides).every(b=>b.sourceDraws===4&&b.batches===2&&b.begins===b.ends&&b.begins>=4&&b.sourceGeometryUnchanged&&!b.batchRootVisible&&b.sourceVisibility.every(Boolean));
 const woodlandComparisons=report.comparisons.filter(c=>c.woodland);
 report.woodlandPassed=woodlandComparisons.length===8&&woodlandComparisons.every(c=>c.equal&&c.subjectVisible&&c.woodland.actualDrawReduction&&c.woodland.backgroundHasNoDraws&&c.woodland.surfaceBindingsMatch)&&report.woodlandControls.length===4&&report.woodlandControls.every(c=>c.passed)&&report.final.woodland.cases.every(c=>!c.negativeControlActive);
 report.passed=report.comparisons.length===report.initial.cases.length*4&&report.comparisons.every(c=>c.equal&&c.subjectVisible)&&report.controls.length===2&&report.controls.every(c=>c.passed)&&Object.values(report.cohortReduction).every(c=>c.passed)&&report.batchLifecyclePassed&&report.woodlandPassed&&report.final.immutableGeometry&&report.programs.every(p=>p.linked)&&!report.final.errors.length&&!report.errors.length&&!report.consoleErrors.length&&!report.failedRequests.length;
 report.status=report.passed?'passed':'failed; exact mismatches and all controls retained';
 await checkpoint();
}
try{await main();}catch(error){report.passed=false;report.errors.push(error.stack??String(error));report.status=report.setupComplete?'execution-failed':'setup-failed';}
finally{
 clearTimeout(deadline);
 if(page&&report.setupComplete&&!report.programs)try{await saveProgramEvidence();}catch(error){report.errors.push('Program evidence after failure: '+String(error));}
 closing=true;
 try{await browser?.close();}catch(error){report.errors.push('Browser cleanup: '+String(error));report.passed=false;}
 if(server)await new Promise(resolve=>server.close(resolve));
 await mkdir(output,{recursive:true});await checkpoint();
 console.log(JSON.stringify({status:report.status,passed:report.passed,comparisons:report.comparisons.length,mismatches:report.comparisons.filter(c=>!c.equal).length,cohortReduction:report.cohortReduction,woodlandPassed:report.woodlandPassed,errors:report.errors.slice(0,3)}));
 if(!report.passed&&!report.buildOnly)process.exitCode=1;
 if(report.buildOnly&&report.errors.length)process.exitCode=1;
}
