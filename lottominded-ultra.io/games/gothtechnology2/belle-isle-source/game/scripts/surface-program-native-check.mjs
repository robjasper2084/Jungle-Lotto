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
const game=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(process.env.BELLE_SURFACE_OUTPUT??resolve(game,'surface-program-evidence'));
const source=resolve(game,'src/belle/realisticMaterials.ts');
const fixture=resolve(game,'scripts/surface-program-fixture.ts');
const virtual='\0belle-surface-baseline';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',['-C',game,...args],{encoding:'utf8',maxBuffer:16*1024*1024}).trim();
const report={version:1,baseline:BASE,passed:false,setupComplete:false,buildOnly:process.env.BELLE_SURFACE_BUILD_ONLY==='1',
 comparisons:[],controls:[],errors:[],consoleErrors:[],failedRequests:[],note:'Exact RGBA comparisons on native Metal. Fixture rendering/readback is validation, not a performance measurement. Counts are linked WebGL program identities, not native Metal pipeline identities.'};
let browser,page,server,closing=false,deadline;
const checkpoint=()=>writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
function compare(a,b){
 assert.equal(a.length,b.length,'RGBA sizes differ');let channels=0,pixels=0,maxDifference=0;const firstPixels=[];
 for(let i=0;i<a.length;i+=4){let changed=false;for(let j=0;j<4;j++)if(a[i+j]!==b[i+j]){channels++;changed=true;maxDifference=Math.max(maxDifference,Math.abs(a[i+j]-b[i+j]));}
  if(changed){pixels++;if(firstPixels.length<16)firstPixels.push({x:(i/4)%320,yFromBottom:Math.floor(i/4/320),baseline:[...a.subarray(i,i+4)],candidate:[...b.subarray(i,i+4)]});}}
 return {equal:channels===0,differingChannels:channels,differingPixels:pixels,maxDifference,firstPixels};
}
async function saveCapture(name,capture){
 const rgba=Buffer.from(capture.rgba,'base64'),png=Buffer.from(capture.png,'base64');assert.equal(rgba.length,capture.width*capture.height*4);
 const colors=new Set();for(let i=0;i<rgba.length;i+=4)colors.add(rgba.readUInt32LE(i));assert(colors.size>20,'Blank or uninformative capture '+name);
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
 const skinRoot=resolve(game,'public/belle/skins'),textureFiles=(await readdir(skinRoot)).filter(name=>name.endsWith('.webp')).sort();
 assert.equal(textureFiles.length,57,'Expected all57 real surface textures');const textureManifest=[];
 for(const name of textureFiles){const bytes=await readFile(join(skinRoot,name));assert(bytes.length>100,'Texture missing or placeholder: '+name);textureManifest.push({path:'belle/skins/'+name,bytes:bytes.length,sha256:sha(bytes)});}
 report.textureFiles=textureManifest.length;await writeFile(join(output,'texture-manifest.json'),JSON.stringify(textureManifest,null,2)+'\n');
 const buildDir=join(output,'bundle');
 await build({configFile:false,root:game,publicDir:false,logLevel:'warn',plugins:[{
  name:'exact-baseline-surface-module',
  async resolveId(id,importer){
   if(id==='virtual:belle-surface-baseline')return virtual;
   if(importer===virtual&&id.startsWith('.'))return this.resolve(resolve(dirname(source),id),undefined,{skipSelf:true});
  },
  load(id){if(id===virtual)return {code:baselineSource.toString('utf8'),map:null};},
  transform(code,id){if(id===virtual)return import('typescript').then(({default:ts})=>({code:ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,map:null}));}
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
 for(const id of report.initial.cases)for(const view of [0,1])for(const target of ['screen-msaa4','target-samples0']){
  const name=[id,'view'+view,target].join('-');
  const a=await capture(id,'baseline',view,target,name+'-baseline');
  const b=await capture(id,'candidate',view,target,name+'-candidate');
  const comparison={name,...compare(a.bytes,b.bytes),baseline:a.metadata,candidate:b.metadata};report.comparisons.push(comparison);
  await writeFile(join(output,'captures',name+'-comparison.json'),JSON.stringify(comparison,null,2)+'\n');
  await checkpoint();
 }
 const controlId='axis-triplanar-pigment',controlTarget='screen-msaa4';
 const controlBefore=await capture(controlId,'candidate',0,controlTarget,'control-before');let controlChanged;
 try{await page.evaluate(()=>window.__surfaceProgramFixture.setNegativeControl(true));controlChanged=await capture(controlId,'candidate',0,controlTarget,'control-changed');}
 finally{await page.evaluate(()=>window.__surfaceProgramFixture.setNegativeControl(false));}
 const controlRestored=await capture(controlId,'candidate',0,controlTarget,'control-restored');
 const difference=compare(controlBefore.bytes,controlChanged.bytes),restoration=compare(controlBefore.bytes,controlRestored.bytes);
 report.controls.push({name:'mutate-real-candidate-skinPlanar-uniform',passed:!difference.equal&&restoration.equal,difference,restoration,before:controlBefore.metadata,changed:controlChanged.metadata,restored:controlRestored.metadata});
 await checkpoint();
 await saveProgramEvidence();
 await page.screenshot({path:join(output,'fixture-window.png')});
 assert.equal(sha(await readFile(source)),report.source.candidateSha256,'Candidate source changed duringfixture');
 // Output tone mapping is a native Three program axis. Require4→1 separately
 // for screen and offscreen, rather than conflating their distinct shaders.
 report.cohortReduction=Object.fromEntries(Object.entries(report.final.programCounts.cohortByOutput).map(([target,counts])=>[target,{baselinePrograms:counts.baseline,candidatePrograms:counts.candidate,expectedBaseline:4,expectedCandidate:1,passed:counts.baseline.length===4&&counts.candidate.length===1}]));
 report.passed=report.comparisons.length===report.initial.cases.length*4&&report.comparisons.every(c=>c.equal)&&report.controls.every(c=>c.passed)&&Object.values(report.cohortReduction).every(c=>c.passed)&&report.final.immutableGeometry&&report.programs.every(p=>p.linked)&&!report.final.errors.length&&!report.errors.length&&!report.consoleErrors.length&&!report.failedRequests.length;
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
 console.log(JSON.stringify({status:report.status,passed:report.passed,comparisons:report.comparisons.length,mismatches:report.comparisons.filter(c=>!c.equal).length,cohortReduction:report.cohortReduction,errors:report.errors.slice(0,3)}));
 if(!report.passed&&!report.buildOnly)process.exitCode=1;
 if(report.buildOnly&&report.errors.length)process.exitCode=1;
}
