import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {analyzeBenefit} from './contract.mjs';

const directory=import.meta.dirname,repo=resolve(directory,'../../..'),pins=JSON.parse(await readFile(resolve(directory,'pins.json'),'utf8'));
const compileOnly=process.argv.includes('--compile-only');
assert(!process.env.PAVEMENT_BENEFIT_LOCAL_GAME||compileOnly,'A local path override is allowed only for compilation');
const game=resolve(process.env.PAVEMENT_BENEFIT_LOCAL_GAME??resolve(repo,pins.game));
const output=compileOnly?resolve(directory,'local-validation'):resolve(repo,'output/pavement-depth-benefit');
await mkdir(output,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:repo,maxBuffer:128*1024*1024});
const gitText=(...args)=>git(...args).toString('utf8').trim();
let sourceHead=null,sourceTree=null;
const provenance={baselineFixture:pins.baseHead,baselineFixtureTree:pins.baseTree,originalApplication:pins.originalApplication,files:{},authoredSnippets:{},servedAssets:{},diagnosticFiles:{}};
for(const [path,expected]of Object.entries(pins.files)){
 const bytes=await readFile(resolve(game,path));assert.equal(hash(bytes),expected,'Exact fixture/helper pin '+path);provenance.files[path]={sha256:expected,bytes:bytes.length};
}
const originalPins=(await import(pathToFileURL(resolve(game,'scripts/pavement-depth-proof-pins.mjs')).href)).PAVEMENT_PROOF_PINS;
assert.equal(originalPins.baseHead,pins.originalApplication);
for(const [path,expected]of Object.entries(originalPins.unchangedFiles)){
 const bytes=await readFile(resolve(game,path));assert.equal(hash(bytes),expected,'Retained original application '+path);provenance.files[path]={sha256:expected,bytes:bytes.length};
}
if(!compileOnly){
 sourceHead=gitText('rev-parse','HEAD');sourceTree=gitText('rev-parse','HEAD^{tree}');
 assert.equal(sourceHead,process.env.PAVEMENT_BENEFIT_SOURCE_SHA,'Exact diagnostic checkout');
 assert.equal(gitText('rev-parse',pins.baseHead+'^{tree}'),pins.baseTree);
 assert.equal(gitText('diff','HEAD','--'),'','No tracked working-tree edits');
 const changes=gitText('diff','--name-status',pins.baseHead,'HEAD','--').split('\n').filter(Boolean);
 assert(changes.length>0);
 for(const change of changes){const [status,path]=change.split('\t');assert.equal(status,'A','Child diagnostic must add only new files');assert(path.startsWith('.github/diagnostics/pavement-depth-benefit/')||path==='.github/workflows/belle-pavement-depth-benefit.yml');}
 provenance.git={sourceHead,sourceTree,base:pins.baseHead,changes,workingTreeClean:true};
}
for(const name of ['pins.json','run.mjs','browser.ts','timer.ts','fixture.d.ts','contract.mjs','contract.test.mjs','timer.test.ts']){
 const bytes=await readFile(resolve(directory,name));provenance.diagnosticFiles[name]={sha256:hash(bytes),bytes:bytes.length};
}
function span(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,'Reviewed source span: '+start);return source.slice(a,b);}
const world=await readFile(resolve(game,'src/belle/world.ts'),'utf8'),shore=await readFile(resolve(game,'src/belle/shore.ts'),'utf8');
const snippets={mat:span(world,'const mat=','export async function createWorld'),grass:span(world,'const grass=mat(',';const pavement=mat('),
 poly:span(world,'function poly(','function road('),approaches:span(shore,' const bridge=data.bridge,ux=',' const foam=addShoreWash')};
for(const [name,source]of Object.entries(snippets)){assert.equal(hash(source),originalPins.snippets[name].sha256);provenance.authoredSnippets[name]={sha256:hash(source),bytes:Buffer.byteLength(source)};}
const authored="import * as T from 'three';\nimport type {Point,ParkMap,ParkTerrain} from '../src/belle/terrain.ts';\n"+
 snippets.mat+"\nexport function authoredGrass(){"+snippets.grass+";grass.name='Park lawn';return grass;}\n"+
 snippets.poly+"\nexport const authoredPoly=poly;\nexport function authoredApproaches(scene:T.Scene,data:ParkMap,terrain:ParkTerrain,grass:T.Material){"+snippets.approaches+"}\n";
