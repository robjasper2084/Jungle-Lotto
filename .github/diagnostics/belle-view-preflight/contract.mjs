/** Immutable source/build and read-only collection contract. No release verdict. */
import assert from 'node:assert/strict';
import {readFile,readdir,lstat,writeFile,mkdir} from 'node:fs/promises';
import {readFileSync,createReadStream} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256,gitBlob,rawJson} from './evidence.mjs';
import {gridShape} from './grid-capture.mjs';
export {sha256,gitBlob};
export const GAME='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game';
export const GENERATED_BUILD_RECEIPT='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/research/street-detail-stats.json';
export const PIN=Object.freeze(JSON.parse(readFileSync(new URL('./pins.json',import.meta.url))));
export const REQUIRED_SOURCE_PATHS=Object.freeze([
 '.github/workflows/belle-staged-architecture-native.yml',
 ...['scripts/staged-landmark-walk-proof.mjs','scripts/staged-landmark-exterior-proof.mjs','scripts/staged-landmark-exterior-view-advice.mjs','scripts/coop-static-server.mjs',
 'src/belle/stagedLandmarkProof.ts','src/belle/stagedLandmarkGroundFit.ts','src/belle/stagedLandmarkViewBounds.ts','src/belle/farTreeVisibility.ts','src/belle/main.ts','src/belle/world.ts','package.json','package-lock.json'].map(path=>GAME+'/'+path)
]);
export const SITES=Object.freeze([
 {id:'107227742',label:'aquarium',title:'Belle Isle Aquarium',action:'Travel to entrance'},
 {id:'107310050',label:'conservatory',title:'Anna Scripps Whitcomb Conservatory',action:'Travel to path'}
]);
export const SCOPE=Object.freeze({diagnosticOnly:true,releaseAcceptance:false,completeViewsAcceptance:false,collisionAcceptance:false,performanceAcceptance:false,deadlineAcceptance:false});
export const NORMAL_GRAPHICS=Object.freeze({quality:'automatic',fps:'60',antiAliasing:'automatic'});
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const count=value=>Number.isSafeInteger(value)&&value>=0;
export function assertPins(pin=PIN){
 assert.equal(pin.version,1);assert.equal(pin.state,'fixed-source-reviewed','Future fixed source has not been pinned; no fallback build is permitted');
 assert.equal(pin.repository,'robjasper2084/Jungle-Lotto');assert.equal(pin.buildMode,'same-run-original-staged-build');
 for(const key of ['head','tree'])assert.match(pin[key]??'',/^[a-f0-9]{40}$/,'Missing immutable '+key);
 assert(!['28ca0a857cc114a976c86fd0bd6fc86c93747e62','32f25acf9a681b75ebf2018de2cac4234d8b4b2f','c271634dd06ae76b1188fd1e9e9c32d19ba3b1fb'].includes(pin.head),'Old source cannot provide the fixed tree-source observation');
 assert.equal(pin.artifactName,'belle-view-preflight-fixed-staged-build-NOT-RELEASE');
 assert(Array.isArray(pin.sourceFiles)&&pin.sourceFiles.length>=REQUIRED_SOURCE_PATHS.length);
 const paths=pin.sourceFiles.map(row=>row.path);assert.equal(new Set(paths).size,paths.length);
 for(const path of REQUIRED_SOURCE_PATHS)assert(paths.includes(path),'Missing original source pin: '+path);
 for(const row of pin.sourceFiles){assert(!row.path.startsWith('/')&&!row.path.includes('\\')&&!row.path.split('/').includes('..'));assert.match(row.sha256,/^[a-f0-9]{64}$/);assert.match(row.gitBlob,/^[a-f0-9]{40}$/);assert(count(row.bytes)&&row.bytes>0);}
 return pin;
}
export async function hashFile(path){const hash=createHash('sha256');let bytes=0;for await(const part of createReadStream(path)){hash.update(part);bytes+=part.length;}return{bytes,sha256:hash.digest('hex')};}
export async function inventory(directory){
 const rows=[];
 async function visit(path){for(const entry of await readdir(path,{withFileTypes:true})){
  const file=resolve(path,entry.name),name=relative(directory,file).split('\\').join('/');assert(!entry.isSymbolicLink(),'Unexpected build symlink: '+name);
  if(entry.isDirectory())await visit(file);else{assert((await lstat(file)).isFile(),'Unexpected build type');rows.push({file:name,...await hashFile(file)});}
 }}await visit(directory);return rows.sort((a,b)=>a.file<b.file?-1:a.file>b.file?1:0);
}
export async function verifySource(checkout,{archiveTo}={}){
 assertPins();const git=args=>execFileSync('git',args,{cwd:checkout,encoding:'utf8'}).trim();
 assert.equal(git(['rev-parse','HEAD']),PIN.head);assert.equal(git(['rev-parse','HEAD^{tree}']),PIN.tree);
 assert.equal(git(['diff','--name-only','HEAD','--']),'','Tracked application source changed');
 const files=[];
 for(const row of PIN.sourceFiles){
  const file=resolve(checkout,row.path),stat=await lstat(file);assert(stat.isFile()&&!stat.isSymbolicLink());const bytes=await readFile(file);
  assert.equal(bytes.length,row.bytes);assert.equal(sha256(bytes),row.sha256,'Pinned source bytes changed: '+row.path);assert.equal(gitBlob(bytes),row.gitBlob);
  assert.equal(git(['rev-parse',PIN.head+':'+row.path]),row.gitBlob);files.push({...row});
  if(archiveTo){const destination=resolve(archiveTo,'application-source',row.path);await mkdir(dirname(destination),{recursive:true});await writeFile(destination,bytes,{flag:'wx'});}
 }
 if(archiveTo)await writeFile(resolve(archiveTo,'application-commit.txt'),git(['cat-file','-p',PIN.head])+'\n',{flag:'wx'});
 return{head:PIN.head,tree:PIN.tree,sourceFiles:files};
}
export function assertDurationOnlyBuildReceipt(original,generated){
 const baseline=JSON.parse(original),actual=JSON.parse(generated);
 for(const row of [baseline,actual])assert(row&&typeof row==='object'&&!Array.isArray(row)&&Object.hasOwn(row,'buildMs')&&finite(row.buildMs)&&row.buildMs>=0,'Invalid generated buildMs');
 assert.deepEqual({...actual,buildMs:null},{...baseline,buildMs:null},'Original build changed a non-duration research field');
 return{originalBuildMs:baseline.buildMs,generatedBuildMs:actual.buildMs};
}
/** The original build rewrites one research receipt's elapsed duration. Archive
 * those real bytes and restore only that proven duration-only generated file. */
