import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {dirname,resolve,relative,join,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';

const BASE='318a94f7ce3fd47b12ec980b855e56469fcecca8';
const PURE='25497c6d0992ef90a40aa63fbdf804841dd9f9ec';
const PURE_TREE='c967682e31727340a46de4d74c5e2f0418b19a50';
const STRICT='8f6af949083800c491b65e0709c04cc29eb5712634f744c5b912f76ce651fcf5';
const EXPECTED={
 mapped:{vertex:'316ebc9a1c5c4c92c37120c3932f70fc4aad7ee311c6897e4e44792b71fd9603',fragment:'0f698cd8efdaec5ee240432f62a96f0e5eca98e52e6ca0f54b4778c0d902b92a'},
 mapless:{vertex:'7a584a21a89a61c7dd490b97cf2230425cf0cd412b3c1228b2e7adec7e8e73fc',fragment:'e72653ef89d7d805620de800714f802e244da61a86ba7b95805d0e4d6bddac23'}};
const game=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(process.env.BELLE_OPAQUE_SHADOW_OUTPUT??join(game,'opaque-shadow-evidence'));
const fixture=join(game,'scripts/opaque-shadow-fixture.ts'),driver=fileURLToPath(import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',['-C',game,...args],{encoding:'utf8',maxBuffer:128*1024*1024}).trim();
const repo=git('rev-parse','--show-toplevel'),repoPath=path=>relative(repo,path).split(sep).join('/');
const original=(ref,path)=>execFileSync('git',['-C',repo,'show',ref+':'+repoPath(path)],{maxBuffer:128*1024*1024});
const targets=['screen-msaa4','target-samples0'],sides=['baseline','candidate'];
const report={version:1,baseline:BASE,product:PURE,productTree:PURE_TREE,passed:false,setupComplete:false,buildOnly:process.env.BELLE_OPAQUE_SHADOW_BUILD_ONLY==='1',releaseAccepted:false,performanceVerified:false,comparisons:[],controls:[],captures:[],errors:[],consoleErrors:[],failedRequests:[],
 scope:'Eight cases on screen4x and offscreen0:16 exact scene comparisons, each with RGBA and sampled actual PCF depth. Five authored MacArthur owners and actual span range hooks, shared geometry order, five coverage/deformation exclusions, and four effective/restored controls. No full-game performance or native Metal pipeline-count acceptance.'};
let browser,page,server,deadline,closing=false,manifest;
const blobs=new Map(),assets=new Map(),sourceSnapshot=new Map(),retained=new Map();
const checkpoint=()=>writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const fail=error=>report.errors.push(error?.stack??String(error));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function blob(bytes){const sha256=hash(bytes),path='payloads/'+sha256+'.bin';if(!blobs.has(sha256)){await writeFile(join(output,path),bytes);blobs.set(sha256,bytes);}return {path,sha256,bytes:bytes.length};}
async function externalize(value){if(Array.isArray(value))return Promise.all(value.map(externalize));if(!value||typeof value!=='object')return value;const result={};for(const [key,item]of Object.entries(value))result[key]=key==='bytes'&&typeof item==='string'?await blob(Buffer.from(item,'base64')):await externalize(item);return result;}
function compare(a,b){if(a.length!==b.length)return {equal:false,lengthMismatch:true,baselineBytes:a.length,candidateBytes:b.length};let differingBytes=0,differingPixels=0;const firstPixels=[];for(let i=0;i<a.length;i+=4){let changed=false;for(let j=0;j<4;j++)if(a[i+j]!==b[i+j]){differingBytes++;changed=true;}if(changed){differingPixels++;if(firstPixels.length<12)firstPixels.push({pixel:i/4,baseline:[...a.subarray(i,i+4)],candidate:[...b.subarray(i,i+4)]});}}return {equal:differingBytes===0,differingBytes,differingPixels,firstPixels};}
async function capture(side,index,target,present,name){
 const value=await page.evaluate(a=>window.__opaqueShadowFixture.render(a.side,a.index,a.target,a.present),{side,index,target,present});
 const rgba=Buffer.from(value.rgba,'base64'),depth=Buffer.from(value.depth,'base64'),png=Buffer.from(value.png,'base64');
 // Failure bytes and their mapping are persisted before any native/format assertion.
 const rgbaBlob=await blob(rgba),depthBlob=await blob(depth);await writeFile(join(output,'captures',name+'.png'),png);
 const {rgba:_,depth:__,png:___,...metadata}=value;Object.assign(metadata,{capture:name,rgba:rgbaBlob,depth:depthBlob,pngPath:'captures/'+name+'.png',pngSha256:hash(png)});
 await writeFile(join(output,'captures',name+'.json'),JSON.stringify(metadata,null,2)+'\n');report.captures.push({name,path:'captures/'+name+'.json',rgbaSha256:rgbaBlob.sha256,depthSha256:depthBlob.sha256,errors:metadata.errors});
 const d=metadata.depthEvidence,frame=metadata.samples===(target==='screen-msaa4'?4:0)&&metadata.sampleBuffers===(target==='screen-msaa4'?1:0);
 const validDepth=depth.length===512*512*4&&d?.width===512&&d?.height===512&&d.complete&&d.attachmentMatches&&d.depthBits===24&&d.samples===0&&d.sampleBuffers===0&&d.type===1014&&d.format===1026&&d.compareFunction===515&&d.nativeDepthStorageReadback===false;
 let finiteDepth=validDepth,occupied=0;if(validDepth)for(let i=0;i<depth.length;i+=4){const v=depth.readFloatLE(i);if(!Number.isFinite(v)||v<0||v>1)finiteDepth=false;if(v<1)occupied++;}
 const result={rgba,depth,metadata,valid:rgba.length===384*288*4&&frame&&validDepth&&finiteDepth&&!metadata.errors.length,occupied};retained.set(name,result);return result;
}
function nativeComparison(a,b){
 const x=a.metadata,y=b.metadata,eligible=x.caseId.startsWith('bridge')||x.caseId==='pooled-pair',bridge=x.caseId.startsWith('bridge'),expected=bridge?5:eligible?2:1;
 const calls=m=>m.calls.filter(c=>c.shadow),draws=m=>m.draws.filter(d=>d.shadow&&d.count>0),ca=calls(x),cb=calls(y),da=draws(x),db=draws(y);
 const order=same(ca.map(c=>c.object),cb.map(c=>c.object))&&same(da.map(d=>d.object),db.map(d=>d.object));
 const ranges=same(ca.map(c=>c.sourceRange),cb.map(c=>c.sourceRange))&&same(ca.map(c=>c.deliveredRange),cb.map(c=>c.deliveredRange));
 const delegates=ca.length===expected&&cb.length===expected&&ca.every(c=>c.nativeDraws===1&&c.group===null)&&cb.every(c=>c.nativeDraws===1&&c.group===null)&&da.length===expected&&db.length===expected;
 const drawsEqual=same(da.map(d=>[d.method,d.count,d.indexType,d.offset,d.samples,d.sampleBuffers,d.blend,d.alphaToCoverage,d.discard,d.colorMask,d.depthWrite]),db.map(d=>[d.method,d.count,d.indexType,d.offset,d.samples,d.sampleBuffers,d.blend,d.alphaToCoverage,d.discard,d.colorMask,d.depthWrite]));
 const delta=key=>(y.adapterAfter?.[key]??0)-(y.adapterBefore?.[key]??0),counter=delta('delegatedCalls')===(eligible?expected:0)&&delta('spanDelegatedCalls')===(bridge?5:0)&&delta('mappedDelegatedCalls')===(bridge?1:0)&&delta('maplessDelegatedCalls')===(bridge?4:x.caseId==='pooled-pair'?2:0);
 const restored=[x,y].every(m=>m.restoredRanges.every(r=>r.range.start===0&&r.range.count===-1));
 const sourceState=same(x.sourceMaterials,y.sourceMaterials)&&same(ca.map(c=>c.incomingMaterial),cb.map(c=>c.incomingMaterial));
 const bridgeScope=!bridge||[x,y].every(m=>m.poolAfter?.rejected?.['object-callback']>=5&&m.calls.filter(c=>c.shadow).every(c=>c.geometryUnchanged))&&ca.every((c,i)=>c.sourceRange.count>0&&c.sourceRange.count<[142992,50544,23760,69120,175848][i]);
 const poolScope=x.caseId!=='pooled-pair'||[x,y].every(m=>m.poolAfter?.supported&&m.poolAfter.preparationReady&&m.calls.filter(c=>c.shadow).every(c=>c.geometryUnchanged===(x.output==='target-samples0')));
 return {passed:order&&ranges&&delegates&&drawsEqual&&counter&&restored&&sourceState&&bridgeScope&&poolScope,order,ranges,delegates,drawsEqual,counter,restored,sourceState,bridgeScope,poolScope,baselinePrograms:da.map(d=>d.program),candidatePrograms:db.map(d=>d.program),baselineDraws:da,candidateDraws:db};
}
async function walkFiles(directory){
 const result=[];async function walk(current){for(const entry of await readdir(current,{withFileTypes:true})){
  const path=resolve(current,entry.name);if(entry.isDirectory())await walk(path);else{assert(entry.isFile(),'Unexpected symlink/nonfile: '+path);const bytes=await readFile(path);result.push({path:relative(directory,path).split(sep).join('/'),bytes:bytes.length,sha256:hash(bytes)});}
 }}await walk(directory);return result.sort((a,b)=>a.path.localeCompare(b.path));
}
async function sourceInventory(){
 const names=['package.json','package-lock.json','../../package.json','../../package-lock.json','index.html','vite.config.ts','tsconfig.json','run-tests.mjs'];
 async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=resolve(directory,entry.name);if(entry.isDirectory())await walk(path);else{assert(entry.isFile(),'Unexpected source symlink/nonfile');if(/\.(?:ts|mjs|js)$/.test(entry.name))names.push(relative(game,path).split(sep).join('/'));}
 }}for(const name of ['src','runtime','scripts','../tools'])await walk(resolve(game,name));names.sort();assert.equal(new Set(names).size,names.length);return names;
}
async function verifyIdentity(label){
 assert(process.env.BELLE_OPAQUE_SHADOW_IDENTITY,'Native execution requires the frozen full-build identity manifest');
 const manifestBytes=await readFile(resolve(process.env.BELLE_OPAQUE_SHADOW_IDENTITY)),current=JSON.parse(manifestBytes);
 if(manifest)assert.deepEqual(current,manifest,'Identity manifest changed');else manifest=current;
  assert.equal(manifest.baseline,BASE);assert.equal(manifest.parent,PURE);assert.equal(manifest.productTree,PURE_TREE);
 assert.equal(git('rev-parse','HEAD'),manifest.commit);assert.equal(git('rev-parse','HEAD^{tree}'),manifest.tree);
 assert.deepEqual(git('show','-s','--format=%P','HEAD').split(' '),[PURE]);assert.deepEqual(git('show','-s','--format=%P',PURE).split(' '),[BASE]);assert.equal(git('rev-parse',PURE+'^{tree}'),PURE_TREE);
 const gamePath=repoPath(game),productPaths=['run-tests.mjs','src/belle/main.ts','src/belle/opaqueShadowPrograms.ts','src/belle/opaqueShadowPrograms.test.ts','src/belle/macArthurSpanCulling.ts'].map(p=>gamePath+'/'+p).sort();
 const extras=['.github/workflows/belle-native-opaque-shadow.yml',gamePath+'/scripts/opaque-shadow-fixture.ts',gamePath+'/scripts/opaque-shadow-native-check.mjs'].sort();
 assert.deepEqual(git('diff','--name-only',BASE,PURE).split('\n').filter(Boolean).sort(),productPaths);
 assert.deepEqual(git('diff','--no-renames','--name-status',PURE,'HEAD').split('\n').filter(Boolean).sort(),extras.map(p=>'A\t'+p));
 assert.equal(manifest.workflow.path,extras[0]);assert.equal(hash(await readFile(resolve(repo,manifest.workflow.path))),manifest.workflow.sha256);
 const sourceFiles=await sourceInventory();assert.deepEqual(sourceFiles,Object.keys(manifest.sources).sort());assert.equal(sourceFiles.length,manifest.sourceFileCount);
 for(const path of sourceFiles){const absolute=resolve(game,path);assert(!repoPath(absolute).startsWith('../'));const bytes=await readFile(absolute);assert.equal(hash(bytes),manifest.sources[path],'Source bytes changed: '+path);assert.equal(hash(original('HEAD',absolute)),manifest.sources[path],'Source differs from committed bytes: '+path);}
 assert.equal(manifest.sources['scripts/sustained-ride-profile.mjs'],STRICT);
 for(const ref of [BASE,PURE])assert.equal(hash(original(ref,join(game,'scripts/sustained-ride-profile.mjs'))),STRICT);
 const files=await walkFiles(join(game,'dist'));assert.equal(files.length,195);assert.deepEqual(files,manifest.files,'Full-game build bytes/inventory changed');
 const metadata=manifest.buildMetadata,expectedResearch=repoPath(resolve(game,'../research/street-detail-stats.json'));
 assert.equal(metadata.path,expectedResearch);assert.equal(metadata.permittedField,'buildMs');assert.equal(metadata.semanticMatchExceptBuildMs,true);
 const research=await readFile(resolve(repo,expectedResearch)),committed=original('HEAD',resolve(repo,expectedResearch));
 assert.equal(hash(research),metadata.postBuild.sha256);assert.equal(research.length,metadata.postBuild.bytes);assert.equal(hash(committed),metadata.committed.sha256);
 const a=JSON.parse(committed),b=JSON.parse(research),{buildMs:am,...ar}=a,{buildMs:bm,...br}=b;
 assert(Number.isFinite(am)&&am>=0&&Number.isFinite(bm)&&bm>=0);assert.deepEqual(ar,br);assert.equal(bm,metadata.postBuild.buildMs);
 assert.deepEqual(git('diff','--no-renames','--name-status','HEAD','--').split('\n').filter(Boolean),metadata.trackedChanges);
 assert.deepEqual(git('diff','--no-renames','--raw','HEAD','--').split('\n').filter(Boolean),metadata.trackedRawChanges);
 const result={verified:true,commit:manifest.commit,tree:manifest.tree,parent:PURE,productTree:PURE_TREE,baseline:BASE,sourceFiles:sourceFiles.length,builtFiles:files.length,manifestSha256:hash(manifestBytes),buildMetadataSha256:hash(research),at:new Date().toISOString()};
 await writeFile(join(output,'identity-'+label+'.json'),JSON.stringify(result,null,2)+'\n');return result;
}
async function setup(){
 for(const name of ['captures','payloads','programs','sources'])await mkdir(join(output,name),{recursive:true});
 assert(output!==join(game,'dist')&&!output.startsWith(join(game,'dist')+sep),'Fixture must not modify the full build');
 if(!report.buildOnly){report.identityBefore=await verifyIdentity('before');report.product=manifest.parent;report.productTree=manifest.productTree;}
 const cull=join(game,'src/belle/macArthurSpanCulling.ts'),before=original(BASE,cull),after=await readFile(cull);
 assert(after.equals(original(PURE,cull)),'Candidate cull differs from frozen product');
 const adapter=join(game,'src/belle/opaqueShadowPrograms.ts'),adapterBytes=await readFile(adapter);
 assert(adapterBytes.equals(original(PURE,adapter)),'Adapter differs from frozen product');
 assert.equal(git('rev-parse',PURE+'^{tree}'),PURE_TREE);assert.deepEqual(git('show','-s','--format=%P',PURE).split(' '),[BASE]);
 const productPaths=['run-tests.mjs','src/belle/main.ts','src/belle/opaqueShadowPrograms.ts','src/belle/opaqueShadowPrograms.test.ts','src/belle/macArthurSpanCulling.ts'];
 assert.deepEqual(git('diff','--name-only',BASE,PURE).split('\n').filter(Boolean).sort(),productPaths.map(p=>repoPath(join(game,p))).sort());
 for(const path of productPaths){const absolute=join(game,path),bytes=await readFile(absolute);assert(bytes.equals(original(PURE,absolute)),'Working source differs from frozen pure product: '+path);sourceSnapshot.set(absolute,hash(bytes));}
 report.source={baseline:BASE,product:PURE,productTree:PURE_TREE,head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),files:[]};
 for(const [path,bytes]of [[cull,after],[adapter,adapterBytes],[fixture,await readFile(fixture)],[driver,await readFile(driver)]]){sourceSnapshot.set(path,hash(bytes));report.source.files.push({path:repoPath(path),sha256:hash(bytes)});}
 await writeFile(join(output,'sources/baseline-macArthurSpanCulling.ts'),before);await writeFile(join(output,'sources/candidate-macArthurSpanCulling.ts'),after);await writeFile(join(output,'sources/opaqueShadowPrograms.ts'),adapterBytes);
 const support=['src/belle/sharedGeometryBuffers.ts','src/belle/macArthurSurface.ts','src/belle/macArthurRailFinish.ts','src/belle/bridgeMaterialFinish.ts','src/belle/realisticMaterials.ts','src/belle/realisticMaterialRules.ts','src/belle/photoReferenceSurfaces.ts','src/belle/atmosphereProgramIdentity.ts','src/belle/startupWork.ts','src/belle/surfaceRetry.ts','package.json','package-lock.json','../../package.json','../../package-lock.json'];
 report.supportSources=[];for(const path of support){const absolute=resolve(game,path),bytes=await readFile(absolute);assert(bytes.equals(original(BASE,absolute)),'Shared support changed: '+path);sourceSnapshot.set(absolute,hash(bytes));report.supportSources.push({path,sha256:hash(bytes)});}
 const publicRoot=join(game,'public');report.assets=[];
 async function addAsset(path){const absolute=resolve(publicRoot,path);assert(absolute.startsWith(publicRoot+sep));const url='/'+relative(publicRoot,absolute).split(sep).join('/');if(assets.has(url))return assets.get(url).bytes;const bytes=await readFile(absolute);assert(bytes.equals(original(BASE,absolute)),'Authored asset differs from exact baseline: '+path);assets.set(url,{bytes,absolute,type:extname(path)==='.webp'?'image/webp':extname(path)==='.png'?'image/png':'model/gltf-binary'});report.assets.push({url,path:repoPath(absolute),bytes:bytes.length,sha256:hash(bytes),retainedSource:BASE+':'+repoPath(absolute)});return bytes;}
 const glb=await addAsset('belle/landmarks.glb');assert.equal(glb.readUInt32LE(0),0x46546c67);assert.equal(glb.readUInt32LE(4),2);assert.equal(glb.readUInt32LE(8),glb.length);assert.equal(glb.readUInt32LE(16),0x4e4f534a);const assetJson=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)));
 await writeFile(join(output,'sources/landmarks.gltf.json'),JSON.stringify(assetJson,null,2)+'\n');
 for(const resource of [...(assetJson.images??[]),...(assetJson.buffers??[])])if(resource.uri){assert(!/^(?:data:|https?:|\/)/.test(resource.uri),'Unexpected external GLB URI');await addAsset(relative(publicRoot,resolve(publicRoot,'belle',resource.uri)));}
 const skins=(await readdir(join(publicRoot,'belle/skins'))).filter(s=>s.endsWith('.webp')).sort();assert.equal(skins.length,57);for(const name of skins)await addAsset('belle/skins/'+name);
 await writeFile(join(output,'asset-manifest.json'),JSON.stringify(report.assets,null,2)+'\n');
 const id='\0virtual:belle-opaque-shadow-baseline',bundle=join(output,'bundle');
 await build({configFile:false,root:game,publicDir:false,logLevel:'warn',plugins:[{name:'exact-opaque-shadow-baseline',async resolveId(name,importer){if(name===id.slice(1))return id;if(importer===id&&name.startsWith('.'))return this.resolve(resolve(dirname(cull),name),undefined,{skipSelf:true});},load(name){if(name===id)return {code:before.toString(),map:null};},async transform(code,name){if(name===id){const {default:ts}=await import('typescript');return {code:ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,map:null};}}}],build:{outDir:bundle,emptyOutDir:true,target:'es2022',minify:false,sourcemap:true,lib:{entry:fixture,formats:['es'],fileName:()=> 'fixture.js'}}});
 const html=Buffer.from('<!doctype html><meta charset="utf-8"><title>Native opaque shadow comparison</title><style>body{margin:12px;background:#18212b;color:white;font:14px sans-serif}canvas{display:inline-block;width:384px;height:288px;margin:4px}</style><script type="module" src="/fixture.js"></script>');await writeFile(join(bundle,'index.html'),html);report.bundleSha256=hash(await readFile(join(bundle,'fixture.js')));await checkpoint();
 if(report.buildOnly){report.status='build-only; native validation unexecuted';return;}
 assert.equal(process.platform,'darwin','Native macOS Chrome/Metal runner required');
 server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;let bytes,type;if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}if(path==='/'||path==='/index.html'){bytes=html;type='text/html';}else if(path==='/fixture.js'||path==='/fixture.js.map'){bytes=await readFile(join(bundle,path.slice(1)));type=path.endsWith('.map')?'application/json':'application/javascript';}else if(assets.has(path)){({bytes,type}=assets.get(path));}else{res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':type,'Content-Length':bytes.length,'Cache-Control':'no-store'});res.end(bytes);}catch(error){res.writeHead(500);res.end(String(error));}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const require=createRequire(resolve(game,'../../package.json')),{chromium}=require('@playwright/test');report.runtime={node:process.version,platform:process.platform,arch:process.arch,playwright:require('@playwright/test/package.json').version};report.launch={channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']};browser=await chromium.launch(report.launch);report.browserVersion=browser.version();
 page=await browser.newPage({viewport:{width:840,height:650},deviceScaleFactor:1,isMobile:false,hasTouch:false});page.setDefaultTimeout(120000);await page.bringToFront();page.on('pageerror',fail);page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.failedRequests.push('HTTP'+r.status()+' '+r.url());});page.on('requestfailed',r=>{if(!closing)report.failedRequests.push((r.failure()?.errorText??'failed')+' '+r.url());});
 deadline=setTimeout(()=>{fail('Native opaque shadow fixture exceeded300seconds');void checkpoint().finally(()=>browser?.close()).catch(error=>fail('Deadline cleanup: '+error));},300000);
 report.url='http://127.0.0.1:'+server.address().port;await page.goto(report.url,{waitUntil:'load'});await page.waitForFunction(()=>!!window.__opaqueShadowFixture);report.initial=await page.evaluate(()=>window.__opaqueShadowFixture.ready);await checkpoint();assert(!report.initial.failed,'Fixture setup failed');assert.equal(report.initial.cases.length,8);assert.equal(report.initial.adapter?.supported,true,'Actual public renderer adapter is unsupported');assert.equal(report.initial.adapter?.active,true,'Actual public renderer adapter is inactive');report.setupComplete=true;
}
async function geometry(label){const value=await externalize(await page.evaluate(()=>window.__opaqueShadowFixture.geometryState()));await writeFile(join(output,'geometry-'+label+'.json'),JSON.stringify(value,null,2)+'\n');return value;}
function canonicalGeometry(value){return value.map(c=>({id:c.id,subjects:c.subjects.map(({geometry,...subject})=>subject)}));}
async function comparisons(){
 report.geometryBefore=await geometry('before');report.geometryEquivalent=same(canonicalGeometry(report.geometryBefore.baseline),canonicalGeometry(report.geometryBefore.candidate));
 for(const row of report.initial.cases)for(const target of targets){const name=row.id+'-'+target,a=await capture('baseline',row.index,target,true,name+'-baseline'),b=await capture('candidate',row.index,target,true,name+'-candidate'),proofs={};
  for(const [side,visible]of [['baseline',a],['candidate',b]]){const hidden=await capture(side,row.index,target,false,name+'-'+side+'-hidden'),restored=await capture(side,row.index,target,true,name+'-'+side+'-restored'),colorChange=compare(visible.rgba,hidden.rgba),depthChange=compare(visible.depth,hidden.depth),colorRestored=compare(visible.rgba,restored.rgba),depthRestored=compare(visible.depth,restored.depth);proofs[side]={passed:visible.valid&&hidden.valid&&restored.valid&&visible.occupied>=16&&hidden.occupied===0&&colorChange.differingPixels>=16&&depthChange.differingPixels>=16&&colorRestored.equal&&depthRestored.equal,colorChange,depthChange,colorRestored,depthRestored,visibleDepthTexels:visible.occupied,hiddenDepthTexels:hidden.occupied};}
  const color=compare(a.rgba,b.rgba),depth=compare(a.depth,b.depth),native=nativeComparison(a,b),result={name,caseId:row.id,target,color,depth,native,proofs,equal:color.equal&&depth.equal,passed:color.equal&&depth.equal&&native.passed&&Object.values(proofs).every(p=>p.passed)};report.comparisons.push(result);await writeFile(join(output,'captures',name+'-comparison.json'),JSON.stringify(result,null,2)+'\n');await checkpoint();
 }
}
async function controls(){for(const name of ['alpha-test','custom-depth','displacement','clipping']){const row=report.initial.cases.find(c=>c.id===name),base='control-'+name,a=await capture('candidate',row.index,'screen-msaa4',true,base+'-before');let b,c;try{await page.evaluate(name=>window.__opaqueShadowFixture.setControl(name,true),name);b=await capture('candidate',row.index,'screen-msaa4',true,base+'-changed');}finally{await page.evaluate(name=>window.__opaqueShadowFixture.setControl(name,false),name);}c=await capture('candidate',row.index,'screen-msaa4',true,base+'-restored');const colorChange=compare(a.rgba,b.rgba),depthChange=compare(a.depth,b.depth),colorRestored=compare(a.rgba,c.rgba),depthRestored=compare(a.depth,c.depth);const result={name,passed:a.valid&&b.valid&&c.valid&&colorChange.differingPixels>=16&&depthChange.differingPixels>=16&&colorRestored.equal&&depthRestored.equal,colorChange,depthChange,colorRestored,depthRestored,beforeUniforms:a.metadata.draws.filter(d=>d.shadow).map(d=>d.uniforms),changedUniforms:b.metadata.draws.filter(d=>d.shadow).map(d=>d.uniforms),restoredUniforms:c.metadata.draws.filter(d=>d.shadow).map(d=>d.uniforms)};report.controls.push(result);await checkpoint();}}
async function savePrograms(){const evidence=await page.evaluate(()=>window.__opaqueShadowFixture.programEvidence());report.final=evidence.state;report.programs=[];for(const {vertexSource,fragmentSource,...p}of evidence.programs){await writeFile(join(output,'programs',p.id+'-vertex.glsl'),vertexSource);await writeFile(join(output,'programs',p.id+'-fragment.glsl'),fragmentSource);report.programs.push({...p,vertexSha256:hash(vertexSource),fragmentSha256:hash(fragmentSource),vertexPath:'programs/'+p.id+'-vertex.glsl',fragmentPath:'programs/'+p.id+'-fragment.glsl'});}}
function validatePrograms(){const programs=new Map(report.programs.map(p=>[p.id,p])),rows=[];const canonical=new Set();for(const comparison of report.comparisons){for(let i=0;i<comparison.native.baselineDraws.length;i++){const a=comparison.native.baselineDraws[i],b=comparison.native.candidateDraws[i];if(!b){rows.push({passed:false,caseId:comparison.caseId,missing:true});continue;}const pa=programs.get(a.program),pb=programs.get(b.program),bridge=comparison.caseId.startsWith('bridge'),eligible=bridge||comparison.caseId==='pooled-pair';let passed=!!pa?.linked&&!!pb?.linked;
  if(eligible){passed&&=pa.vertexSha256===EXPECTED.mapped.vertex&&pa.fragmentSha256===EXPECTED.mapped.fragment&&pb.vertexSha256===EXPECTED.mapless.vertex&&pb.fragmentSha256===EXPECTED.mapless.fragment;canonical.add(b.program);const position=b.attributes.find(v=>v.name==='position');passed&&=b.attributes.length===1&&position?.location===0&&position.enabled&&position.componentType===5126&&position.components===3&&position.stride===12&&!position.normalized&&!position.integer&&position.divisor===0;const uv=a.attributes.find(v=>v.name==='uv');passed&&=a.attributes.length===2&&uv?.location===2&&uv.enabled===(bridge&&i===0);if(bridge&&i===0)passed&&=uv.componentType===5126&&uv.components===2&&uv.stride===8&&!uv.normalized;}
  else passed&&=pa.vertexSha256===pb.vertexSha256&&pa.fragmentSha256===pb.fragmentSha256&&same(a.attributes.map(({buffer,...x})=>x),b.attributes.map(({buffer,...x})=>x));
  rows.push({caseId:comparison.caseId,target:comparison.target,object:a.object,baselineProgram:a.program,candidateProgram:b.program,eligible,passed});
 }}report.nativeProgramProof={passed:rows.length===34&&rows.every(r=>r.passed)&&canonical.size===1,expectedObservedProgram167:EXPECTED.mapped,expectedObservedProgram163:EXPECTED.mapless,candidateSharedPrograms:[...canonical],rows};}