const proof=await readFile(resolve(game,'scripts/pavement-depth-proof-browser.ts'),'utf8');
const prefix=proof.slice(0,proof.indexOf('(window as unknown as {__pavementDepthProof:'));assert(prefix.length>10000);
const poses=span(proof,' const poses=[',' for(const pose of poses)');
const setup=span(proof,'  if(pose.recorded){','  f.depths.forEach(d=>d.visible=true);await renderer.compileAsync(scene,camera);');
provenance.fixtureSpans=Object.fromEntries(Object.entries({prefix,poses,setup}).map(([name,value])=>[name,{sha256:hash(value),bytes:Buffer.byteLength(value)}]));
const fixture=prefix+"\nlet timingFixture:Awaited<typeof ready>;\n"+
 "export {gl,fence};\nexport async function fixtureIdentity(){timingFixture=await ready;return{gpu:timingFixture.gpu,assetSha256:timingFixture.assetSha256};}\n"+
 "export function cameraInputs(){return{world:bits(camera.matrixWorld.elements),view:bits(camera.matrixWorldInverse.elements),projection:bits(camera.projectionMatrix.elements)};}\n"+
 "export function fixtureSettings(){const attrs=gl.getContextAttributes()!;return{width:canvas.width,height:canvas.height,pixelRatio:renderer.getPixelRatio(),antialias:attrs.antialias,alpha:attrs.alpha,depth:attrs.depth,stencil:attrs.stencil,preserveDrawingBuffer:attrs.preserveDrawingBuffer,outputType:T.UnsignedByteType,outputColorSpace:renderer.outputColorSpace,toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,shadowEnabled:renderer.shadowMap.enabled,shadowType:renderer.shadowMap.type,shadowMapSize:sun.shadow.mapSize.x};}\n"+
 "export function ownerInputs(){return timingFixture.receipts.map(r=>({sourceId:r.source.id,name:r.source.name,geometryId:r.geometry.id,positionId:attributeId(r.geometry.getAttribute('position')),indexId:attributeId(r.geometry.index),vertices:r.geometry.getAttribute('position').count,indices:r.geometry.index!.count,materialId:attributeId(r.material),materialVersion:r.material.version,roughness:r.material.roughness,opacity:r.material.opacity,transparent:r.material.transparent,depthWrite:r.material.depthWrite}));}\n"+
 "export function setTimingMode(mode:'baseline'|'candidate'){if(mode!=='baseline'&&mode!=='candidate')throw Error('Unknown timing mode');timingFixture.depths.forEach(d=>d.visible=mode==='candidate');}\n"+
 "export function timingRender(){trace=[];renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);return{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,lines:renderer.info.render.lines,points:renderer.info.render.points,frame:renderer.info.render.frame,draws:trace.slice(),depthStats:timingFixture.handle.read(),ownersIntact:timingFixture.receipts.every(r=>r.source.material===r.material&&r.source.geometry===r.geometry&&r.material.onBeforeCompile===r.compile&&r.material.customProgramCacheKey===r.key)};}\n"+
 "export async function prepareTimingCase(index:number){if(!Number.isInteger(index)||index<0||index>=6)throw Error('Unknown timing case');const f=await ready;timingFixture=f;\n"+
 poses+"\nconst pose=poses[Math.floor(index/2)],night=index%2===1,name=pose.name+(night?'-night':'-day');\n"+setup+
 "\nf.depths.forEach(d=>d.visible=true);await renderer.compileAsync(scene,camera);return{name,cameraInput,shadowAnchor,gpu:f.gpu,assetSha256:f.assetSha256,pose,night,rawCamera:{world:camera.matrixWorld.elements.slice(),view:camera.matrixWorldInverse.elements.slice(),projection:camera.projectionMatrix.elements.slice()},lighting:{sunPosition:sun.position.toArray(),target:sun.target.position.toArray(),sunIntensity:sun.intensity,hemisphereIntensity:hemi.intensity,lampIntensity:lamp.intensity,lampPosition:lamp.position.toArray(),atmosphereTime:12}};}\n";
await writeFile(resolve(output,'source-bound-fixture.ts'),fixture);await writeFile(resolve(output,'authored-components.ts'),authored);
// Type-check the generated fixture without changing its measured import graph.
// Only this check copy spells the same reviewed relative modules absolutely.
const fixtureCheck=fixture.replace(/from '(\.\.?\/[^']+)'/g,(_all,path)=>"from '"+resolve(game,'scripts',path).split(sep).join('/')+"'");
await writeFile(resolve(output,'fixture-check.ts'),fixtureCheck);
const require=createRequire(resolve(game,'package.json')),{build}=require('esbuild');
const compiled=await build({absWorkingDir:game,entryPoints:[resolve(directory,'browser.ts')],nodePaths:[resolve(game,'node_modules')],bundle:true,format:'esm',target:'es2022',write:false,logLevel:'error',
 plugins:[{name:'unchanged-source-bound-fixture',setup(builder){
  builder.onResolve({filter:/^pavement-benefit-fixture$/},()=>({path:'pavement-benefit-fixture',namespace:'fixture'}));
  builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:fixture,loader:'ts',resolveDir:resolve(game,'scripts')}));
  builder.onResolve({filter:/^pavement-proof-authored$/},()=>({path:'pavement-proof-authored',namespace:'authored'}));
  builder.onLoad({filter:/.*/,namespace:'authored'},()=>({contents:authored,loader:'ts',resolveDir:resolve(game,'scripts')}));
 }}]});