export async function preserveGeneratedBuildReceipt(checkout,evidence){
 const git=args=>execFileSync('git',args,{cwd:checkout,encoding:'utf8'}).trim();assert.equal(git(['rev-parse','HEAD']),PIN.head);
 const changed=git(['diff','--name-only','HEAD','--']).split('\n').filter(Boolean);
 assert(changed.every(path=>path===GENERATED_BUILD_RECEIPT),'Original build changed tracked source beyond its duration receipt');
 const path=resolve(checkout,GENERATED_BUILD_RECEIPT),info=await lstat(path);assert(info.isFile()&&!info.isSymbolicLink());
 const original=execFileSync('git',['show',PIN.head+':'+GENERATED_BUILD_RECEIPT],{cwd:checkout}),generated=await readFile(path);
 const durations=assertDurationOnlyBuildReceipt(original.toString(),generated.toString());await mkdir(evidence,{recursive:true});
 await writeFile(resolve(evidence,'generated-build-receipt.json'),generated,{flag:'wx'});await writeFile(resolve(evidence,'generated-build-receipt-pinned-source.json'),original,{flag:'wx'});
 const receipt={path:GENERATED_BUILD_RECEIPT,source:PIN.head,changedPaths:changed,...durations,generated:{bytes:generated.length,sha256:sha256(generated)},pinned:{bytes:original.length,sha256:sha256(original),gitBlob:gitBlob(original)},restoredOnlyDurationReceipt:!generated.equals(original)};
 if(!generated.equals(original))await writeFile(path,original);
 assert.deepEqual(await readFile(path),original);assert.equal(git(['diff','--name-only','HEAD','--']),'','Tracked source remains changed after duration-only receipt restoration');
 await writeFile(resolve(evidence,'generated-build-receipt-preservation.json'),rawJson(receipt,true),{flag:'wx'});return receipt;
}
export function buildOutputContract(env=process.env){
 const contract={id:Number(env.PREFLIGHT_BUILD_ARTIFACT_ID),runId:Number(env.GITHUB_RUN_ID),sha256:env.PREFLIGHT_BUILD_ARTIFACT_SHA256,
  inventorySha256:env.PREFLIGHT_BUILD_INVENTORY_SHA256,indexSha256:env.PREFLIGHT_BUILD_INDEX_SHA256,diagnosticHead:env.DIAGNOSTIC_EXPECTED_HEAD};
 assert(Number.isSafeInteger(contract.id)&&contract.id>0&&Number.isSafeInteger(contract.runId)&&contract.runId>0,'Missing exact same-run build artifact identity');
 for(const key of ['sha256','inventorySha256','indexSha256'])assert.match(contract[key]??'',/^[a-f0-9]{64}$/,'Missing same-run build output '+key);
 assert.match(contract.diagnosticHead??'',/^[a-f0-9]{40}$/);return contract;
}
export function verifyArtifactMetadata(metadata,binding){
 assert.equal(metadata.id,binding.id);assert.equal(metadata.name,PIN.artifactName);assert.equal(metadata.expired,false);
 assert.equal(metadata.workflow_run.id,binding.runId);assert.equal(metadata.workflow_run.head_sha,binding.diagnosticHead);
 assert.equal(metadata.digest,'sha256:'+binding.sha256);assert(count(metadata.size_in_bytes)&&metadata.size_in_bytes>0);
}
export async function verifyBuild(directory,files,{indexSha256}={}){
 const map=new Map(files.map(row=>[row.file,row]));assert.equal(map.size,files.length);
 const index=await readFile(resolve(directory,'index.html')),manifestBytes=await readFile(resolve(directory,'asset-manifest.json')),markerBytes=await readFile(resolve(directory,'staged-landmark-proof-build.json'));
 for(const [file,bytes]of[['index.html',index],['asset-manifest.json',manifestBytes],['staged-landmark-proof-build.json',markerBytes]])assert.deepEqual(map.get(file),{file,bytes:bytes.length,sha256:sha256(bytes)});
 const marker=JSON.parse(markerBytes);assert.equal(marker.sourceSha,PIN.head);assert.equal(marker.stagedFlag,'VITE_STAGED_BELLE_ARCHITECTURE=1');assert.equal(marker.indexSha256,sha256(index));
 if(indexSha256)assert.equal(marker.indexSha256,indexSha256,'Build-job index output changed');
 const assets=JSON.parse(manifestBytes);assert(Array.isArray(assets)&&assets.length&&new Set(assets).size===assets.length&&assets.every(file=>map.has(file)));
 const scripts=[...index.toString().matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(match=>match[1].replace(/^\.\//,'').replace(/^\//,''));
 assert(scripts.length&&scripts.every(file=>map.has(file)));const mains=files.filter(row=>/^assets\/main-[^/]+\.js$/.test(row.file));assert.equal(mains.length,1);
 return{sourceSha:PIN.head,stagedFlag:marker.stagedFlag,indexSha256:sha256(index),assetManifestSha256:sha256(manifestBytes),entryScripts:scripts,mainScript:mains[0].file,files:files.length};
}
export async function verifyInputs(checkout,evidence){
 const source=await verifySource(checkout),binding=buildOutputContract();
 const metadata=JSON.parse(await readFile(resolve(evidence,'artifact-metadata.json'),'utf8'));verifyArtifactMetadata(metadata,binding);
 const provenance=JSON.parse(await readFile(resolve(evidence,'artifact-provenance.json'),'utf8'));
 assert.deepEqual(provenance.binding,binding);assert.equal(provenance.zipSha256,binding.sha256);assert.equal(provenance.zipBytes,metadata.size_in_bytes);
 assert.equal(provenance.sourceHead,PIN.head);assert.equal(provenance.sourceTree,PIN.tree);assert.equal(provenance.allMembersCrcVerified,true);
 assert.equal(provenance.archiveRetainedBy,'immutable upstream Actions artifact; duplicate ZIP omitted from native evidence');
 const inventoryBytes=await readFile(resolve(evidence,'dist-manifest.json'));assert.equal(sha256(inventoryBytes),binding.inventorySha256,'Full build inventory differs from the build job output');
 const expected=JSON.parse(inventoryBytes),files=await inventory(resolve(checkout,GAME,'dist'));assert.deepEqual(files,expected,'Consumed compiled build bytes changed');
 assert.equal(provenance.files,files.length,'Restored immutable artifact count changed');
 return{...source,binding,artifact:{id:metadata.id,name:metadata.name,bytes:metadata.size_in_bytes,sha256:binding.sha256,runId:binding.runId},build:await verifyBuild(resolve(checkout,GAME,'dist'),files,binding),files};
}
export function isGameUrl(value){try{const url=new URL(value);return url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.pathname==='/'&&!url.hash&&!url.username&&!url.password&&JSON.stringify([...url.searchParams].sort())===JSON.stringify([['profile','1'],['stagedArchitectureProof','1']]);}catch{return false;}}
export function assertSnapshot(snapshot,id){
 assert(snapshot?.ready&&count(snapshot.frames)&&snapshot.frames>0);const actor=snapshot.actor;
 assert(actor&&['x','y','z','headingY','speed','footBlend'].every(key=>finite(actor[key]))&&actor.onFoot&&actor.firstPerson&&actor.footBlend>.99,'Missing real settled on-foot first-person pose');
 for(const key of ['position','direction'])assert(Array.isArray(snapshot.camera?.[key])&&snapshot.camera[key].length===3&&snapshot.camera[key].every(finite));
 const site=snapshot.sites?.find(row=>row.id===id);assert(site&&site.installedLods===3);assert.deepEqual(site.attachedLegacyFacades,[]);return site;
}
export function assertObservation(observation,id,exterior){
 assert(observation&&observation.version===1&&observation.id===id,'Missing complete view observation');assert.deepEqual(observation.target,exterior.bounds);
 assert(finite(observation.range)&&observation.range>0&&observation.range<=2000);assert(Array.isArray(observation.boxes)&&observation.boxes.length<=40000,'Original box limit exceeded');
 for(const key of ['verticesRead','refinementVerticesRead','refinedMeshGroups','refinementSteps','indexBlocksRead','indexBlocksRetained','clippingPlanesRead','selectedTreePools','selectedTreeInstances','selectedTreeMatrixElements','currentRenderedTreeInstances'])assert(count(observation[key]),'Missing bounded fixed-source counter: '+key);
 assert(observation.verticesRead+observation.refinementVerticesRead<=20000000&&observation.refinementSteps<=1000000,'Original geometry work limit exceeded');
 assert(observation.selectedTreeInstances<=40000&&observation.selectedTreeMatrixElements===observation.selectedTreeInstances*16,'Fixed selected-tree source copy is incomplete');
 assert(Array.isArray(observation.unsupported),'Unsupported geometry receipt missing');
 for(const box of observation.boxes){for(const key of ['min','max'])assert(Array.isArray(box[key])&&box[key].length===3&&box[key].every(finite));assert(box.max.every((value,i)=>value>=box.min[i]));}
 assert.deepEqual(observation.camera,exterior.camera,'Atomic view and exterior camera receipts disagree');assert.deepEqual(observation.selectedLevels,exterior.selectedLevels);
 const shape=gridShape(exterior.bounds,exterior.camera);assert.equal(observation.range,shape.range+shape.radius,'Original view query envelope changed');
}
export function assertGraphics(value){assert.deepEqual(value,NORMAL_GRAPHICS,'Observed original automatic/60/automatic graphics changed');}
export function assertNativeEvidence(evidence,sites){
 assert(evidence&&evidence.overflow===false&&Array.isArray(evidence.events)&&evidence.events.length<=10000);assert.deepEqual(evidence.focusLossDuringInput,[]);assert.deepEqual(evidence.held,[]);
 let previous=-Infinity;const held=new Set();let fDown=0;
 for(const event of evidence.events){assert(event.trusted===true&&finite(event.at)&&event.at>=previous,'Missing trusted ordered native input');previous=event.at;
  if(['keydown','keyup'].includes(event.type)){
   assert(['KeyF','KeyV'].includes(event.code),'Preflight issued an input beyond native F/V');
   if(event.type==='keydown'){assert(!held.has(event.code),'Repeated held input');held.add(event.code);if(event.code==='KeyF')fDown++;}
   else{assert(held.delete(event.code),'Unpaired native key release');}
  }
 }
 assert.equal(held.size,0);assert.equal(fDown,2,'Each public Guide arrival requires one native dismount');
 assert(evidence.events.some(event=>event.type==='click'&&event.target==='#start'),'Missing native start');
 for(const site of SITES){
  assert(evidence.events.some(event=>event.type==='click'&&event.landmark===site.title&&event.text===site.action),'Missing public Guide arrival: '+site.id);
  const pulse=evidence.events.filter(event=>event.phase==='dismount-'+site.id&&event.code==='KeyF'&&['keydown','keyup'].includes(event.type));
  assert.deepEqual(pulse.map(event=>event.type),['keydown','keyup'],'Each site requires its own exactly paired native F pulse');
 }
 let expectedVPulses=0;
 for(const site of sites){
  const receipt=site.nativeFirstPerson;assert(receipt&&typeof receipt.changed==='boolean');assert.equal(receipt.phase,'first-person-'+site.id);assert.equal(receipt.changed,receipt.before.actor.firstPerson!==true);assert.equal(receipt.after.actor.firstPerson,true);
  const pulse=evidence.events.filter(event=>event.phase===receipt.phase&&event.code==='KeyV'&&['keydown','keyup'].includes(event.type));
  assert.deepEqual(pulse.map(event=>event.type),receipt.changed?['keydown','keyup']:[],'First-person change lacked its exactly paired native V');if(receipt.changed)expectedVPulses++;
 }
 assert.equal(evidence.events.filter(event=>event.type==='keydown'&&event.code==='KeyV').length,expectedVPulses,'Unexpected native V outside an original first-person transition');
 for(const rows of Object.values(evidence.traces)){assert(Array.isArray(rows)&&rows.length<=4096);}
}
export function assertConsumedResponses(rows,input,url){
 assert(isGameUrl(url));const origin=new URL(url).origin,map=new Map(input.files.map(row=>[row.file,row]));assert(Array.isArray(rows)&&rows.length);
 for(const row of rows){const parsed=new URL(row.url);assert.equal(parsed.origin,origin);assert(!parsed.hash&&!parsed.username&&!parsed.password);assert.equal(row.status,200);assert.equal(row.fromServiceWorker,false);
  const file=parsed.pathname==='/'?'index.html':decodeURIComponent(parsed.pathname).replace(/^\//,'');assert.deepEqual({file,bytes:row.bytes,sha256:row.sha256},map.get(file),'Actual browser-consumed source differs from the immutable build');
 }
 for(const file of ['index.html',...input.build.entryScripts,input.build.mainScript])assert(rows.some(row=>(new URL(row.url).pathname==='/'?'index.html':decodeURIComponent(new URL(row.url).pathname).replace(/^\//,''))===file),'Missing actual browser-consumed bytes: '+file);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,checkout,evidence]=process.argv.slice(2);assertPins();
 if(mode==='print-head')console.log('head='+PIN.head);
 else if(mode==='source'){const receipt=await verifySource(resolve(checkout),{archiveTo:resolve(evidence)});await writeFile(resolve(evidence,'application-source-receipt.json'),rawJson(receipt,true),{flag:'wx'});}
 else if(mode==='built'){
  await preserveGeneratedBuildReceipt(resolve(checkout),resolve(evidence));await verifySource(resolve(checkout));const files=await inventory(resolve(checkout,GAME,'dist')),build=await verifyBuild(resolve(checkout,GAME,'dist'),files);
  const bytes=Buffer.from(JSON.stringify(files,null,2)+'\n');await mkdir(evidence,{recursive:true});await writeFile(resolve(evidence,'dist-manifest.json'),bytes,{flag:'wx'});
  await writeFile(resolve(evidence,'build-binding.json'),rawJson({head:PIN.head,tree:PIN.tree,build,inventorySha256:sha256(bytes)},true),{flag:'wx'});
  console.log('inventory_sha256='+sha256(bytes));console.log('index_sha256='+build.indexSha256);
 }else throw Error('Unknown source/build contract command');
}
