import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {dirname,resolve,relative,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import * as proof from './macarthur-uv-native-proof.mjs';

const BASE='ae67c67462e0006852c9affc63298c7042cd2638';
const proposedHashes={'src/belle/macArthurSpanCulling.ts':'f2aee61f5000d9229661d2eee3c88f32478de4763f1f9de609d74b55f22bad3d','src/belle/world.ts':'1a4a450c5ea845923896d2334318f222e374da14db8e79630a9748bd982fdebd'};
const game=resolve(dirname(fileURLToPath(import.meta.url)),'..'),output=resolve(process.env.BELLE_MACARTHUR_OUTPUT??join(game,'macarthur-uv-evidence'));
const buildOnly=process.env.BELLE_MACARTHUR_BUILD_ONLY==='1',candidate='09cf5f3c7438bb198c922087f6d92435780d095e';
const fixture=join(game,'scripts/macarthur-uv-fixture.ts'),driver=fileURLToPath(import.meta.url),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const eligibleNames=['MacArthur_MacArthur_galvanized_crash_barrier','MacArthur_MacArthur_sidewalk_expansion_joints','MacArthur_Painted_steel_glazing_bars','MacArthur_Patinated_bronze'],warmName='MacArthur_Higgsfield_•_warm_limestone';
const sides=['baseline','candidate'],outputs=['screen-msaa4','target-samples0'];
const report={version:1,baseline:BASE,candidate,buildOnly,passed:false,setupComplete:false,comparisons:[],witnessPairs:[],witnessControls:[],reverseContract:null,errors:[],consoleErrors:[],failedRequests:[],note:'Standalone optional MacArthur display-UV validation. The existing 212 color /16 shadow /18 controls and asphalt8/1 remain independently required and unchanged. Product quality8color/8rawRGBA-shadow pairs are separate from four diagnostic UV-witness pairs/eight restored controls and a fresh-context reversed-shadow-order contract. No performance, native PSO or depthTexture-readback claim.'};
let browser,page,server,deadline,closing=false,contextLabel='mapped-first';
const retainedInputs=new Map(),served=new Map(),geometryBuffers=new Set();
let authoredGeometry;
const checkpoint=()=>writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const git=(...args)=>execFileSync('git',['-C',game,...args],{encoding:'utf8',maxBuffer:16*1024*1024}).trim();
function compare(a,b,width){
 assert.equal(a.length,b.length,'RGBA byte lengths differ');let differingChannels=0,differingPixels=0,maxDifference=0;const firstPixels=[];
 for(let i=0;i<a.length;i+=4){let changed=false;for(let j=0;j<4;j++)if(a[i+j]!==b[i+j]){changed=true;differingChannels++;maxDifference=Math.max(maxDifference,Math.abs(a[i+j]-b[i+j]));}if(changed){differingPixels++;if(firstPixels.length<16)firstPixels.push({x:i/4%width,yFromBottom:Math.floor(i/4/width),baseline:[...a.subarray(i,i+4)],candidate:[...b.subarray(i,i+4)]});}}
 return {equal:differingChannels===0,differingChannels,differingPixels,maxDifference,firstPixels};
}
async function saveCapture(value,name){
 const {rgba,png,shadowRgba,shadowPng,...metadata}=value;
 const color=Buffer.from(rgba,'base64'),image=Buffer.from(png,'base64'),shadow=Buffer.from(shadowRgba,'base64'),shadowImage=Buffer.from(shadowPng,'base64');
 const relativeName=contextLabel+'/'+name;await mkdir(join(output,'captures',contextLabel),{recursive:true});
 // Preserve every byte and receipt before applying any validation assertion.
 for(const [suffix,bytes]of [['.rgba',color],['.png',image],['-shadow.rgba',shadow],['-shadow.png',shadowImage]])await writeFile(join(output,'captures',relativeName+suffix),bytes);
 const record={...metadata,context:contextLabel,path:'captures/'+relativeName,rgbaSha256:hash(color),pngSha256:hash(image),shadowRgbaSha256:hash(shadow),shadowPngSha256:hash(shadowImage),rgbaBytes:color.length,shadowRgbaBytes:shadow.length};
 await writeFile(join(output,'captures',relativeName+'.json'),JSON.stringify(record,null,2)+'\n');
 assert.equal(color.length,value.width*value.height*4);assert.equal(shadow.length,256*256*4);
 const expectedNames=record.presentation==='primer'?[warmName]:record.presentation==='reverse'?[...eligibleNames,warmName]:eligibleNames;
 record.nativeValidation=proof.validateCapture(record,{mapped:contextLabel==='mapped-first'&&!record.diagnosticWitness,witness:record.diagnosticWitness,expectedNames,generic:contextLabel==='unmapped-first'?null:record.generic==='poisoned'?[.375,.625,1,1]:[0,0,0,1]});
 record.pagePassed=record.passed;record.passed=record.passed&&record.nativeValidation.passed;
 if(!record.nativeValidation.passed)record.failures=[...record.failures,...record.nativeValidation.failures.map(value=>'Native receipt: '+value)];
 await writeFile(join(output,'captures',relativeName+'.json'),JSON.stringify(record,null,2)+'\n');
 return {color,shadow,metadata:record};
}
async function capture(side,view,target,generic,presentation,name,witness=false){
 const value=await page.evaluate(args=>window.__macArthurUvFixture.render(...args),[side,view,target,generic,presentation,witness]);
 return saveCapture(value,name);
}
async function saveGeometry(label){
 const evidence=await page.evaluate(()=>window.__macArthurUvFixture.geometryEvidence());
 for(const buffer of evidence.buffers){
  if(geometryBuffers.has(buffer.sha256))continue;
  const bytes=Buffer.from(await page.evaluate(sha=>window.__macArthurUvFixture.bufferBytes(sha),buffer.sha256),'base64');
  assert.equal(bytes.length,buffer.bytes);assert.equal(hash(bytes),buffer.sha256);await writeFile(join(output,'geometry',buffer.sha256+'.bin'),bytes);geometryBuffers.add(buffer.sha256);
 }
 const failures=[],rows=[];
 for(const side of sides)for(const row of evidence.sides[side].rows){const expected=authoredGeometry[row.name];
  try{assert(expected,'Unknown authored source mesh');assert.deepEqual(Object.keys(row.source.attributes).sort(),Object.keys(expected.attributes).sort(),'Source attribute inventory differs');
   for(const [name,value]of Object.entries({...row.source.attributes,index:row.source.index})){const original=name==='index'?expected.index:expected.attributes[name];for(const field of ['arrayType','itemSize','count','normalized','stride','offset','interleaved','buffer'])assert.deepEqual(value[field],original[field],row.name+' original '+name+' '+field+' differs from shipped GLB accessor');}
   assert.deepEqual(row.sourceMatrixWorld,expected.matrixWorld,'Source transform differs from the actual shipped root node');rows.push({side,name:row.name,passed:true});
  }catch(error){failures.push(side+' '+row.name+': '+String(error));rows.push({side,name:row.name,passed:false});}
 }
 evidence.authoredAssetProof={passed:failures.length===0,failures,rows,scope:'Original source attributes and authored index bytes match the exact shipped GLB accessors, independently of display culling and baseline/candidate equality.'};
 await writeFile(join(output,'geometry',contextLabel+'-'+label+'.json'),JSON.stringify(evidence,null,2)+'\n');return evidence;
}
async function savePrograms(){
 const programs=await page.evaluate(()=>window.__macArthurUvFixture.programEvidence());await mkdir(join(output,'programs',contextLabel),{recursive:true});
 for(const {vertexSource,fragmentSource,...row}of programs){await writeFile(join(output,'programs',contextLabel,row.id+'-vertex.glsl'),vertexSource);await writeFile(join(output,'programs',contextLabel,row.id+'-fragment.glsl'),fragmentSource);Object.assign(row,{vertexSha256:hash(vertexSource),fragmentSha256:hash(fragmentSource)});}
 return programs;
}
function captureCheck(capture,{mapped=true,witness=false,expectedNames=eligibleNames,generic=null}={}){
 return proof.validateCapture(capture.metadata,{mapped,witness,expectedNames,generic});
}
async function makePage(url){
 page=await browser.newPage({viewport:{width:800,height:600},deviceScaleFactor:1,isMobile:false,hasTouch:false});page.setDefaultTimeout(180000);await page.bringToFront();
 page.on('pageerror',error=>report.errors.push(contextLabel+': '+(error.stack??String(error))));page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(contextLabel+': '+message.text());});
 page.on('response',response=>{if(response.status()>=400)report.failedRequests.push(contextLabel+': HTTP'+response.status()+' '+response.url());});page.on('requestfailed',request=>{if(!closing)report.failedRequests.push(contextLabel+': '+(request.failure()?.errorText??'failed')+' '+request.url());});
 await page.goto(url,{waitUntil:'load'});await page.waitForFunction(()=>!!window.__macArthurUvFixture);return page.evaluate(()=>window.__macArthurUvFixture.ready);
}
function span(text,start,end){assert.equal(text.split(start).length,2,'Authored span start must be unique: '+start);const a=text.indexOf(start),b=text.indexOf(end,a);assert(b>a,'Authored span end missing: '+end);return text.slice(a,b);}
function originalGeometry(bytes){
 assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(16),0x4e4f534a);const jsonLength=bytes.readUInt32LE(12),document=JSON.parse(bytes.subarray(20,20+jsonLength)),binStart=28+jsonLength;assert.equal(bytes.readUInt32LE(24+jsonLength),0x004e4942);
 const names=new Map([['MacArthur_Higgsfield • warm limestone',warmName],['MacArthur_MacArthur galvanized crash barrier',eligibleNames[0]],['MacArthur_MacArthur sidewalk expansion joints',eligibleNames[1]],['MacArthur_Painted steel glazing bars',eligibleNames[2]],['MacArthur_Patinated bronze',eligibleNames[3]]]);
 const result={},identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
 function accessor(index){const a=document.accessors[index],view=document.bufferViews[a.bufferView],component={5126:['Float32Array',4],5123:['Uint16Array',2],5125:['Uint32Array',4]}[a.componentType],itemSize={SCALAR:1,VEC2:2,VEC3:3}[a.type];assert(component&&itemSize&&!a.sparse&&!a.normalized&&view.buffer===0,'Unexpected actual authored accessor');assert(!view.byteStride||view.byteStride===itemSize*component[1],'Actual authored component packing changed');
  const length=a.count*itemSize*component[1],start=binStart+(view.byteOffset??0)+(a.byteOffset??0);assert(start+length<=binStart+(view.byteOffset??0)+view.byteLength);const payload=bytes.subarray(start,start+length);return {arrayType:component[0],itemSize,count:a.count,normalized:false,stride:itemSize,offset:0,interleaved:false,buffer:{sha256:hash(payload),bytes:length}};}
 for(const [nodeIndex,node]of document.nodes.entries()){if(!names.has(node.name))continue;const name=names.get(node.name);assert(!result[name],'Duplicate actual authored node');assert(document.scenes[document.scene??0].nodes.includes(nodeIndex),'Actual bridge root node moved');assert.deepEqual(node.matrix??identity,identity);assert.deepEqual(node.translation??[0,0,0],[0,0,0]);assert.deepEqual(node.rotation??[0,0,0,1],[0,0,0,1]);assert.deepEqual(node.scale??[1,1,1],[1,1,1]);
  const mesh=document.meshes[node.mesh];assert.equal(mesh.primitives.length,1);const primitive=mesh.primitives[0];assert.equal(primitive.mode??4,4);const attributes={};for(const [semantic,index]of Object.entries(primitive.attributes)){const key={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv'}[semantic];assert(key,'Unknown authored MacArthur semantic '+semantic);attributes[key]=accessor(index);}result[name]={nodeIndex,nodeName:node.name,meshIndex:node.mesh,attributes,index:accessor(primitive.indices),matrixWorld:identity};
 }
 assert.equal(Object.keys(result).length,5,'Exact five authored bridge accessors unavailable');return result;
}
async function main(){
 for(const name of ['captures','geometry','programs','sources','assets','bundle'])await mkdir(join(output,name),{recursive:true});
 if(process.env.BELLE_MACARTHUR_PRODUCT)assert.equal(process.env.BELLE_MACARTHUR_PRODUCT,candidate,'Workflow pure product does not match the frozen fixture candidate');
 const repo=git('rev-parse','--show-toplevel'),repoPath=path=>relative(repo,path).split(sep).join('/');
 const original=(path,ref=BASE)=>execFileSync('git',['-C',repo,'show',ref+':'+repoPath(path)],{maxBuffer:128*1024*1024});
 assert(/^[a-f0-9]{40}$/.test(candidate),'Candidate must be an exact full product commit');execFileSync('git',['-C',repo,'merge-base','--is-ancestor',BASE,candidate]);
 report.source={head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),baseline:BASE,candidate,scratchOnly:!candidate,files:{},driverSha256:hash(await readFile(driver))};
 const support=['world.ts','macArthurSpanCulling.ts','macArthurSurface.ts','macArthurRailFinish.ts','conservatoryVisuals.ts','realisticMaterials.ts','worldAtmosphere.ts','photoReferenceSurfaces.ts','sunsetGround.ts','referenceIsland.ts','landmarkDetail.ts','terrain.ts','islandSky.ts','sunsetReferencePolicy.ts'];
 const texts={};
 for(const name of support){const path=join(game,'src/belle',name),baseline=original(path),current=await readFile(path),short='src/belle/'+name;
  if(proposedHashes[short])assert.equal(hash(current),proposedHashes[short],'Candidate differs from the frozen proposal: '+name);else assert(current.equals(baseline),'Common construction source changed from pure ae67: '+name);
  if(candidate)assert(current.equals(original(path,candidate)),'Current source differs from exact candidate product: '+name);
  await writeFile(join(output,'sources','baseline-'+name),baseline);await writeFile(join(output,'sources','candidate-'+name),current);retainedInputs.set(path,current);texts[name]={baseline:baseline.toString('utf8'),candidate:current.toString('utf8')};
  report.source.files[short]={path:repoPath(path),baselineSha256:hash(baseline),candidateSha256:hash(current),frozenProposalSha256:proposedHashes[short]??null};
 }
 const modules=new Map(),construction={};
 for(const side of sides){
  const world=texts['world.ts'][side],initial=span(world,'scene.add(landmarks.scene);const bridgePhotoFinish=','\n // Remove only the old solid Yacht Club shell');
  const dress='applyRealisticMaterials(scene);applyPhotoReferenceSurfaces(scene);if(REFERENCE_STYLE)dressSunsetGround(scene);';assert.equal(world.split(dress).length,2,'Actual whole-scene decorator span changed');
  const capture=side==='candidate'?span(world,'const macArthurShadowUvReceipts=','\n const referenceGarden='):'';
  const cull=world.match(/cullMacArthurSpans\(landmarks\.scene(?:,macArthurShadowUvReceipts)?\);/g);assert.equal(cull?.length,1,'Actual world cull call unavailable');
  const cullImport=side==='baseline'?'virtual:belle-macarthur-cull-baseline':'./macArthurSpanCulling.ts';
  const code=["import * as T from 'three';","import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';","import {finishMacArthurConcrete} from './macArthurSurface.ts';","import {finishMacArthurRailings} from './macArthurRailFinish.ts';","import {tuneConservatoryMaterial} from './conservatoryVisuals.ts';","import {applyRealisticMaterials} from './realisticMaterials.ts';","import {applyPhotoReferenceSurfaces} from './photoReferenceSurfaces.ts';","import {dressSunsetGround} from './sunsetGround.ts';","import {REFERENCE_STYLE} from './sunsetReferencePolicy.ts';",`import {cullMacArthurSpans${side==='candidate'?',type MacArthurUvReceipt':''}} from '${cullImport}';`,`export function initial(scene:T.Scene,landmarks:GLTF){${initial}\nreturn {bridgePhotoFinish,bridgeRailFinish};}`,`export function dress(scene:T.Scene){${dress}}`,`export function capture(landmarks:GLTF){${capture}\nreturn ${side==='candidate'?'macArthurShadowUvReceipts':'undefined'};}`,`export function cull(landmarks:GLTF,macArthurShadowUvReceipts:any){${cull[0]}}`].join('\n')+'\n';
  modules.set('\0virtual:belle-macarthur-world-'+side,{path:join(game,'src/belle/world.ts'),code});construction[side]={initialSha256:hash(initial),dressSha256:hash(dress),captureSha256:hash(capture),cullSha256:hash(cull[0]),moduleSha256:hash(code)};await writeFile(join(output,'sources',side+'-world-construction.ts'),code);
 }
 assert.equal(construction.baseline.initialSha256,construction.candidate.initialSha256);assert.equal(construction.baseline.dressSha256,construction.candidate.dressSha256);report.construction=construction;
 const cloud=span(texts['islandSky.ts'].candidate,'function cloudTexture(){','const fragment=');assert.equal(cloud,span(texts['islandSky.ts'].baseline,'function cloudTexture(){','const fragment='));
 modules.set('\0virtual:belle-macarthur-cloud',{path:join(game,'src/belle/islandSky.ts'),code:"import * as T from 'three';\n"+cloud+'\nexport {cloudTexture};\n'});
 modules.set('\0virtual:belle-macarthur-cull-baseline',{path:join(game,'src/belle/macArthurSpanCulling.ts'),code:texts['macArthurSpanCulling.ts'].baseline});
 await writeFile(join(output,'sources/cloud-construction.ts'),modules.get('\0virtual:belle-macarthur-cloud').code);
 report.assets=[];
 const assetNames=['belle/landmarks.glb','belle/map.json','belle/landmark-detail.json','belle/landmark-detail.bin'];
 for(const name of assetNames){const path=join(game,'public',name),bytes=await readFile(path),pinned=original(path);assert(bytes.equals(pinned),'Shipped input asset changed: '+name);if(candidate)assert(bytes.equals(original(path,candidate)),'Candidate changed shipped asset: '+name);
  if(name.endsWith('landmarks.glb')){assert.equal(bytes.length,59618460);assert.equal(hash(bytes),'560632f68f9f68974fef2f2f09f2e436f6742658ac864e35091e1c9a7c79e80f');authoredGeometry=originalGeometry(bytes);report.expectedAuthoredGeometry=authoredGeometry;}
  retainedInputs.set(path,bytes);served.set('/'+name,{bytes,type:name.endsWith('.json')?'application/json':'application/octet-stream'});
  const destination='assets/'+name;report.assets.push({path:repoPath(path),file:destination,bytes:bytes.length,sha256:hash(bytes),retained:!buildOnly});if(!buildOnly){await mkdir(dirname(join(output,destination)),{recursive:true});await writeFile(join(output,destination),bytes);}
 }
 const skinRoot=join(game,'public/belle/skins'),skinNames=(await readdir(skinRoot)).filter(name=>name.endsWith('.webp')).sort();assert.equal(skinNames.length,57);
 for(const name of skinNames){const path=join(skinRoot,name),bytes=await readFile(path);assert(bytes.equals(original(path)),'Real surface texture changed: '+name);retainedInputs.set(path,bytes);served.set('/belle/skins/'+name,{bytes,type:'image/webp'});const destination='assets/belle/skins/'+name;report.assets.push({path:repoPath(path),file:destination,bytes:bytes.length,sha256:hash(bytes),retained:!buildOnly});if(!buildOnly){await mkdir(dirname(join(output,destination)),{recursive:true});await writeFile(join(output,destination),bytes);}}
 const ownFiles=['macarthur-uv-scenes.ts','macarthur-uv-fixture.ts','macarthur-uv-native-check.mjs','macarthur-uv-native-proof.mjs','macarthur-uv-native-proof.test.mjs'];report.validationSources=[];
 for(const name of ownFiles){const path=join(game,'scripts',name),bytes=await readFile(path);retainedInputs.set(path,bytes);report.validationSources.push({path:repoPath(path),sha256:hash(bytes),bytes:bytes.length});await writeFile(join(output,'sources',name),bytes);}
 const imported=new Set(),bundle=join(output,'bundle');
 await build({configFile:false,root:game,publicDir:false,logLevel:'warn',plugins:[{
  name:'exact-macarthur-world-construction',
  async resolveId(id,importer){if(modules.has('\0'+id))return '\0'+id;if(modules.has(importer)&&id.startsWith('.'))return this.resolve(resolve(dirname(modules.get(importer).path),id),undefined,{skipSelf:true});},
  load(id){if(modules.has(id))return {code:modules.get(id).code,map:null};},
  transform(code,id){if(modules.has(id))return import('typescript').then(({default:ts})=>({code:ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,map:null}));if(id.startsWith(game+sep)&&!id.includes(sep+'node_modules'+sep))imported.add(id.split('?')[0]);},
 }],build:{outDir:bundle,emptyOutDir:true,target:'es2022',minify:false,sourcemap:true,lib:{entry:fixture,formats:['es'],fileName:()=> 'fixture.js'}}});
 report.commonSourceInputs=[];
 for(const path of [...imported].sort()){
  if(path.startsWith(join(game,'scripts')+sep))continue;const bytes=await readFile(path),short=relative(game,path).split(sep).join('/');
  if(proposedHashes[short])assert.equal(hash(bytes),proposedHashes[short]);else assert(bytes.equals(original(path)),'Bundled common source differs from pure ae67: '+short);
  if(candidate)assert(bytes.equals(original(path,candidate)),'Bundled input differs from pinned candidate: '+short);retainedInputs.set(path,bytes);
  const destination='sources/imported/'+short;await mkdir(dirname(join(output,destination)),{recursive:true});await writeFile(join(output,destination),bytes);report.commonSourceInputs.push({path:repoPath(path),file:destination,bytes:bytes.length,sha256:hash(bytes)});
 }
 report.installedThree=[];
 for(const name of ['package.json','build/three.module.js','build/three.core.js','src/renderers/WebGLRenderer.js','src/renderers/webgl/WebGLShadowMap.js','src/renderers/webgl/WebGLBindingStates.js']){const path=join(game,'node_modules/three',name),bytes=await readFile(path),destination='sources/installed-three/'+name;await mkdir(dirname(join(output,destination)),{recursive:true});await writeFile(join(output,destination),bytes);report.installedThree.push({file:destination,bytes:bytes.length,sha256:hash(bytes)});retainedInputs.set(path,bytes);}
 const html=Buffer.from('<!doctype html><meta charset="utf-8"><title>Native MacArthur display UV validation</title><style>body{margin:16px;background:#18212b;color:#fff;font:14px sans-serif}canvas{display:block;width:320px;height:240px}</style><script type="module" src="/fixture.js"></script>');await writeFile(join(bundle,'index.html'),html);served.set('/',{bytes:html,type:'text/html'});served.set('/index.html',{bytes:html,type:'text/html'});
 async function bundleFiles(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())await bundleFiles(path);else{const name='/'+relative(bundle,path).split(sep).join('/'),bytes=await readFile(path);served.set(name,{bytes,type:name.endsWith('.js')?'application/javascript':name.endsWith('.map')?'application/json':name.endsWith('.html')?'text/html':'application/octet-stream'});}}}await bundleFiles(bundle);
 report.bundleSha256=hash(await readFile(join(bundle,'fixture.js')));await checkpoint();
 if(buildOnly){report.status='build-only; no native pixels, generic attributes, draw receipts or performance claims';await checkpoint();return;}
 assert.equal(process.platform,'darwin','Native macOS Chrome/Metal is required');
 server=createServer((request,response)=>{try{const path=new URL(request.url,'http://localhost').pathname;if(path==='/favicon.ico'){response.writeHead(204);response.end();return;}const value=served.get(path);if(!value){response.writeHead(404);response.end('Unretained input');return;}response.writeHead(200,{'Content-Type':value.type,'Content-Length':value.bytes.length,'Cache-Control':'no-store'});response.end(value.bytes);}catch(error){response.writeHead(500);response.end(String(error));}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const require=createRequire(resolve(game,'../../package.json')),{chromium}=require('@playwright/test');
 report.runtime={node:process.version,platform:process.platform,arch:process.arch,playwright:require('@playwright/test/package.json').version};report.launch={channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']};browser=await chromium.launch(report.launch);report.browserVersion=browser.version();
 deadline=setTimeout(()=>{report.errors.push('Standalone MacArthur fixture exceeded360seconds');void browser?.close().catch(error=>report.errors.push('Deadline cleanup: '+String(error)));},360000);
 report.url='http://127.0.0.1:'+server.address().port;report.initial=await makePage(report.url);report.setupComplete=true;
 report.geometryBefore=await saveGeometry('initial');
 const warmA=await saveCapture(await page.evaluate(()=>window.__macArthurUvFixture.prime()),'actual-warm-primer');
 const warmB=await capture('candidate',0,'screen-msaa4','fresh','primer','actual-warm-candidate');report.primer=warmA.metadata;report.primerCandidate=warmB.metadata;
 const primerNative={baseline:captureCheck(warmA,{expectedNames:[warmName],generic:[0,0,0,1]}),candidate:captureCheck(warmB,{expectedNames:[warmName],generic:[0,0,0,1]})},primerPair=proof.compareCaptureReceipts(warmA.metadata,warmB.metadata,{mapped:true,witness:false});
 report.primerProof={native:primerNative,pair:primerPair,color:compare(warmA.color,warmB.color,320),shadow:compare(warmA.shadow,warmB.shadow,256)};
 report.primerProof.passed=Object.values(primerNative).every(row=>row.passed)&&primerPair.passed&&report.primerProof.color.equal&&report.primerProof.shadow.equal;await checkpoint();
 for(const generic of ['fresh','poisoned'])for(const view of [0,1])for(const target of outputs){
  const name=['product',generic,'view'+view,target].join('-'),captures={};
  for(const side of sides)captures[side]=await capture(side,view,target,generic,'all',name+'-'+side);
  const coverage={};
  for(const side of sides){
   const original=captures[side],hidden=await capture(side,view,target,generic,'hidden',name+'-'+side+'-hidden'),receiver=await capture(side,view,target,generic,'receiver',name+'-'+side+'-receiver'),receiverOff=await capture(side,view,target,generic,'receiver-no-casters',name+'-'+side+'-receiver-no-casters');
   const subject=compare(original.color,hidden.color,320),shadow=compare(original.shadow,hidden.shadow,256),receiverEffect=compare(receiver.color,receiverOff.color,320),receiverShadowSame=compare(original.shadow,receiver.shadow,256),casters=[];
   for(const caster of eligibleNames){const short=caster.replace(/^MacArthur_/,'').replaceAll('_','-'),omitted=await capture(side,view,target,generic,'omit:'+caster,name+'-'+side+'-omit-'+short),receiverOmitted=await capture(side,view,target,generic,'receiver-omit:'+caster,name+'-'+side+'-receiver-omit-'+short);
    const color=compare(original.color,omitted.color,320),shadow=compare(original.shadow,omitted.shadow,256),receiverContribution=compare(receiver.color,receiverOmitted.color,320),receiverShadow=compare(receiver.shadow,receiverOmitted.shadow,256);
    casters.push({name:caster,passed:omitted.metadata.passed&&receiverOmitted.metadata.passed&&color.differingPixels>=16&&shadow.differingPixels>=16&&receiverContribution.differingPixels>=16&&receiverShadow.differingPixels>=16,color,shadow,receiverContribution,receiverShadow,omitted:omitted.metadata,receiverOmitted:receiverOmitted.metadata});
   }
   const restored=await capture(side,view,target,generic,'all',name+'-'+side+'-restored'),colorRestored=compare(original.color,restored.color,320),shadowRestored=compare(original.shadow,restored.shadow,256);
   coverage[side]={passed:hidden.metadata.passed&&receiver.metadata.passed&&receiverOff.metadata.passed&&restored.metadata.passed&&subject.differingPixels>=16&&shadow.differingPixels>=16&&receiverEffect.differingPixels>=16&&receiverShadowSame.equal&&casters.every(row=>row.passed)&&colorRestored.equal&&shadowRestored.equal,subject,shadow,receiverEffect,receiverShadowSame,casters,colorRestored,shadowRestored,hidden:hidden.metadata,receiver:receiver.metadata,receiverOff:receiverOff.metadata,restored:restored.metadata};
  }
  const native=Object.fromEntries(sides.map(side=>[side,captureCheck(captures[side],{generic:generic==='fresh'?[0,0,0,1]:[.375,.625,1,1]})]));
  const pair=proof.compareCaptureReceipts(captures.baseline.metadata,captures.candidate.metadata,{mapped:true,witness:false});
  const row={name,color:compare(captures.baseline.color,captures.candidate.color,320),shadow:compare(captures.baseline.shadow,captures.candidate.shadow,256),native,pair,coverage,baseline:captures.baseline.metadata,candidate:captures.candidate.metadata};row.passed=row.color.equal&&row.shadow.equal&&native.baseline.passed&&native.candidate.passed&&pair.passed&&coverage.baseline.passed&&coverage.candidate.passed;report.comparisons.push(row);await checkpoint();
 }
 for(const view of [0,1])for(const target of outputs){
  const name=['diagnostic-witness','view'+view,target].join('-'),zeroA=await capture('baseline',view,target,'reset','all',name+'-baseline-zero',true),zeroB=await capture('candidate',view,target,'reset','all',name+'-candidate-zero',true);
  const nativeA=captureCheck(zeroA,{mapped:false,witness:true,generic:[0,0,0,1]}),nativeB=captureCheck(zeroB,{mapped:false,witness:true,generic:[0,0,0,1]}),pair=proof.compareCaptureReceipts(zeroA.metadata,zeroB.metadata,{mapped:false,witness:true}),difference=compare(zeroA.color,zeroB.color,320);
  report.witnessPairs.push({name,passed:difference.equal&&nativeA.passed&&nativeB.passed&&pair.passed,difference,nativeA,nativeB,pair,baseline:zeroA.metadata,candidate:zeroB.metadata});
  const poisonA=await capture('baseline',view,target,'poisoned','all',name+'-baseline-generic-poison',true),poisonB=await capture('candidate',view,target,'poisoned','all',name+'-candidate-generic-poison',true),restoreA=await capture('baseline',view,target,'reset','all',name+'-baseline-generic-restored',true);
  const changed=compare(zeroA.color,poisonA.color,320),candidateUnaffected=compare(zeroB.color,poisonB.color,320),restoration=compare(zeroA.color,restoreA.color,320);
  const genericNative={baseline:captureCheck(poisonA,{mapped:false,witness:true,generic:[.375,.625,1,1]}),candidate:captureCheck(poisonB,{mapped:false,witness:true,generic:[.375,.625,1,1]}),restored:captureCheck(restoreA,{mapped:false,witness:true,generic:[0,0,0,1]})};
  report.witnessControls.push({name:name+'-real-three-generic-color-seed',passed:Object.values(genericNative).every(row=>row.passed)&&changed.differingPixels>=16&&candidateUnaffected.equal&&restoration.equal,native:genericNative,changed,candidateUnaffected,restoration,before:zeroA.metadata,changedBaseline:poisonA.metadata,unchangedCandidate:poisonB.metadata,restored:restoreA.metadata});
  let changedCapture,enabled,disabled;
  try{enabled=await page.evaluate(()=>window.__macArthurUvFixture.setAttributeControl(true));changedCapture=await capture('candidate',view,target,'reset','all',name+'-candidate-array-poison',true);}
  finally{disabled=await page.evaluate(()=>window.__macArthurUvFixture.setAttributeControl(false));}
  const restored=await capture('candidate',view,target,'reset','all',name+'-candidate-array-restored',true),arrayEffect=compare(zeroB.color,changedCapture.color,320),matchesPoison=compare(poisonA.color,changedCapture.color,320),arrayRestoration=compare(zeroB.color,restored.color,320);
  const arrayNative={changed:captureCheck(changedCapture,{mapped:false,witness:true,generic:[0,0,0,1]}),restored:captureCheck(restored,{mapped:false,witness:true,generic:[0,0,0,1]})};
  const attributeProof=proof.validateAttributeControl(enabled,disabled,report.geometryBefore,{before:zeroB.metadata,changed:changedCapture.metadata,restored:restored.metadata});
  report.witnessControls.push({name:name+'-candidate-uv-array-replacement',passed:Object.values(arrayNative).every(row=>row.passed)&&attributeProof.passed&&arrayEffect.differingPixels>=16&&matchesPoison.equal&&arrayRestoration.equal&&enabled.attributes.every(row=>!row.sourceHasUv)&&disabled.attributes.every(row=>!row.sourceHasUv),native:arrayNative,attributeProof,arrayEffect,matchesPoison,arrayRestoration,enabled,disabled,before:zeroB.metadata,changed:changedCapture.metadata,restored:restored.metadata});await checkpoint();
 }
 report.geometryAfter=await saveGeometry('final');report.geometryProof=proof.validateGeometry(report.geometryBefore,report.geometryAfter);const mappedPrograms=await savePrograms();
 report.programProof=proof.validatePrograms(mappedPrograms,report.comparisons.map(row=>({baseline:row.baseline,candidate:row.candidate})),{mapped:true,primer:report.primer});
 report.witnessProgramProof=proof.validatePrograms(mappedPrograms,report.witnessPairs.map(row=>({baseline:row.baseline,candidate:row.candidate})),{mapped:false,witness:true});
 report.programs=mappedPrograms.map(({vertexSource,fragmentSource,...row})=>({...row,vertexSha256:hash(vertexSource),fragmentSha256:hash(fragmentSource)}));report.final=await page.evaluate(()=>window.__macArthurUvFixture.state());await checkpoint();
 // The reverse-order cache contract gets a fresh page, renderer and private
 // Three default depth material. A reset in the first context is not fresh.
 await page.close();page=undefined;contextLabel='unmapped-first';report.reverseInitial=await makePage(report.url+'/?order=unmapped-first');
 const reverseA=await saveCapture(await page.evaluate(()=>window.__macArthurUvFixture.prime()),'reverse-baseline'),reverseB=await capture('candidate',0,'screen-msaa4','fresh','reverse','reverse-candidate');
 const reverseNames=[...eligibleNames,warmName],reversePrograms=await savePrograms(),reverseNativeA=captureCheck(reverseA,{mapped:false,expectedNames:reverseNames}),reverseNativeB=captureCheck(reverseB,{mapped:false,expectedNames:reverseNames}),reversePair=proof.compareCaptureReceipts(reverseA.metadata,reverseB.metadata,{mapped:false,witness:false});
 const reverseColor=compare(reverseA.color,reverseB.color,320),reverseShadow=compare(reverseA.shadow,reverseB.shadow,256),reverseProgramProof=proof.validatePrograms(reversePrograms,[{baseline:reverseA.metadata,candidate:reverseB.metadata}],{mapped:false});
 report.reverseContract={scope:'Separate fresh-context reversed actual shadow traversal, outside the eight mapped-first product quality pairs and diagnostic witness counts.',passed:reverseColor.equal&&reverseShadow.equal&&reverseNativeA.passed&&reverseNativeB.passed&&reversePair.passed&&reverseProgramProof.passed,color:reverseColor,shadow:reverseShadow,nativeBaseline:reverseNativeA,nativeCandidate:reverseNativeB,pair:reversePair,programProof:reverseProgramProof,baseline:reverseA.metadata,candidate:reverseB.metadata,programs:reversePrograms.map(({vertexSource,fragmentSource,...row})=>({...row,vertexSha256:hash(vertexSource),fragmentSha256:hash(fragmentSource)})),final:await page.evaluate(()=>window.__macArthurUvFixture.state())};
 report.sourceImmutable={passed:true,files:[]};for(const [path,bytes]of retainedInputs){const current=await readFile(path),unchanged=current.equals(bytes);report.sourceImmutable.files.push({path:repoPath(path),sha256:hash(bytes),unchanged});if(!unchanged)report.sourceImmutable.passed=false;}
 report.passed=report.primerProof.passed&&report.comparisons.length===8&&report.comparisons.every(row=>row.passed)&&report.witnessPairs.length===4&&report.witnessPairs.every(row=>row.passed)&&report.witnessControls.length===8&&report.witnessControls.every(row=>row.passed)&&report.geometryBefore.authoredAssetProof.passed&&report.geometryAfter.authoredAssetProof.passed&&report.geometryProof.passed&&report.programProof.passed&&report.witnessProgramProof.passed&&report.reverseContract.passed&&report.sourceImmutable.passed&&!report.final.attributeControl&&!report.final.errors.length&&!report.errors.length&&!report.consoleErrors.length&&!report.failedRequests.length;
 report.status=report.passed?'passed':'failed; all raw captures and failed predicates retained';await checkpoint();assert(report.passed,'Standalone MacArthur native correctness gates failed; see retained report and raw evidence');
}
try{await main();}
catch(error){report.errors.push(String(error?.stack??error));process.exitCode=1;console.error(error);}
finally{if(deadline)clearTimeout(deadline);closing=true;if(page){try{await savePrograms();}catch(error){report.errors.push('Final source retention: '+String(error));}}await checkpoint();await browser?.close();await new Promise(resolve=>server?server.close(resolve):resolve());}