const javascript=compiled.outputFiles[0].contents;provenance.bundle={sha256:hash(javascript),bytes:javascript.length};
const typeConfig={extends:resolve(game,'tsconfig.json'),compilerOptions:{noEmit:true,types:['node'],typeRoots:[resolve(game,'node_modules/@types')],
 paths:{three:[resolve(game,'node_modules/@types/three/index.d.ts')],'three/*':[resolve(game,'node_modules/@types/three/*')],
 '@digital-static/ridecore':[resolve(game,'runtime/ride-core/src/index.ts')]}},
 include:[resolve(directory,'browser.ts'),resolve(directory,'timer.ts'),resolve(directory,'timer.test.ts'),resolve(directory,'fixture.d.ts'),
  resolve(output,'fixture-check.ts'),resolve(game,'scripts/pavement-proof-authored.d.ts'),resolve(game,'src/belle/vite-env.d.ts')]};
await writeFile(resolve(output,'tsconfig.json'),JSON.stringify(typeConfig,null,2)+'\n');
execFileSync(process.execPath,[resolve(game,'node_modules/typescript/bin/tsc'),'-p',resolve(output,'tsconfig.json'),'--pretty','false'],{stdio:'inherit'});
await writeFile(resolve(output,'source-provenance.json'),JSON.stringify(provenance,null,2)+'\n');
if(compileOnly){console.log(JSON.stringify({compiled:true,strictTypecheck:true,...provenance.bundle}));process.exit(0);}

const publicRoot=resolve(game,'public'),requestErrors=[],failedRequests=[],assetCache=new Map();
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://127.0.0.1').pathname;
 if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}canvas{display:block;width:1280px;height:800px}</style></head><body><canvas></canvas><script type="module" src="/benefit.js"></script></body></html>');return;}
 if(path==='/benefit.js'){res.setHeader('Content-Type','text/javascript');res.end(javascript);return;}
 if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}
 const filename=resolve(publicRoot,'.'+decodeURIComponent(path));assert(filename.startsWith(publicRoot+sep),'Public asset root');
 let bytes=assetCache.get(filename);
 if(!bytes){
  bytes=await readFile(filename);const repoPath=relative(repo,filename).split(sep).join('/'),expected=git('show',pins.baseHead+':'+repoPath);
  assert(bytes.equals(expected),'Served asset differs from exact c1a76 source: '+repoPath);assetCache.set(filename,bytes);
  provenance.servedAssets[repoPath]={sha256:hash(bytes),bytes:bytes.length};
 }
 res.setHeader('Content-Type',({'.json':'application/json','.bin':'application/octet-stream','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'})[extname(filename)]??'application/octet-stream');res.end(bytes);
}catch(error){requestErrors.push(String(error));res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browserRequire=createRequire(resolve(game,'../../package.json')),{chromium}=browserRequire('@playwright/test');
let browser;const errors=[],report={sourceHead,sourceTree,baseFixture:pins.baseHead,originalApplication:pins.originalApplication,platform:process.platform,
 sourceProvenance:provenance,errors,failedRequests,requestErrors,result:null,analysis:null};
try{
 const native=process.platform==='darwin';
 browser=await chromium.launch(native?{channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']}:
  {channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 page.on('pageerror',error=>errors.push(String(error)));page.on('requestfailed',request=>failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
 await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load',timeout:120000});
 await page.waitForFunction(()=>typeof window.__pavementDepthBenefit==='function',null,{timeout:120000});
 report.result=await page.evaluate(()=>window.__pavementDepthBenefit());
 assert(native?/Metal/i.test(report.result.gpu)&&!/SwiftShader|llvmpipe/i.test(report.result.gpu):/SwiftShader/i.test(report.result.gpu),'Observed expected backend');
 assert.equal(errors.length,0);assert.equal(failedRequests.length,0);assert.equal(requestErrors.length,0);
 assert.equal(gitText('diff','HEAD','--'),'','No tracked source changes during sampling');
 report.analysis=analyzeBenefit(report.result);
 if(!report.analysis.eligible)process.exitCode=1;
}catch(error){errors.push(String(error));report.analysis={eligible:false,performanceConclusion:null,fullGameAcceptance:false};process.exitCode=1;}
finally{
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 await writeFile(resolve(output,'source-provenance.json'),JSON.stringify(provenance,null,2)+'\n');
 if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
}
console.log(JSON.stringify({sourceHead,baseFixture:pins.baseHead,renderer:report.result?.gpu,analysis:report.analysis,errors}));
