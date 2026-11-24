import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {dirname,resolve,relative,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {build} from 'vite';

const BASE='a1c369132618cd27bec00a87ba6376a3ebac46bd';
const SUPPORT_BASE='09cf5f3c7438bb198c922087f6d92435780d095e';
const game=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(process.env.BELLE_ASPHALT_OUTPUT??join(game,'asphalt-layout-evidence'));
const fixture=join(game,'scripts/asphalt-layout-fixture.ts'),driver=fileURLToPath(import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',['-C',game,...args],{encoding:'utf8',maxBuffer:16*1024*1024}).trim();
const report={version:1,baseline:BASE,supportBaseline:SUPPORT_BASE,passed:false,setupComplete:false,buildOnly:process.env.BELLE_ASPHALT_BUILD_ONLY==='1',comparisons:[],controls:[],errors:[],consoleErrors:[],failedRequests:[],
 note:'Standalone asphalt-layout validation: original interleaved pavement and input assets are pinned to purea1; both sides use the exact support source pinned to the current pure product. Authored asphalt material and cloud construction remain byte-identical to purea1. The separate shader fixture is independently required; Exact rawRGBA, authored mesh bytes, actual indexed draws and native active pointers are checked; these are not performance or native Metal pipeline-count measurements.'};
let browser,page,server,deadline,closing=false;
const checkpoint=()=>writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const expectedComponents=new Map();
function compare(a,b){
 assert.equal(a.length,b.length,'RGBA lengths differ');let channels=0,pixels=0,maxDifference=0;const firstPixels=[];
 for(let i=0;i<a.length;i+=4){let changed=false;for(let j=0;j<4;j++)if(a[i+j]!==b[i+j]){channels++;changed=true;maxDifference=Math.max(maxDifference,Math.abs(a[i+j]-b[i+j]));}
  if(changed){pixels++;if(firstPixels.length<16)firstPixels.push({x:(i/4)%320,yFromBottom:Math.floor(i/4/320),baseline:[...a.subarray(i,i+4)],candidate:[...b.subarray(i,i+4)]});}}
 return {equal:channels===0,differingChannels:channels,differingPixels:pixels,maxDifference,firstPixels};
}
async function capture(side,view,target,present,name){
 const value=await page.evaluate(({side,view,target,present})=>window.__asphaltLayoutFixture.render(side,view,target,present),{side,view,target,present});
 const rgba=Buffer.from(value.rgba,'base64'),png=Buffer.from(value.png,'base64');
 // Write all bytes and metadata before any capture validation can reject them.
 await writeFile(join(output,'captures',name+'.rgba'),rgba);await writeFile(join(output,'captures',name+'.png'),png);
 const {rgba:_,png:__,...metadata}=value;
 const record={...metadata,rgbaSha256:hash(rgba),pngSha256:hash(png),rgbaBytes:rgba.length};
 await writeFile(join(output,'captures',name+'.json'),JSON.stringify(record,null,2)+'\n');
 assert.equal(rgba.length,value.width*value.height*4,'Capture byte length invalid');
 return {bytes:rgba,metadata:record};
}
function canonicalMetadata(row){
 const {geometryId,attributes,index,...metadata}=row;
 return {...metadata,attributes:Object.fromEntries(Object.entries(attributes).map(([name,a])=>[name,{itemSize:a.itemSize,count:a.count,normalized:a.normalized,componentType:a.componentType,sha256:a.sha256}])),index:{type:index.type,count:index.count,sha256:index.sha256}};
}
async function saveGeometry(label){
 const result=await page.evaluate(()=>window.__asphaltLayoutFixture.geometryEvidence());
 let sourceMatch=true,layoutMatch=true;
 for(const [side,groups]of Object.entries(result))for(const [kind,row]of Object.entries(groups)){
  for(const [name,attribute]of Object.entries(row.attributes)){
   const bytes=Buffer.from(attribute.bytes,'base64');delete attribute.bytes;
   await writeFile(join(output,'geometry',[label,side,kind,name].join('-')+'.bin'),bytes);
   attribute.sha256=hash(bytes);attribute.byteLength=bytes.length;attribute.matchesPinnedSource=bytes.equals(expectedComponents.get(kind)[name]);
   sourceMatch&&=attribute.matchesPinnedSource;
   const packed=side==='candidate'&&kind==='asphalt',itemSize=name==='uv'?2:3,offset=packed?0:name==='normal'?3:name==='uv'?6:0;
   attribute.layoutMatches=attribute.componentType==='Float32Array'&&attribute.itemSize===itemSize&&!attribute.normalized&&attribute.interleaved===!packed&&attribute.stride===(packed?itemSize:8)&&attribute.offset===offset;
   layoutMatch&&=attribute.layoutMatches;
  }
  const bytes=Buffer.from(row.index.bytes,'base64');delete row.index.bytes;
  await writeFile(join(output,'geometry',[label,side,kind,'index'].join('-')+'.bin'),bytes);
  row.index.sha256=hash(bytes);row.index.byteLength=bytes.length;row.index.matchesPinnedSource=bytes.equals(expectedComponents.get(kind).index);
  sourceMatch&&=row.index.matchesPinnedSource;
 }
 const kinds=Object.keys(result.baseline),metadataMatch=kinds.length===5&&Object.keys(result.candidate).length===5&&kinds.every(kind=>JSON.stringify(canonicalMetadata(result.baseline[kind]))===JSON.stringify(canonicalMetadata(result.candidate[kind])));
 return {passed:sourceMatch&&layoutMatch&&metadataMatch,sourceMatch,layoutMatch,metadataMatch,sides:result};
}
async function savePrograms(){
 const evidence=await page.evaluate(()=>window.__asphaltLayoutFixture.programEvidence());report.final=evidence.state;report.programs=[];
 for(const {vertexSource,fragmentSource,...program}of evidence.programs){
  assert(typeof vertexSource==='string'&&typeof fragmentSource==='string','Actual linked source unavailable');
  await writeFile(join(output,'programs',program.id+'-vertex.glsl'),vertexSource);await writeFile(join(output,'programs',program.id+'-fragment.glsl'),fragmentSource);
  report.programs.push({...program,vertexSha256:hash(vertexSource),fragmentSha256:hash(fragmentSource)});
 }
}
async function main(){
 for(const name of ['captures','geometry','programs','sources','assets'])await mkdir(join(output,name),{recursive:true});
 const repo=git('rev-parse','--show-toplevel');
 const repoPath=path=>relative(repo,path).split(sep).join('/');
 const original=(path,ref=BASE)=>execFileSync('git',['-C',repo,'show',ref+':'+repoPath(path)],{maxBuffer:16*1024*1024});
 execFileSync('git',['-C',repo,'merge-base','--is-ancestor',BASE,SUPPORT_BASE]);
 const source=join(game,'src/belle/pavement.ts'),before=original(source),after=await readFile(source);
 assert(after.equals(original(source,SUPPORT_BASE)),'Candidate pavement differs from the exact current pure product');
 report.source={head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),baseline:BASE,candidate:SUPPORT_BASE,path:repoPath(source),baselineSha256:hash(before),candidateSha256:hash(after),fixtureSha256:hash(await readFile(fixture)),driverSha256:hash(await readFile(driver))};
 await writeFile(join(output,'sources/baseline-pavement.ts'),before);await writeFile(join(output,'sources/candidate-pavement.ts'),after);
 const support=['world.ts','islandSky.ts','surfaceFinish.ts','asphaltPolish.ts','realisticMaterials.ts','worldAtmosphere.ts','cinematicTerrain.ts','sunsetGround.ts','roadContactSurface.ts','groundDrawRange.ts','startupAssets.ts'];
 report.supportSources={};const sourceText=new Map();
 for(const name of support){
  const path=join(game,'src/belle',name),bytes=await readFile(path),pinned=original(path,SUPPORT_BASE);
  report.supportSources[name]={path:repoPath(path),baseline:SUPPORT_BASE,baselineSha256:hash(pinned),candidateSha256:hash(bytes),unchanged:bytes.equals(pinned)};
  await writeFile(join(output,'sources',name),bytes);assert(bytes.equals(pinned),'Asphalt comparison support source differs from the exact current pure product: '+name);sourceText.set(name,bytes.toString('utf8'));
 }
 const world=sourceText.get('world.ts'),sky=sourceText.get('islandSky.ts');
 const mat=world.match(/^const mat=.*$/m)?.[0],pavement=world.match(/const pavement=mat\([^;]+;finishAsphalt\(pavement\);/)?.[0],name=world.match(/pavement\.name='Island asphalt';/)?.[0];
 assert(mat&&pavement&&name,'Exact authored asphalt material construction unavailable');
 const cloudStart=sky.indexOf('function cloudTexture(){'),cloudEnd=sky.indexOf('const fragment=',cloudStart);
 assert(cloudStart>=0&&cloudEnd>cloudStart&&sky.indexOf('function cloudTexture(){',cloudStart+1)===-1,'Exact cloud construction unavailable');
 const cloud=sky.slice(cloudStart,cloudEnd),construction=["import * as T from 'three';","import {finishAsphalt} from './surfaceFinish.ts';",mat,'export function createAsphalt(){'+pavement+name+'return pavement;}',cloud,'export {cloudTexture};'].join('\n')+'\n';
 const originalWorld=original(join(game,'src/belle/world.ts')).toString('utf8'),originalSky=original(join(game,'src/belle/islandSky.ts')).toString('utf8');
 assert.equal(mat,originalWorld.match(/^const mat=.*$/m)?.[0],'Authored material factory changed from purea1');
 assert.equal(pavement,originalWorld.match(/const pavement=mat\([^;]+;finishAsphalt\(pavement\);/)?.[0],'Authored pavement construction changed from purea1');
 assert.equal(name,originalWorld.match(/pavement\.name='Island asphalt';/)?.[0],'Authored asphalt name changed from purea1');
 const originalCloudStart=originalSky.indexOf('function cloudTexture(){'),originalCloudEnd=originalSky.indexOf('const fragment=',originalCloudStart);
 assert(originalCloudStart>=0&&originalCloudEnd>originalCloudStart);assert.equal(cloud,originalSky.slice(originalCloudStart,originalCloudEnd),'Authored cloud construction changed from purea1');
 report.authoredConstruction={baseline:BASE,unchangedFromOriginal:true,materialFactorySha256:hash(mat),asphaltSha256:hash(pavement+name),cloudSha256:hash(cloud),moduleSha256:hash(construction)};
 await writeFile(join(output,'sources/asphalt-construction.ts'),construction);
 const metaPath=join(game,'public/belle/pavement.json'),binaryPath=join(game,'public/belle/pavement.bin');
 const metadata=original(metaPath),binary=original(binaryPath),meta=JSON.parse(metadata);
 assert(metadata.equals(await readFile(metaPath))&&binary.equals(await readFile(binaryPath)),'Pavement input assets differ from pinned purea1 bytes');
 assert.equal(meta.stride,8);assert.equal(meta.groups.length,5);assert.equal(binary.length,1693664);
 const asphalt=meta.groups.find(p=>p.kind==='asphalt');assert(asphalt&&asphalt.vertices===28995&&asphalt.indices.length===138228&&asphalt.ranges.length===165);
 for(const part of meta.groups){
  const components={};
  for(const [name,offset,size]of [['position',0,3],['normal',3,3],['uv',6,2]]){
   const bytes=Buffer.alloc(part.vertices*size*4);
   for(let i=0;i<part.vertices;i++)binary.copy(bytes,i*size*4,part.offset+(i*8+offset)*4,part.offset+(i*8+offset+size)*4);
   components[name]=bytes;
  }
  const bytes=Buffer.alloc(part.indices.length*2);for(let i=0;i<part.indices.length;i++){assert(part.indices[i]<65536);bytes.writeUInt16LE(part.indices[i],i*2);}components.index=bytes;expectedComponents.set(part.kind,components);
 }
 const packed=gzipSync(binary,{level:9});
 report.assets={metadata:{path:repoPath(metaPath),bytes:metadata.length,sha256:hash(metadata)},binary:{path:repoPath(binaryPath),bytes:binary.length,sha256:hash(binary)},derivedGzip:{bytes:packed.length,sha256:hash(packed),note:'Derived from the exact pinned binary for the unchanged production startup loader; decompressed input is identical.'}};
 await writeFile(join(output,'assets/pavement.json'),metadata);await writeFile(join(output,'assets/pavement.bin'),binary);await writeFile(join(output,'assets/pavement.bin.gz'),packed);
 const skinRoot=join(game,'public/belle/skins'),skinNames=(await readdir(skinRoot)).filter(name=>name.endsWith('.webp')).sort();assert.equal(skinNames.length,57);
 const skins=new Map();report.textures=[];
 for(const name of skinNames){const bytes=await readFile(join(skinRoot,name));assert(bytes.length>100);skins.set('/belle/skins/'+name,bytes);report.textures.push({path:'belle/skins/'+name,bytes:bytes.length,sha256:hash(bytes)});}
 const modules=new Map([['\0virtual:belle-asphalt-baseline',{path:source,code:before.toString('utf8')}],['\0virtual:belle-asphalt-construction',{path:join(game,'src/belle/world.ts'),code:construction}]]),bundle=join(output,'bundle');
 await build({configFile:false,root:game,publicDir:false,logLevel:'warn',plugins:[{
  name:'exact-asphalt-baseline',
  async resolveId(id,importer){if(modules.has('\0'+id))return '\0'+id;if(modules.has(importer)&&id.startsWith('.'))return this.resolve(resolve(dirname(modules.get(importer).path),id),undefined,{skipSelf:true});},
  load(id){if(modules.has(id))return {code:modules.get(id).code,map:null};},
  transform(code,id){if(modules.has(id))return import('typescript').then(({default:ts})=>({code:ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,map:null}));}
 }],build:{outDir:bundle,emptyOutDir:true,target:'es2022',minify:false,sourcemap:true,lib:{entry:fixture,formats:['es'],fileName:()=> 'fixture.js'}}});
 const html=Buffer.from('<!doctype html><meta charset="utf-8"><title>Native asphalt layout comparison</title><style>body{margin:16px;background:#18212b;color:#fff;font:14px sans-serif}canvas{display:block;width:320px;height:240px}</style><script type="module" src="/fixture.js"></script>');
 await writeFile(join(bundle,'index.html'),html);report.bundleSha256=hash(await readFile(join(bundle,'fixture.js')));await checkpoint();
 if(report.buildOnly){report.status='build-only; native validation not executed';await checkpoint();return;}
 assert.equal(process.platform,'darwin','This validation requires the native macOS Chrome/Metal runner');
 server=createServer(async(req,res)=>{
  try{
   const path=new URL(req.url,'http://localhost').pathname;let bytes,type;
   if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}
   if(path==='/'||path==='/index.html'){bytes=html;type='text/html';}
   else if(path==='/fixture.js'||path==='/fixture.js.map'){bytes=await readFile(join(bundle,path.slice(1)));type=path.endsWith('.map')?'application/json':'application/javascript';}
   else if(path==='/belle/pavement.json'){bytes=metadata;type='application/json';}
   else if(path==='/belle/pavement.bin'){bytes=binary;type='application/octet-stream';}
   else if(path==='/belle/pavement.bin.gz'){bytes=packed;type='application/gzip';}
   else if(skins.has(path)){bytes=skins.get(path);type='image/webp';}
   else{res.writeHead(404);res.end('Not found');return;}
   res.writeHead(200,{'Content-Type':type,'Content-Length':bytes.length,'Cache-Control':'no-store'});res.end(bytes);
  }catch(error){res.writeHead(500);res.end(String(error));}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const require=createRequire(resolve(game,'../../package.json')),{chromium}=require('@playwright/test');
 report.runtime={node:process.version,platform:process.platform,arch:process.arch,playwright:require('@playwright/test/package.json').version};
 report.launch={channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']};browser=await chromium.launch(report.launch);report.browserVersion=browser.version();
 page=await browser.newPage({viewport:{width:800,height:600},deviceScaleFactor:1,isMobile:false,hasTouch:false});page.setDefaultTimeout(120000);await page.bringToFront();
 page.on('pageerror',error=>report.errors.push(error.stack??String(error)));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
 page.on('response',response=>{if(response.status()>=400)report.failedRequests.push('HTTP'+response.status()+' '+response.url());});page.on('requestfailed',request=>{if(!closing)report.failedRequests.push((request.failure()?.errorText??'failed')+' '+request.url());});
 deadline=setTimeout(()=>{report.errors.push('Native asphalt fixture exceeded180seconds');void browser?.close().catch(error=>report.errors.push('Deadline cleanup: '+String(error)));},180000);
 report.url='http://127.0.0.1:'+server.address().port;await page.goto(report.url,{waitUntil:'load'});await page.waitForFunction(()=>!!window.__asphaltLayoutFixture);
 report.initial=await page.evaluate(()=>window.__asphaltLayoutFixture.ready);report.setupComplete=true;await checkpoint();
 report.geometryBefore=await saveGeometry('initial');await checkpoint();
 for(const [view,row]of report.initial.views.entries())for(const target of ['screen-msaa4','target-samples0']){
  const name=row.id+'-'+target;
  const a=await capture('baseline',view,target,true,name+'-baseline'),b=await capture('candidate',view,target,true,name+'-candidate');
  const proofs={};
  for(const [side,originalCapture]of [['baseline',a],['candidate',b]]){
   const hidden=await capture(side,view,target,false,name+'-'+side+'-hidden'),restored=await capture(side,view,target,true,name+'-'+side+'-restored');
   const coverage=compare(originalCapture.bytes,hidden.bytes),restoration=compare(originalCapture.bytes,restored.bytes);
   proofs[side]={passed:originalCapture.metadata.passed&&hidden.metadata.passed&&restored.metadata.passed&&coverage.differingPixels>=16&&restoration.equal,coverage,restoration,hidden:hidden.metadata,restored:restored.metadata};
  }
  const rangesMatch=JSON.stringify(a.metadata.rangeSelections)===JSON.stringify(b.metadata.rangeSelections)&&JSON.stringify(a.metadata.draws)===JSON.stringify(b.metadata.draws);
  const comparison={name,...compare(a.bytes,b.bytes),rangesMatch,proofs,baseline:a.metadata,candidate:b.metadata};report.comparisons.push(comparison);
  await writeFile(join(output,'captures',name+'-comparison.json'),JSON.stringify(comparison,null,2)+'\n');await checkpoint();
 }
 const beforeControl=await capture('candidate',1,'screen-msaa4',true,'normal-control-before');let changed;
 try{await page.evaluate(()=>window.__asphaltLayoutFixture.setNegativeControl(true));changed=await capture('candidate',1,'screen-msaa4',true,'normal-control-changed');}
 finally{await page.evaluate(()=>{if(window.__asphaltLayoutFixture.state().negativeControl)window.__asphaltLayoutFixture.setNegativeControl(false);});}
 const restored=await capture('candidate',1,'screen-msaa4',true,'normal-control-restored'),difference=compare(beforeControl.bytes,changed.bytes),restoration=compare(beforeControl.bytes,restored.bytes);
 report.controls.push({name:'flip-actual-candidate-normal-sign-bits',passed:beforeControl.metadata.passed&&changed.metadata.passed&&restored.metadata.passed&&difference.differingPixels>=16&&restoration.equal,difference,restoration,before:beforeControl.metadata,changed:changed.metadata,restored:restored.metadata});await checkpoint();
 report.geometryAfter=await saveGeometry('final');
 report.geometryRestoration=Object.fromEntries(['baseline','candidate'].map(side=>[side,Object.fromEntries(Object.keys(report.geometryBefore.sides[side]).map(kind=>{
  const before=report.geometryBefore.sides[side][kind],after=report.geometryAfter.sides[side][kind];
  const sameContent=JSON.stringify(canonicalMetadata(before))===JSON.stringify(canonicalMetadata(after));
  const versions=Object.entries(before.attributes).map(([name,a])=>({name,before:a.version,after:after.attributes[name].version,expectedDelta:side==='candidate'&&kind==='asphalt'&&name==='normal'?2:0}));
  return [kind,{sameContent,versions,passed:sameContent&&versions.every(v=>v.after-v.before===v.expectedDelta)}];
 }))]));
 await savePrograms();await page.screenshot({path:join(output,'fixture-window.png')});
 report.nativeLayout=Object.fromEntries(['screen-msaa4','target-samples0'].map(target=>{
  const rows=report.comparisons.filter(row=>row.baseline.output===target);
  const ids=Object.fromEntries(['baseline','candidate'].map(side=>[side,[...new Set(rows.flatMap(row=>row[side].nativeProofs.map(p=>p.programId)))]]));
  const stagePairs=[...new Set([...ids.baseline,...ids.candidate].map(id=>{const p=report.programs.find(p=>p.id===id);assert(p,'Missing asphalt program source');return p.vertexSha256+':'+p.fragmentSha256;}))];
  return [target,{baselinePrograms:ids.baseline,candidatePrograms:ids.candidate,stagePairs,expectedBaselineStride:32,expectedCandidateStride:12,passed:ids.baseline.length===1&&ids.candidate.length===1&&ids.baseline[0]===ids.candidate[0]&&stagePairs.length===1&&rows.every(r=>r.baseline.passed&&r.candidate.passed)}];
 }));
 report.sourcesUnchanged=hash(await readFile(source))===report.source.candidateSha256&&hash(await readFile(fixture))===report.source.fixtureSha256&&hash(await readFile(driver))===report.source.driverSha256;
 for(const [name,pinned]of Object.entries(report.supportSources))report.sourcesUnchanged&&=hash(await readFile(join(game,'src/belle',name)))===pinned.candidateSha256;
 report.assetsUnchanged=hash(await readFile(metaPath))===report.assets.metadata.sha256&&hash(await readFile(binaryPath))===report.assets.binary.sha256;
 const native=report.final.graphics;
 report.finalNativePassed=/Metal/i.test(native.renderer)&&!/SwiftShader|llvmpipe|software rasterizer/i.test(native.renderer)&&native.samples===4&&native.sampleBuffers===1&&native.contextAttributes.antialias&&native.width===320&&native.height===240&&native.devicePixelRatio===1&&!native.contextLost;
 report.passed=report.comparisons.length===8&&report.comparisons.every(c=>c.equal&&c.rangesMatch&&Object.values(c.proofs).every(p=>p.passed))&&report.controls.length===1&&report.controls.every(c=>c.passed)&&report.geometryBefore.passed&&report.geometryAfter.passed&&Object.values(report.geometryRestoration).every(groups=>Object.values(groups).every(g=>g.passed))&&Object.values(report.nativeLayout).every(p=>p.passed)&&report.programs.every(p=>p.linked)&&report.sourcesUnchanged&&report.assetsUnchanged&&report.finalNativePassed&&report.initial.collision.every(p=>p.baseline===p.candidate)&&JSON.stringify(report.initial.collision)===JSON.stringify(report.final.collision)&&!report.final.negativeControl&&!report.final.errors.length&&!report.errors.length&&!report.consoleErrors.length&&!report.failedRequests.length;
 report.status=report.passed?'passed':'failed; exact mismatches, pointers and controls retained';await checkpoint();
}
try{await main();}catch(error){report.passed=false;report.errors.push(error.stack??String(error));report.status=report.setupComplete?'execution-failed':'setup-failed';}
finally{
 clearTimeout(deadline);
 if(page&&report.setupComplete&&!report.programs)try{await savePrograms();}catch(error){report.errors.push('Program evidence after failure: '+String(error));}
 closing=true;try{await browser?.close();}catch(error){report.errors.push('Browser cleanup: '+String(error));report.passed=false;}
 if(server)await new Promise(resolve=>server.close(resolve));await mkdir(output,{recursive:true});await checkpoint();
 console.log(JSON.stringify({status:report.status,passed:report.passed,comparisons:report.comparisons.length,mismatches:report.comparisons.filter(c=>!c.equal).length,errors:report.errors.slice(0,3)}));
 if(!report.passed&&!report.buildOnly||report.errors.length)process.exitCode=1;
}