async function finalChecks(){report.geometryAfter=await geometry('after');report.geometryUnchanged=same(report.geometryBefore,report.geometryAfter);delete report.geometryBefore;delete report.geometryAfter;await savePrograms();validatePrograms();await page.screenshot({path:join(output,'fixture-window.png')});report.nativeGraphicsPassed=Object.values(report.final.graphics).length===2&&Object.values(report.final.graphics).every(g=>/Metal/i.test(g.renderer)&&!/SwiftShader|llvmpipe|software rasterizer/i.test(g.renderer)&&g.revision==='185'&&g.contextAttributes?.antialias&&g.width===384&&g.height===288&&g.devicePixelRatio===1&&!g.contextLost);report.passed=report.comparisons.length===16&&report.comparisons.every(c=>c.passed)&&report.controls.length===4&&report.controls.every(c=>c.passed)&&report.geometryEquivalent&&report.geometryUnchanged&&report.nativeProgramProof.passed&&report.programs.every(p=>p.linked)&&report.nativeGraphicsPassed&&report.final.adapter?.active&&report.final.adapter?.observerErrors===0&&!report.final.control&&!report.final.errors.length;report.status=report.passed?'passed; isolated opaque shadow correctness only':'failed; exact pixels, sampled depth, ranges and controls retained';}
try{await setup();if(!report.buildOnly){await comparisons();await controls();await finalChecks();}}
catch(error){fail(error);report.passed=false;report.status='failed; partial evidence retained';if(page&&!page.isClosed())try{await savePrograms();}catch(e){fail('Partial program export: '+e);}}
finally{
 if(deadline)clearTimeout(deadline);closing=true;try{await browser?.close();}catch(e){fail('Browser cleanup: '+e);}if(server)try{server.closeAllConnections();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}catch(e){fail('HTTP cleanup: '+e);}
 try{report.sourcesUnchanged=true;for(const [path,sha]of sourceSnapshot)report.sourcesUnchanged&&=hash(await readFile(path))===sha;report.assetsUnchanged=true;for(const asset of report.assets??[]){const bytes=await readFile(resolve(repo,asset.path));report.assetsUnchanged&&=bytes.length===asset.bytes&&hash(bytes)===asset.sha256;}if(manifest)report.identityAfter=await verifyIdentity('after');}catch(e){fail('Final immutable source/build proof: '+e);}
 report.passed=report.passed&&!report.buildOnly&&report.sourcesUnchanged&&report.assetsUnchanged&&!!report.identityBefore?.verified&&!!report.identityAfter?.verified&&!report.errors.length&&!report.consoleErrors.length&&!report.failedRequests.length;if(!report.buildOnly&&!report.passed&&!report.status?.startsWith('failed'))report.status='failed; final evidence or cleanup did not pass';report.payloads={unique:blobs.size,bytes:[...blobs.values()].reduce((n,b)=>n+b.length,0),note:'Complete raw RGBA, sampled depth and geometry payloads retained once by SHA256; every capture JSON maps its actual bytes explicitly.'};
 try{await mkdir(output,{recursive:true});await checkpoint();const files=await walkFiles(output);await writeFile(join(output,'evidence-hashes.json'),JSON.stringify(files.filter(f=>f.path!=='evidence-hashes.json'),null,2)+'\n');}catch(e){fail('Evidence persistence: '+e);report.passed=false;try{await checkpoint();}catch{}}
 console.log('BELLE_OPAQUE_SHADOW_FIXTURE '+JSON.stringify({status:report.status,passed:report.passed,buildOnly:report.buildOnly,comparisons:report.comparisons.length,mismatches:report.comparisons.filter(c=>!c.equal).length,controls:report.controls.length,failedControls:report.controls.filter(c=>!c.passed).map(c=>c.name),errors:report.errors}));if(report.errors.length||(!report.buildOnly&&!report.passed))process.exitCode=1;
}
