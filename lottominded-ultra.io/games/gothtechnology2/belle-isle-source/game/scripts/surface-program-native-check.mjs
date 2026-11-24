import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdir,open,readFile,readdir,writeFile} from 'node:fs/promises';
import {dirname,resolve,relative,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {validateHeroCapture,compareHeroNativeSources} from './hero-index-native-proof.mjs';
import {validateOrderCapture,validateOrderBindings,compareOrderStage} from './material-order-native-proof.mjs';
import {validateBoatOrderCapture,validateBoatOrderBindings,compareBoatOrderStage,compareBoatAllMaterials,boatOrderCaseIds} from './boat-order-native-proof.mjs';

const BASE='e424aac64ad82f2448c11717c38c592d666c2af9';
const GROUND_BASE='8cd309d76c93593025b22f971c580b47aadcad01';
const GLOW_BASE='108bbae1d475a6dbbfb914be8394dbe3347ba669';
const HERO_BASE='108bbae1d475a6dbbfb914be8394dbe3347ba669';
const ORDER_BASE='318a94f7ce3fd47b12ec980b855e56469fcecca8';
const BOAT_ORDER_BASE='0439350062e9f9bb122363b3339604aa19d7494e';
const BOAT_ORDER_PRODUCT='09cf5f3c7438bb198c922087f6d92435780d095e';
const EXISTING_CASES=["axis-planar-pigment","axis-planar-zero","axis-triplanar-pigment","axis-triplanar-zero","ordered-material-switches","authored-shader-hook","maps-normal-alpha-shadow","maps-normal-zero-pigment","instanced-color-material","moving-original-coordinates","skinned-cloth-motion","static-palette-projection-bindings","bank-river-grass","bank-lagoon-earth","bank-formal-stone","pond-service-brick","pond-service-roof","street-plain","street-curb","street-gutter","scott-shipped-granite","scott-shipped-marble","river-near-original-mesh","river-far-original-mesh","lawn-original","lawn-original-rediscovered","lawn-garden-soil","lawn-garden-soil-rediscovered","lawn-garden-green-rediscovered","lawn-oudolf-rediscovered","pitch-ordinary-material","pitch-joined-rediscovered","glow-wheel-authored","glow-wheel-dim","glow-wheel-off","glow-hover-authored","glow-hover-dim","glow-hover-off","hero-ink-pose1","hero-detail-pose1","hero-shadow-pose1","hero-ink-pose2","hero-detail-pose2","hero-shadow-pose2","hero-ink-pose0","hero-detail-pose0","hero-shadow-pose0","hero-detail-pose1-large-palette","hero-shadow-pose1-large-palette","order-station-late","order-station-reference","order-wheel-late","order-wheel-reference"];
const game=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(process.env.BELLE_SURFACE_OUTPUT??resolve(game,'surface-program-evidence'));
const source=resolve(game,'src/belle/realisticMaterials.ts');
const fixture=resolve(game,'scripts/surface-program-fixture.ts');
const virtual='\0virtual:belle-surface-baseline';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',['-C',game,...args],{encoding:'utf8',maxBuffer:16*1024*1024}).trim();
const report={version:1,baseline:BASE,groundCompositionBaseline:GROUND_BASE,glowBaseline:GLOW_BASE,heroBaseline:HERO_BASE,materialOrderBaseline:ORDER_BASE,boatOrderBaseline:BOAT_ORDER_BASE,boatOrderProduct:BOAT_ORDER_PRODUCT,passed:false,setupComplete:false,buildOnly:process.env.BELLE_SURFACE_BUILD_ONLY==='1',
 comparisons:[],shadowComparisons:[],heroSourceIdentity:[],controls:[],errors:[],consoleErrors:[],failedRequests:[],note:'Exact RGBA comparisons on native Metal. Fixture rendering/readback is validation, not a performance measurement. Counts are linked WebGL program identities, not native Metal pipeline identities.'};
let browser,page,server,closing=false,deadline;
const checkpoint=()=>writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
function compare(a,b,width=320){
 assert.equal(a.length,b.length,'RGBA sizes differ');let channels=0,pixels=0,maxDifference=0;const firstPixels=[];
 for(let i=0;i<a.length;i+=4){let changed=false;for(let j=0;j<4;j++)if(a[i+j]!==b[i+j]){channels++;changed=true;maxDifference=Math.max(maxDifference,Math.abs(a[i+j]-b[i+j]));}
  if(changed){pixels++;if(firstPixels.length<16)firstPixels.push({x:(i/4)%width,yFromBottom:Math.floor(i/4/width),baseline:[...a.subarray(i,i+4)],candidate:[...b.subarray(i,i+4)]});}}
 return {equal:channels===0,differingChannels:channels,differingPixels:pixels,maxDifference,firstPixels};
}
async function saveCapture(name,capture){
 const rgba=Buffer.from(capture.rgba,'base64'),png=Buffer.from(capture.png,'base64');assert.equal(rgba.length,capture.width*capture.height*4);
 const colors=new Set();for(let i=0;i<rgba.length;i+=4)colors.add(rgba.readUInt32LE(i));
 await writeFile(join(output,'captures',name+'.rgba'),rgba);await writeFile(join(output,'captures',name+'.png'),png);
 const {rgba:_,png:__,shadow,...metadata}=capture;
 const shadowSaved=shadow?await saveCapture(name+'-shadow-target',{...shadow,id:'shadow-target-'+capture.id,side:capture.side,view:capture.view,output:capture.output,subjectPresent:capture.subjectPresent,contributionPresent:capture.contributionPresent}):undefined;
 const result={bytes:rgba,shadow:shadowSaved,metadata:{...metadata,shadow:shadowSaved?.metadata,rgbaSha256:sha(rgba),pngSha256:sha(png),uniqueColors:colors.size}};
 await writeFile(join(output,'captures',name+'-metadata.json'),JSON.stringify(result.metadata,null,2)+'\n');
 const proof=validateHeroCapture(result.metadata);if(proof)result.metadata.heroValidation=proof;
 const orderProof=validateOrderCapture(result.metadata);if(orderProof)result.metadata.orderValidation=orderProof;
 const boatProof=validateBoatOrderCapture(result.metadata);if(boatProof)result.metadata.boatOrderValidation=boatProof;
 return result;
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
 const moduleFiles={surface:'realisticMaterials.ts',bank:'surfaceFinish.ts',pond:'pondServiceBuildings.ts',street:'streetDetails.ts',scott:'fountainDetail.ts',water:'water.ts',atmosphere:'worldAtmosphere.ts',terrain:'cinematicTerrain.ts',sunset:'sunsetGround.ts',world:'world.ts',oudolf:'oudolfScene.ts',sky:'islandSky.ts',glow:'referenceActors.ts'};
 const modules=new Map();report.moduleSources={};
 for(const [name,file]of Object.entries(moduleFiles)){
  const path=resolve(game,'src/belle',file),repoPath=relative(repo,path).split(sep).join('/');
  const ref=name==='glow'?GLOW_BASE:['atmosphere','terrain','sunset','world','oudolf','sky'].includes(name)?GROUND_BASE:BASE;
  const before=execFileSync('git',['-C',repo,'show',ref+':'+repoPath]),after=await readFile(path);
  modules.set('\0virtual:belle-'+name+'-baseline',{path,code:before.toString('utf8')});
  report.moduleSources[name]={path:repoPath,baseline:ref,baselineSha256:sha(before),candidateSha256:sha(after)};
  await writeFile(join(output,'baseline-'+file),before);await writeFile(join(output,'candidate-'+file),after);
 }
 const heroPath=resolve(game,'runtime/ride-core/src/heroDetail.ts'),heroRepoPath=relative(repo,heroPath).split(sep).join('/');
 const heroBefore=execFileSync('git',['-C',repo,'show',HERO_BASE+':'+heroRepoPath]),heroAfter=await readFile(heroPath);
 modules.set('\0virtual:belle-hero-detail-baseline',{path:heroPath,code:heroBefore.toString('utf8')});
 report.moduleSources.heroDetail={path:heroRepoPath,baseline:HERO_BASE,baselineSha256:sha(heroBefore),candidateSha256:sha(heroAfter)};
 await writeFile(join(output,'baseline-heroDetail.ts'),heroBefore);await writeFile(join(output,'candidate-heroDetail.ts'),heroAfter);
 const heroAssetPath=resolve(game,'public/exports/rigged-heroes/DS_Armored_Rider_01.glb'),heroAssetBytes=await readFile(heroAssetPath);
 const heroAsset={url:'/exports/rigged-heroes/DS_Armored_Rider_01.glb',path:relative(repo,heroAssetPath).split(sep).join('/'),bytes:heroAssetBytes.length,sha256:sha(heroAssetBytes),retainedPath:'actual-hero-rig.glb'};
 await writeFile(join(output,heroAsset.retainedPath),heroAssetBytes);
 assert.equal(heroAsset.sha256,'b213894836ccc70eae371ffef6fb6a41688537f08c59aed6ea93dfd96f491674','Actual shipped hero asset changed');report.heroAsset=heroAsset;
 // The shipped rig references two real PNGs outside its GLB. Parse the actual
 // image inventory, retain their exact baseline/current bytes, and serve only
 // those URLs. Missing images must remain failures; no placeholder is supplied.
 assert.equal(heroAssetBytes.toString('ascii',0,4),'glTF');assert.equal(heroAssetBytes.readUInt32LE(4),2);assert.equal(heroAssetBytes.readUInt32LE(16),0x4e4f534a);
 const heroJsonLength=heroAssetBytes.readUInt32LE(12);assert(heroJsonLength>0&&20+heroJsonLength<=heroAssetBytes.length,'Invalid actual hero JSON chunk');
 const heroDocument=JSON.parse(heroAssetBytes.subarray(20,20+heroJsonLength).toString('utf8'));
 const heroImages=heroDocument.images.filter(image=>typeof image.uri==='string');assert.equal(heroImages.length,2,'Actual hero external image inventory changed');
 const heroDependencies=[],servedHeroDependencies=new Map();await mkdir(join(output,'hero-assets'),{recursive:true});
 const heroOrigin='http://fixture.invalid',heroBaseUrl=new URL(heroAsset.url,heroOrigin);
 for(const image of heroImages){
  const resolved=new URL(image.uri,heroBaseUrl);assert.equal(resolved.origin,heroOrigin);assert(!resolved.search&&!resolved.hash&&/^\/shared-textures\/[a-f0-9]{64}\.png$/.test(resolved.pathname),'Unexpected actual hero image URL');
  assert(!servedHeroDependencies.has(resolved.pathname),'Duplicate hero external image URL');
  const path=resolve(game,'public',resolved.pathname.slice(1)),repoPath=relative(repo,path).split(sep).join('/'),bytes=await readFile(path);
  const before=execFileSync('git',['-C',repo,'show',HERO_BASE+':'+repoPath],{maxBuffer:16*1024*1024});assert.equal(sha(bytes),sha(before),'Actual hero dependency changed: '+repoPath);
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Actual hero dependency must be PNG');
  const retainedPath='hero-assets/'+resolved.pathname.split('/').at(-1),dependency={uri:image.uri,url:resolved.pathname,path:repoPath,bytes:bytes.length,sha256:sha(bytes),baseline:HERO_BASE,retainedPath};
  await writeFile(join(output,retainedPath),bytes);heroDependencies.push(dependency);servedHeroDependencies.set(dependency.url,{path,dependency});
 }
 heroAsset.dependencies=heroDependencies;report.heroDependencies=heroDependencies;
 await writeFile(join(output,'hero-dependencies.json'),JSON.stringify(heroDependencies,null,2)+'\n');
 modules.set('\0virtual:belle-hero-index-asset',{path:resolve(game,'scripts/hero-index-fixtures.ts'),code:'export default '+JSON.stringify(heroAsset)+';'});
 await writeFile(join(output,'hero-asset-manifest.json'),JSON.stringify(heroAsset,null,2)+'\n');
 report.heroValidationSources={};
 for(const file of ['scripts/hero-index-fixtures.ts','scripts/hero-index-native-proof.mjs','scripts/program-family-fixtures.ts','scripts/surface-program-fixture.ts','scripts/surface-program-native-check.mjs','src/belle/referenceActors.ts','src/belle/riderInkBatch.ts','runtime/ride-core/src/surfaceFinish.ts']){
  const path=resolve(game,file),contents=await readFile(path);report.heroValidationSources[file]={path:relative(repo,path).split(sep).join('/'),sha256:sha(contents)};
  await writeFile(join(output,'hero-source-'+file.replaceAll('/','_')),contents);
 }
 // Preserve all original96 cases against e424. The additional ground cases
 // isolate this key-only correction against the exact preceding pure product.
 const groundSurface=execFileSync('git',['-C',repo,'show',GROUND_BASE+':'+relativeSource]);
 modules.set('\0virtual:belle-surface-ground-baseline',{path:source,code:groundSurface.toString('utf8')});
 report.groundSurfaceSource={path:relativeSource,baseline:GROUND_BASE,baselineSha256:sha(groundSurface),candidateSha256:sha(candidateSource)};
 await writeFile(join(output,'ground-baseline-realisticMaterials.ts'),groundSurface);
 // Reproduce the shipped lawn construction and queued discovery order without
 // starting the entire world or replacing its authored hooks with test shaders.
 // Every extracted byte, complete source file and generated module is retained.
 const between=(code,start,end)=>{
  assert.equal(code.split(start).length,2,'Construction start must be unique: '+start);
  const from=code.indexOf(start),to=code.indexOf(end,from);
  assert(to>from,'Construction end missing: '+end);return code.slice(from,to).trim();
 };
 // These late constructors compare only the new explicit preparation seam with
 // the preceding owner-corrected pure product. Earlier cohorts keep their pins.
 report.orderSources={};await mkdir(join(output,'order-sources'),{recursive:true});
 const orderFiles={atmosphere:'src/belle/worldAtmosphere.ts',surface:'src/belle/realisticMaterials.ts',station:'src/belle/coastGuard.ts',world:'src/belle/world.ts',main:'src/belle/main.ts',sky:'src/belle/islandSky.ts',broader:'src/belle/broaderPresentation.ts',riderView:'runtime/elmwood-source/src/detroit/riding/threeRiderView.ts',wheelLights:'runtime/elmwood-source/src/detroit/wheelLights.ts',controller:'runtime/ride-core/src/controller.ts',photo:'src/belle/photoReferenceSurfaces.ts',sunset:'src/belle/sunsetGround.ts',actorFinish:'src/belle/referenceActors.ts',riderInk:'src/belle/riderInkBatch.ts',heroDetail:'runtime/ride-core/src/heroDetail.ts',profiles:'runtime/ride-core/src/profiles.ts',atmosphereIdentity:'src/belle/atmosphereProgramIdentity.ts',atmosphereShaders:'src/belle/atmosphereShaders.ts',physicalLighting:'src/belle/physicalLighting.ts',riverBoats:'src/belle/riverBoats.ts'};
 const orderText={baseline:{},candidate:{}},orderBaselineByPath=new Map();
 for(const [name,file]of Object.entries(orderFiles)){
  const path=resolve(game,file),repoPath=relative(repo,path).split(sep).join('/');
  const before=execFileSync('git',['-C',repo,'show',ORDER_BASE+':'+repoPath],{maxBuffer:16*1024*1024}),after=await readFile(path);
  const common=!['atmosphere','surface','station','world','main','sky','broader','riverBoats'].includes(name);if(common)assert.equal(sha(after),sha(before),'Common actual order dependency changed: '+file);
  report.orderSources[name]={path:repoPath,baseline:ORDER_BASE,baselineSha256:sha(before),candidateSha256:sha(after),commonDependencyUnchanged:common?true:undefined};
  orderText.baseline[name]=before.toString('utf8');orderText.candidate[name]=after.toString('utf8');
  for(const [side,bytes]of [['baseline',before],['candidate',after]])await writeFile(join(output,'order-sources',side+'-'+name+'.ts'),bytes);
  if(['atmosphere','surface','station','riverBoats'].includes(name)){
   const id='\0virtual:belle-order-'+name+'-baseline';modules.set(id,{path,code:before.toString('utf8')});orderBaselineByPath.set(path,id);
  }
 }
 report.orderDependencyIsolation={baseline:ORDER_BASE,modules:[...orderBaselineByPath].map(([path,id])=>({id:id.slice(1),path:relative(repo,path).split(sep).join('/'),sha256:sha(modules.get(id).code)})),resolved:[]};
 report.orderConstruction={};
 for(const side of ['baseline','candidate']){
  const text=orderText[side],stationStart=side==='baseline'?'const coastGuard=addCoastGuard(scene);':'const coastGuard=addCoastGuard(scene,islandSky.prepareMaterial);';
  const station=between(text.world,stationStart,'const streetLights='),actor=between(text.main,'const hero=new ThreeRiderView(','// The first acceleration'),clouds=between(text.sky,'function cloudTexture(){','const fragment=');
  const surfaceImport=side==='baseline'?'virtual:belle-order-surface-baseline':'./realisticMaterials.ts',stationImport=side==='baseline'?'virtual:belle-order-station-baseline':'./coastGuard.ts';
  const code=["import * as T from 'three';",'import {applyRealisticMaterials} from '+JSON.stringify(surfaceImport)+';', 'import {addCoastGuard} from '+JSON.stringify(stationImport)+';',"import {ThreeRiderView} from '../../runtime/elmwood-source/src/detroit/riding/threeRiderView.ts';","import {HUMAN_PROFILE} from '../../runtime/ride-core/src/profiles.ts';","import {animeRider,glowVehicle} from './referenceActors.ts';","import {REFERENCE_STYLE} from './sunsetReferencePolicy.ts';",'export function createStation(scene:T.Scene,islandSky:any){'+station+';return coastGuard;}','export function createActor(scene:T.Scene,rider:any,wheel:any,terrain:any,core:any,world:any){'+actor+';return hero;}',clouds,'export {cloudTexture};'].join('\n')+'\n';
  modules.set('\0virtual:belle-order-contracts-'+side,{path:resolve(game,'src/belle/world.ts'),code});
  report.orderConstruction[side]={moduleSha256:sha(code),stationSpanSha256:sha(station),actorSpanSha256:sha(actor),cloudsSha256:sha(clouds)};
  await writeFile(join(output,'order-sources',side+'-construction.ts'),code);
 }
 // The new boat cases isolate only the explicit constructor preparation added
 // after pure043. The unchanged surface/owner modules are shared deliberately,
 // preserving the one real material WeakSet used by actor and boat preparation.
 report.boatOrderSources={};await mkdir(join(output,'boat-order-sources'),{recursive:true});
 const boatFiles={station:'src/belle/coastGuard.ts',riverBoats:'src/belle/riverBoats.ts',ride:'src/belle/boatRide.ts',world:'src/belle/world.ts',main:'src/belle/main.ts',surface:'src/belle/realisticMaterials.ts',atmosphere:'src/belle/worldAtmosphere.ts',sky:'src/belle/islandSky.ts',atmosphereShaders:'src/belle/atmosphereShaders.ts',identity:'src/belle/atmosphereProgramIdentity.ts',physicalLighting:'src/belle/physicalLighting.ts',rules:'src/belle/realisticMaterialRules.ts',startup:'src/belle/startupWork.ts',retry:'src/belle/surfaceRetry.ts',geometry:'src/belle/sharedGeometryBuffers.ts',traffic:'src/belle/riverTrafficPlan.ts',stationLayout:'src/belle/coastGuardLayout.json',boatProfiles:'src/belle/boatProfiles.ts',boatController:'src/belle/boatController.ts',boatCockpit:'src/belle/boatCockpit.ts',boatSpray:'src/belle/boatHullSpray.ts',boatWake:'src/belle/boatWake.ts',boatJets:'src/belle/boatJets.ts',boatEffects:'src/belle/boatEffectsState.ts',boatClub:'src/belle/boatClubPlan.ts',riverWaves:'src/belle/riverWaves.ts',riderView:'runtime/elmwood-source/src/detroit/riding/threeRiderView.ts',wheelLights:'runtime/elmwood-source/src/detroit/wheelLights.ts',actorFinish:'src/belle/referenceActors.ts',riderInk:'src/belle/riderInkBatch.ts',heroDetail:'runtime/ride-core/src/heroDetail.ts',profiles:'runtime/ride-core/src/profiles.ts',controller:'runtime/ride-core/src/controller.ts',limbIK:'runtime/ride-core/src/limbIK.ts',photo:'src/belle/photoReferenceSurfaces.ts',sunset:'src/belle/sunsetGround.ts'};
 const boatText={baseline:{},candidate:{}},boatBaselineByPath=new Map();
 for(const [name,file]of Object.entries(boatFiles)){
  const path=resolve(game,file),repoPath=relative(repo,path).split(sep).join('/'),before=execFileSync('git',['-C',repo,'show',BOAT_ORDER_BASE+':'+repoPath],{maxBuffer:16*1024*1024}),after=await readFile(path),common=!['station','riverBoats','ride','world','main'].includes(name);
  assert(after.equals(execFileSync('git',['-C',repo,'show',BOAT_ORDER_PRODUCT+':'+repoPath],{maxBuffer:16*1024*1024})),'Actual boat source differs from exact candidate product: '+file);
  if(common)assert(before.equals(after),'Common actual boat construction source changed: '+file);
  report.boatOrderSources[name]={path:repoPath,baseline:BOAT_ORDER_BASE,baselineSha256:sha(before),candidateSha256:sha(after),commonDependencyUnchanged:common};boatText.baseline[name]=before.toString('utf8');boatText.candidate[name]=after.toString('utf8');
  for(const [side,bytes]of [['baseline',before],['candidate',after]])await writeFile(join(output,'boat-order-sources',side+'-'+name+(file.endsWith('.json')?'.json':'.ts')),bytes);
  if(['station','riverBoats','ride'].includes(name)){const id='\0virtual:belle-boat-order-'+name+'-baseline';modules.set(id,{path,code:before.toString('utf8')});boatBaselineByPath.set(path,id);}
 }
 report.boatDependencyIsolation={baseline:BOAT_ORDER_BASE,modules:[...boatBaselineByPath].map(([path,id])=>({id:id.slice(1),path:relative(repo,path).split(sep).join('/'),sha256:sha(modules.get(id).code)})),sharedSurface:{path:report.boatOrderSources.surface.path,sha256:report.boatOrderSources.surface.candidateSha256},resolved:[]};
 report.boatOrderConstruction={};
 for(const side of ['baseline','candidate']){
  const text=boatText[side],stationStart=side==='baseline'?'const coastGuard=addCoastGuard(scene);':'const coastGuard=addCoastGuard(scene,islandSky.prepareMaterial);',station=between(text.world,stationStart,'const streetLights='),actor=between(text.main,'const hero=new ThreeRiderView(','// The first acceleration'),boats=between(text.main,'boat=new BoatRide(','const radio='),clouds=between(text.sky,'function cloudTexture(){','const fragment=');
  assert.equal(boats.includes('prepareMaterial:world.sky.prepareMaterial'),side==='candidate','Actual BoatRide owner callback span differs');
  const stationImport=side==='baseline'?'virtual:belle-boat-order-station-baseline':'./coastGuard.ts',rideImport=side==='baseline'?'virtual:belle-boat-order-ride-baseline':'./boatRide.ts';
  const code=["import * as T from 'three';","import {applyRealisticMaterials} from './realisticMaterials.ts';",'import {addCoastGuard} from '+JSON.stringify(stationImport)+';','import {BoatRide} from '+JSON.stringify(rideImport)+';',"import {ThreeRiderView} from '../../runtime/elmwood-source/src/detroit/riding/threeRiderView.ts';","import {HUMAN_PROFILE} from '../../runtime/ride-core/src/profiles.ts';","import {animeRider,glowVehicle} from './referenceActors.ts';","import {REFERENCE_STYLE} from './sunsetReferencePolicy.ts';",'export function createStation(scene:T.Scene,islandSky:any){'+station+';return coastGuard;}','export function createActor(scene:T.Scene,rider:any,wheel:any,terrain:any,core:any,world:any){'+actor+';return hero;}',
   // These lexical values belong to main's event callbacks. The fixture runs
   // the real constructor/docked update and does not trigger board/exit input.
   'export function createBoats(scene:T.Scene,terrain:any,hero:any,world:any,boatAssets:any[]){let boat:BoatRide;const cadillac:any=undefined,photo:any=undefined,hover:any=undefined,realLocation:any=undefined,core={current:{x:0,z:0,headingY:0}},canvas={focus(){}};const blocked=()=>false,clear=()=>{},release=()=>{},jump=(..._args:any[])=>{};let boatReturn={x:0,z:0,headingY:0},cameraYaw=0,cameraPitch=0,snap=false;'+boats+';return boat;}',clouds,'export {cloudTexture};'].join('\n')+'\n';
  modules.set('\0virtual:belle-boat-order-contracts-'+side,{path:resolve(game,'src/belle/world.ts'),code});report.boatOrderConstruction[side]={moduleSha256:sha(code),stationSpanSha256:sha(station),actorSpanSha256:sha(actor),boatSpanSha256:sha(boats),cloudsSha256:sha(clouds)};await writeFile(join(output,'boat-order-sources',side+'-construction.ts'),code);
 }
 assert.equal(report.boatOrderConstruction.baseline.actorSpanSha256,report.boatOrderConstruction.candidate.actorSpanSha256,'Existing actual hero constructor changed');assert.equal(report.boatOrderConstruction.baseline.cloudsSha256,report.boatOrderConstruction.candidate.cloudsSha256);
 // ThreeRiderView's actual small image overlays are Vite-embedded input assets.
 // Retain and hash their shipped bytes too; the constructor must load them.
 report.orderImageAssets=[];await mkdir(join(output,'order-assets'),{recursive:true});
 for(const file of ['runtime/elmwood-source/art/helmet-ghoulies-20261004/ghoulies-decal.webp','runtime/elmwood-source/art/armor-keychain-20261004/lottomind-charm.webp']){
  const path=resolve(game,file),repoPath=relative(repo,path).split(sep).join('/'),bytes=await readFile(path),before=execFileSync('git',['-C',repo,'show',ORDER_BASE+':'+repoPath],{maxBuffer:16*1024*1024});assert.equal(sha(bytes),sha(before),'Actual order image changed');
  const retainedPath='order-assets/'+file.split('/').at(-1);await writeFile(join(output,retainedPath),bytes);report.orderImageAssets.push({path:repoPath,bytes:bytes.length,sha256:sha(bytes),retainedPath,baseline:ORDER_BASE});
 }
 report.constructionSources={};
 for(const side of ['baseline','candidate']){
  const world=await readFile(join(output,side+'-world.ts'),'utf8'),oudolf=await readFile(join(output,side+'-oudolfScene.ts'),'utf8'),sky=await readFile(join(output,side+'-islandSky.ts'),'utf8');
  const mat=world.match(/^const mat=.*$/m)?.[0];assert(mat,'Actual world material factory missing');
  const grass=between(world,'const grass=mat(',';const pavement=mat(')+';';
  assert(world.includes("grass.name='Park lawn';"),'Authored lawn name changed');
  const gardens=between(world,'const pitchSurface=mat(','for(const a of data.areas)');
  const cut=between(oudolf,'const cutLawn=lawn.clone()','add(aisles,cutLawn,');
  const clouds=between(sky,'function cloudTexture(){','const fragment=');
  const code=["import * as T from 'three';",mat,
   "export function createGrass(){"+grass+"grass.name='Park lawn';return grass;}",
   'export function createGardenMaterials(grass:T.MeshStandardMaterial){'+gardens+'return {pitchSurface,gardenSoil,gardenLawn};}',
   'export function createCutLawn(lawn:T.MeshStandardMaterial){'+cut+'return cutLawn;}',
   clouds,'export {cloudTexture};'].join('\n')+'\n';
  const id='\0virtual:belle-ground-contracts-'+side;
  modules.set(id,{path:resolve(game,'src/belle/world.ts'),code});
  report.constructionSources[side]={moduleSha256:sha(code),matSha256:sha(mat),grassSha256:sha(grass),gardensSha256:sha(gardens),cutLawnSha256:sha(cut),cloudsSha256:sha(clouds)};
  await writeFile(join(output,side+'-ground-construction.ts'),code);
 }
 // Import the two shipped stone material records, without substituting sample
 // colors or downloading unrelated landmark mesh/texture payloads in the page.
 const landmark=await open(join(game,'public/belle/landmarks.glb'),'r');let materialRecords,jsonChunk;
 try{
  const header=Buffer.alloc(20);assert.equal((await landmark.read(header,0,20,0)).bytesRead,20);
  assert.equal(header.toString('ascii',0,4),'glTF');assert.equal(header.readUInt32LE(16),0x4e4f534a);
  const length=header.readUInt32LE(12);assert(length>0&&length<=16*1024*1024,'Bounded landmark JSON chunk required');
  jsonChunk=Buffer.alloc(length);assert.equal((await landmark.read(jsonChunk,0,length,20)).bytesRead,length);
  const document=JSON.parse(jsonChunk.toString('utf8'));
  materialRecords=['Monument pale granite','Monument white marble'].map(name=>{const matches=document.materials.filter(m=>m.name===name);assert.equal(matches.length,1);return matches[0];});
 }finally{await landmark.close();}
 const records=JSON.stringify(materialRecords,null,2)+'\n';await writeFile(join(output,'shipped-scott-materials.json'),records);
 report.scottMaterialSource={path:'public/belle/landmarks.glb',jsonChunkSha256:sha(jsonChunk),recordsSha256:sha(Buffer.from(records))};
 const skinRoot=resolve(game,'public/belle/skins'),textureFiles=(await readdir(skinRoot)).filter(name=>name.endsWith('.webp')).sort();
 assert.equal(textureFiles.length,57,'Expected all57 real surface textures');const textureManifest=[];
 for(const name of textureFiles){const bytes=await readFile(join(skinRoot,name));assert(bytes.length>100,'Texture missing or placeholder: '+name);textureManifest.push({path:'belle/skins/'+name,bytes:bytes.length,sha256:sha(bytes)});}
 report.textureFiles=textureManifest.length;await writeFile(join(output,'texture-manifest.json'),JSON.stringify(textureManifest,null,2)+'\n');
 // The actual vehicle bodies and shells are validation inputs, not replacement
 // samples. Verify both assets against the exact preceding product and retain
 // their complete bytes for an independent geometry/image audit.
 const glowAssets=[];const servedGlowAssets=new Map();await mkdir(join(output,'assets'),{recursive:true});
 for(const [kind,assetPath]of [['wheel','public/exports/glb/DS_EUC_01/DS_EUC_01_LOD1.glb'],['hover','public/belle/vehicles/hero-hoverbike.glb']]){
  const path=resolve(game,assetPath),repoPath=relative(repo,path).split(sep).join('/'),bytes=await readFile(path);
  const baselineBytes=execFileSync('git',['-C',repo,'show',GLOW_BASE+':'+repoPath],{maxBuffer:16*1024*1024});
  assert.equal(sha(bytes),sha(baselineBytes),'Actual glow asset changed: '+assetPath);
  const url='/'+assetPath.slice('public/'.length),retainedPath='assets/glow-'+kind+'.glb';
  const record={kind,url,path:repoPath,bytes:bytes.length,sha256:sha(bytes),baseline:GLOW_BASE,retainedPath};
  glowAssets.push(record);servedGlowAssets.set(url,{path,record});await writeFile(join(output,retainedPath),bytes);
 }
 report.orderAssets=[];for(const row of [heroAsset,glowAssets.find(asset=>asset.kind==='wheel')]){const before=execFileSync('git',['-C',repo,'show',ORDER_BASE+':'+row.path],{maxBuffer:16*1024*1024});assert.equal(sha(before),row.sha256,'Actual order asset changed from its own baseline');report.orderAssets.push({...row,baseline:ORDER_BASE});}
 report.glowAssets=glowAssets;modules.set('\0virtual:belle-glow-assets',{path:fixture,code:'export default '+JSON.stringify(glowAssets)+';'});
 const boatAssets=[],servedBoatAssets=new Map();await mkdir(join(output,'boat-assets'),{recursive:true});
 for(const [kind,file,expectedHash]of [['offshore','speedboat.glb','90eff0488bc92f932c5738e0a54207a4798fcbde29a2f8c6b0ceabdb10f9c36c'],['hydroplane','hydroplane.glb','e4127d1ded87fd8f0c9bbb29839f2ffb8f3488e01fb9c2804a552de957389b48']]){
  const path=resolve(game,'public/belle/vehicles',file),repoPath=relative(repo,path).split(sep).join('/'),bytes=await readFile(path),before=execFileSync('git',['-C',repo,'show',BOAT_ORDER_BASE+':'+repoPath],{maxBuffer:16*1024*1024});assert(bytes.equals(before),'Actual complete boat asset changed');assert.equal(sha(bytes),expectedHash);
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(16),0x4e4f534a);const document=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));assert.equal((document.images??[]).length,0,'Unexpected unserved boat asset image');
  const url='/belle/vehicles/'+file,retainedPath='boat-assets/'+file,record={kind,url,path:repoPath,baseline:BOAT_ORDER_BASE,bytes:bytes.length,sha256:sha(bytes),retainedPath};boatAssets.push(record);servedBoatAssets.set(url,{path,record});await writeFile(join(output,retainedPath),bytes);
 }
 report.boatAssets=boatAssets;modules.set('\0virtual:belle-boat-order-assets',{path:fixture,code:'export default '+JSON.stringify(boatAssets)+';'});
 for(const asset of [heroAsset,glowAssets.find(asset=>asset.kind==='wheel')])assert.equal(sha(execFileSync('git',['-C',repo,'show',BOAT_ORDER_BASE+':'+asset.path],{maxBuffer:16*1024*1024})),asset.sha256,'Actual boat rider dependency changed');
 report.validationSources={};await mkdir(join(output,'sources'),{recursive:true});
 for(const name of ['surface-program-fixture.ts','program-family-fixtures.ts','vehicle-glow-fixtures.ts','material-order-fixtures.ts','material-order-native-proof.mjs','surface-program-native-check.mjs','boat-order-fixtures.ts','boat-order-native-proof.mjs','boat-order-native-proof.test.mjs']){
  const path=resolve(game,'scripts',name),bytes=await readFile(path);report.validationSources[name]={path:relative(repo,path).split(sep).join('/'),sha256:sha(bytes)};await writeFile(join(output,'sources',name),bytes);
 }
 const buildDir=join(output,'bundle');
 await build({configFile:false,root:game,publicDir:false,logLevel:'warn',resolve:{alias:{'@digital-static/ridecore':resolve(game,'runtime/ride-core/src/index.ts')}},plugins:[{
  name:'exact-baseline-surface-module',
  async resolveId(id,importer){
   if(modules.has('\0'+id)||id==='virtual:belle-scott-materials')return '\0'+id;
   if(modules.has(importer)&&id.startsWith('.')){
    const path=resolve(dirname(modules.get(importer).path),id);
    if(importer.startsWith('\0virtual:belle-boat-order-')){
     if(importer.endsWith('-baseline')&&boatBaselineByPath.has(path)){const resolved=boatBaselineByPath.get(path);report.boatDependencyIsolation.resolved.push({importer:importer.slice(1),request:id,resolved:resolved.slice(1)});return resolved;}
     if(path===resolve(game,'src/belle/realisticMaterials.ts'))report.boatDependencyIsolation.resolved.push({importer:importer.slice(1),request:id,resolved:'common:'+report.boatOrderSources.surface.path});
    }
    // The baseline station creates real response boats before its whole-scene
    // dressing pass. Both must use the same baseline surface module/WeakSet.
    // Keep the candidate and every earlier independently pinned cohort intact.
    if(importer.startsWith('\0virtual:belle-order-')&&importer.endsWith('-baseline')&&orderBaselineByPath.has(path)){
     const resolved=orderBaselineByPath.get(path);report.orderDependencyIsolation.resolved.push({importer:importer.slice(1),request:id,resolved:resolved.slice(1)});return resolved;
    }
    return this.resolve(path,undefined,{skipSelf:true});
   }
  },
  load(id){if(modules.has(id))return {code:modules.get(id).code,map:null};if(id==='\0virtual:belle-scott-materials')return 'export default '+JSON.stringify(materialRecords)+';';},
  transform(code,id){if(modules.has(id))return import('typescript').then(({default:ts})=>({code:ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,map:null}));}
 }],build:{outDir:buildDir,emptyOutDir:true,target:'es2022',minify:false,sourcemap:true,lib:{entry:fixture,formats:['es'],fileName:()=> 'fixture.js'}}});
 for(const [importer,request,resolved]of [['virtual:belle-order-station-baseline','./riverBoats.ts','virtual:belle-order-riverBoats-baseline'],['virtual:belle-order-riverBoats-baseline','./realisticMaterials.ts','virtual:belle-order-surface-baseline']])
  assert(report.orderDependencyIsolation.resolved.some(edge=>edge.importer===importer&&edge.request===request&&edge.resolved===resolved),'Baseline order material dependency escaped its source identity: '+importer+' '+request);
 for(const [importer,request,resolved]of [['virtual:belle-boat-order-station-baseline','./riverBoats.ts','virtual:belle-boat-order-riverBoats-baseline'],...['riverBoats','ride','contracts'].map(name=>['virtual:belle-boat-order-'+name+'-baseline','./realisticMaterials.ts','common:'+report.boatOrderSources.surface.path])])
  assert(report.boatDependencyIsolation.resolved.some(edge=>edge.importer===importer&&edge.request===request&&edge.resolved===resolved),'Boat baseline dependency escaped its real material owner: '+importer+' '+request);
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
   else if(path===heroAsset.url){file=heroAssetPath;type='model/gltf-binary';}
   else if(servedHeroDependencies.has(path)){file=servedHeroDependencies.get(path).path;type='image/png';}
   else if(allowedTextures.has(path)){file=join(skinRoot,path.split('/').at(-1));type='image/webp';}
   else if(servedGlowAssets.has(path)){file=servedGlowAssets.get(path).path;type='model/gltf-binary';}
   else if(servedBoatAssets.has(path)){file=servedBoatAssets.get(path).path;type='model/gltf-binary';}
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
 assert.equal(report.initial.cases.length,58,'Preserve all53 existing cases and add5 actual boat-order cases');
 assert.deepEqual(report.initial.cases.filter(id=>!id.startsWith('boat-order-')),EXISTING_CASES,'Exact original212/16/18 case identities/order changed');
 assert.deepEqual(report.initial.cases.filter(id=>id.startsWith('boat-order-')).sort(),[...boatOrderCaseIds].sort());
 assert.equal(report.initial.cases.filter(id=>!id.startsWith('hero-')&&!id.startsWith('glow-')&&!id.startsWith('order-')&&!id.startsWith('boat-order-')).length,32,'Retain all original128 image cases');
 assert.equal(report.initial.cases.filter(id=>id.startsWith('order-')).length,4,'Actual order case inventory changed');
 assert.equal(report.initial.cases.filter(id=>id.startsWith('glow-')).length,6,'Actual glow case inventory changed');assert.equal(report.initial.cases.filter(id=>id.startsWith('hero-')).length,11,'Actual hero case inventory changed');
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
  let contribution;const absent={};
  if(a.metadata.contribution){
   assert.equal(a.metadata.contribution.expected,b.metadata.contribution.expected,'Contribution expectations differ');
   for(const side of ['baseline','candidate']){
    const value=await page.evaluate(({id,side,view,target})=>window.__surfaceProgramFixture.renderWithoutContribution(id,side,view,target),{id,side,view,target});
    absent[side]=await saveCapture(name+'-'+side+'-without-contribution',value);
   }
   const baselineEffect=compare(a.bytes,absent.baseline.bytes),candidateEffect=compare(b.bytes,absent.candidate.bytes),body=compare(absent.baseline.bytes,absent.candidate.bytes);
   const expected=a.metadata.contribution.expected,minimum=id.startsWith('hero-')||id.startsWith('boat-order-')?16:1;
   const correctEffect=expected==='none'?baselineEffect.equal&&candidateEffect.equal:baselineEffect.differingPixels>=minimum&&candidateEffect.differingPixels>=minimum;
   contribution={expected,minimum,passed:correctEffect&&body.equal,baselineEffect,candidateEffect,body,withoutBaseline:absent.baseline.metadata,withoutCandidate:absent.candidate.metadata};
  }
  if(a.shadow||b.shadow){
   assert(a.shadow&&b.shadow&&absent.baseline?.shadow&&absent.candidate?.shadow,'Missing actual shadow/without-caster capture');
   assert.equal(a.shadow.metadata.width,b.shadow.metadata.width);assert.equal(a.shadow.metadata.height,b.shadow.metadata.height);
   const w=a.shadow.metadata.width,baselineEffect=compare(a.shadow.bytes,absent.baseline.shadow.bytes,w),candidateEffect=compare(b.shadow.bytes,absent.candidate.shadow.bytes,w);
   const shadowComparison={name:name+'-shadow-target',...compare(a.shadow.bytes,b.shadow.bytes,w),subjectVisible:baselineEffect.differingPixels>=16&&candidateEffect.differingPixels>=16,baselineEffect,candidateEffect,baseline:a.shadow.metadata,candidate:b.shadow.metadata,withoutBaseline:absent.baseline.shadow.metadata,withoutCandidate:absent.candidate.shadow.metadata};
   report.shadowComparisons.push(shadowComparison);
   await writeFile(join(output,'captures',name+'-shadow-comparison.json'),JSON.stringify(shadowComparison,null,2)+'\n');
  }
  const comparison={name,...compare(a.bytes,b.bytes),subjectVisible,baselineCoverage,candidateCoverage,contribution,background:background.metadata,baseline:a.metadata,candidate:b.metadata};report.comparisons.push(comparison);
  await writeFile(join(output,'captures',name+'-comparison.json'),JSON.stringify(comparison,null,2)+'\n');
  await checkpoint();
  assert(subjectVisible,'Subject must visibly contribute pixels: '+name);
  assert(!contribution||contribution.passed,'Actual family contribution/absence check failed: '+name);
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
 const familyControls=await page.evaluate(()=>window.__surfaceProgramFixture.familyControlCases());
 assert.equal(Object.keys(familyControls).filter(name=>!name.startsWith('hero-')&&!name.startsWith('glow-')&&!name.startsWith('order-')&&!name.startsWith('boat-order-')).length,7,'Keep all seven original family controls');assert.equal(Object.keys(familyControls).filter(name=>name.startsWith('glow-')).length,2,'Keep both LED controls');assert.equal(Object.keys(familyControls).filter(name=>name.startsWith('hero-')).length,5,'Expected five hero binding controls');
 assert.equal(Object.keys(familyControls).filter(name=>name.startsWith('order-')).length,2,'Expected both material-order controls');
 assert.deepEqual(Object.keys(familyControls).filter(name=>name.startsWith('boat-order-')).sort(),['boat-order-response','boat-order-ride'],'Expected both actual boat controls');
 for(const [family,id]of Object.entries(familyControls)){
  const before=await capture(id,'candidate',0,controlTarget,family+'-control-before');let changed,referenceChanged;
  const boatFamily=family.startsWith('boat-order-');
  const referenceId=family.startsWith('order-')||boatFamily?before.metadata.nativeProof.referenceCaseId:undefined;
  const referenceBefore=referenceId?await capture(referenceId,'candidate',0,controlTarget,family+'-reference-control-before'):undefined;
  try{await page.evaluate(family=>window.__surfaceProgramFixture.setFamilyNegativeControl(family,true),family);changed=await capture(id,'candidate',0,controlTarget,family+'-control-changed');if(referenceId)referenceChanged=await capture(referenceId,'candidate',0,controlTarget,family+'-reference-control-changed');}
  finally{await page.evaluate(family=>window.__surfaceProgramFixture.setFamilyNegativeControl(family,false),family);}
  const restored=await capture(id,'candidate',0,controlTarget,family+'-control-restored');
  const difference=compare(before.bytes,changed.bytes),restoration=compare(before.bytes,restored.bytes);
  let orderBinding,boatOrderBinding;
  if(referenceId){
   const referenceRestored=await capture(referenceId,'candidate',0,controlTarget,family+'-reference-control-restored');
   const referenceDifference=compare(referenceBefore.bytes,referenceChanged.bytes),referenceRestoration=compare(referenceBefore.bytes,referenceRestored.bytes);
   const validate=boatFamily?validateBoatOrderBindings:validateOrderBindings;
   const bindings=[validate(before.metadata,referenceBefore.metadata),validate(changed.metadata,referenceChanged.metadata),validate(restored.metadata,referenceRestored.metadata)];
   const binding={passed:difference.differingPixels>=16&&restoration.equal&&referenceDifference.equal&&referenceRestoration.equal&&bindings.every(row=>row.passed)&&!before.metadata.nativeProof.control&&changed.metadata.nativeProof.control&&!restored.metadata.nativeProof.control,referenceDifference,referenceRestoration,bindings,referenceBefore:referenceBefore.metadata,referenceChanged:referenceChanged.metadata,referenceRestored:referenceRestored.metadata};
   if(boatFamily)boatOrderBinding=binding;else orderBinding=binding;
  }
  let bindingSwap;
  if(family.startsWith('glow-')){
   const read=capture=>new Map(capture.metadata.familyProofs.map(proof=>[proof.materialId,proof.values.referenceGlowThickness.observed]));
   const original=read(before),mutated=read(changed),reset=read(restored),thin=Math.fround(.018),outer=Math.fround(.045);
   const rows=[...original].map(([materialId,value])=>({materialId,before:value,changed:mutated.get(materialId),restored:reset.get(materialId),expectedChanged:value===thin?outer:thin}));
   bindingSwap={passed:original.size===(family==='glow-wheel'?8:12)&&mutated.size===original.size&&reset.size===original.size&&rows.every(row=>(row.before===thin||row.before===outer)&&row.changed===row.expectedChanged&&row.restored===row.before),rows};
  }
  let heroBinding;
  if(family.startsWith('hero-')){
   const selected=capture=>capture.metadata.nativeProof.rows.filter(row=>row.generated);
   const normalBefore=selected(before),wrong=selected(changed),normalAfter=selected(restored);
   let shadowDifference,shadowRestoration;
   if(before.shadow){assert(changed.shadow&&restored.shadow,'Missing control shadow capture');shadowDifference=compare(before.shadow.bytes,changed.shadow.bytes,before.shadow.metadata.width);shadowRestoration=compare(before.shadow.bytes,restored.shadow.bytes,before.shadow.metadata.width);}
   heroBinding={passed:normalBefore.length>0&&wrong.length===normalBefore.length&&normalAfter.length===normalBefore.length&&normalBefore.every(r=>!r.normalized)&&wrong.every(r=>r.normalized)&&normalAfter.every(r=>!r.normalized)&&before.metadata.nativeProof.restoredAttribute&&!changed.metadata.nativeProof.restoredAttribute&&restored.metadata.nativeProof.restoredAttribute&&difference.differingPixels>=16&&(!shadowDifference||shadowDifference.differingPixels>=16&&shadowRestoration.equal),shadowDifference,shadowRestoration};
  }
  report.controls.push({name:'mutate-real-'+family+'-binding',passed:!difference.equal&&restoration.equal&&(!bindingSwap||bindingSwap.passed)&&(!heroBinding||heroBinding.passed)&&(!orderBinding||orderBinding.passed)&&(!boatOrderBinding||boatOrderBinding.passed),difference,restoration,bindingSwap,heroBinding,orderBinding,boatOrderBinding,before:before.metadata,changed:changed.metadata,restored:restored.metadata});
  await checkpoint();
 }
 await saveProgramEvidence();
 for(const comparison of report.comparisons.filter(row=>row.baseline.id.startsWith('hero-')))report.heroSourceIdentity.push({name:comparison.name,...compareHeroNativeSources(comparison.baseline,comparison.candidate,report.programs)});
 for(const row of Object.values(report.moduleSources))assert.equal(sha(await readFile(resolve(repo,row.path))),row.candidateSha256,'Candidate module changed during fixture');
 for(const row of Object.values(report.orderSources))assert.equal(sha(await readFile(resolve(repo,row.path))),row.candidateSha256,'Order source changed during fixture');
 for(const row of Object.values(report.boatOrderSources))assert.equal(sha(await readFile(resolve(repo,row.path))),row.candidateSha256,'Boat-order source changed during fixture');
 for(const row of boatAssets)assert.equal(sha(await readFile(resolve(repo,row.path))),row.sha256,'Actual complete boat asset changed during fixture');
 for(const row of report.orderImageAssets)assert.equal(sha(await readFile(resolve(repo,row.path))),row.sha256,'Order image changed during fixture');
 for(const row of Object.values(report.heroValidationSources))assert.equal(sha(await readFile(resolve(repo,row.path))),row.sha256,'Validation source changed during fixture');
 assert.equal(sha(await readFile(heroAssetPath)),heroAsset.sha256,'Hero asset changed during fixture');
 for(const dependency of heroDependencies)assert.equal(sha(await readFile(resolve(repo,dependency.path))),dependency.sha256,'Hero image dependency changed during fixture: '+dependency.path);
 await page.screenshot({path:join(output,'fixture-window.png')});
 assert.equal(sha(await readFile(source)),report.source.candidateSha256,'Candidate source changed duringfixture');
 for(const row of Object.values(report.moduleSources))assert.equal(sha(await readFile(resolve(repo,row.path))),row.candidateSha256,'Candidate module changed during fixture: '+row.path);
 for(const row of Object.values(report.validationSources))assert.equal(sha(await readFile(resolve(repo,row.path))),row.sha256,'Validation source changed during fixture: '+row.path);
 for(const row of glowAssets)assert.equal(sha(await readFile(resolve(repo,row.path))),row.sha256,'Vehicle asset changed during fixture: '+row.path);
 // Output tone mapping is a native Three program axis. Require4→1 separately
 // for screen and offscreen, rather than conflating their distinct shaders.
 report.cohortReduction=Object.fromEntries(Object.entries(report.final.programCounts.cohortByOutput).map(([target,counts])=>[target,{baselinePrograms:counts.baseline,candidatePrograms:counts.candidate,expectedBaseline:4,expectedCandidate:1,passed:counts.baseline.length===4&&counts.candidate.length===1}]));
 report.familyReduction=Object.fromEntries(Object.entries(report.final.programCounts.familiesByOutput).map(([target,families])=>[target,Object.fromEntries(Object.entries(families).map(([family,counts])=>[family,{...counts,expectedCandidate:1,passed:counts.baseline.length===counts.expectedBaseline&&counts.candidate.length===1}]))]));
 report.groundSourceIdentity=Object.fromEntries(Object.entries(report.familyReduction).map(([target,families])=>[target,Object.fromEntries(['lawn','pitch'].map(family=>{
  const counts=families[family],before=counts.baseline.map(id=>report.programs.find(p=>p.id===id)),after=counts.candidate.map(id=>report.programs.find(p=>p.id===id));
  assert(before.every(Boolean)&&after.every(Boolean),'Missing native ground program evidence');
  const pairs=[...new Set([...before,...after].map(p=>p.vertexSha256+':'+p.fragmentSha256))];
  return [family,{baseline:GROUND_BASE,baselinePrograms:counts.baseline,candidatePrograms:counts.candidate,stagePairs:pairs,passed:pairs.length===1}];
 }))]));
 report.orderNative=[];
 for(const target of ['screen-msaa4','target-samples0'])for(const family of ['order-station','order-wheel'])for(const view of [0,1]){
  const late=report.comparisons.find(row=>row.baseline.id===family+'-late'&&row.baseline.output===target&&row.baseline.view===view),reference=report.comparisons.find(row=>row.baseline.id===family+'-reference'&&row.baseline.output===target&&row.baseline.view===view);assert(late&&reference,'Missing exact order pair');
  const bindingChecks=['baseline','candidate'].map(side=>validateOrderBindings(late[side],reference[side]));
  const get=metadata=>metadata.nativeProof.rows[0].programId;
  const ids={baselineLate:get(late.baseline),baselineReference:get(reference.baseline),candidateLate:get(late.candidate),candidateReference:get(reference.candidate)};
  const stages=[];
  for(const stage of ['vertex','fragment']){
   const sourceFor=async id=>readFile(join(output,'programs',id+'-'+stage+'.glsl'),'utf8');
   const beforeLate=await sourceFor(ids.baselineLate),beforeReference=await sourceFor(ids.baselineReference),after=await sourceFor(ids.candidateLate);
   for(const source of [beforeLate,beforeReference,after]){assert.equal(/^#define DOUBLE_SIDED\b/m.test(source),family==='order-wheel','Native material side axis changed');assert(!/^#define (?:BELLE_ORIGINAL_SURFACE_COORDS|USE_BATCHING|USE_INSTANCING|USE_SKINNING)\b/m.test(source),'Ordinary source family acquired a batched/instanced/skinned axis');}
   const lateCheck=compareOrderStage(beforeLate,after),referenceCheck=compareOrderStage(beforeReference,after);
   assert(!lateCheck.beforeSurfaceFirst&&lateCheck.afterSurfaceFirst,'Known late declaration order was not exercised');assert(referenceCheck.beforeSurfaceFirst&&referenceCheck.afterSurfaceFirst&&referenceCheck.exactAfterUnusedName,'Earlier reference source changed beyond unused debug name');
   stages.push({stage,late:lateCheck,reference:referenceCheck});
  }
  report.orderNative.push({target,family,view,baseline:ORDER_BASE,programs:ids,bindingChecks,stages,passed:bindingChecks.every(row=>row.passed)&&stages.every(row=>row.late.passed&&row.reference.passed)});
 }
 const boatComparisons=report.comparisons.filter(row=>row.baseline.id.startsWith('boat-order-'));
 assert.deepEqual([...new Set(boatComparisons.map(row=>row.baseline.id))].sort(),[...boatOrderCaseIds].sort(),'Actual boat case inventory differs');
 const boatPrograms=await Promise.all(report.programs.map(async row=>({...row,vertexSource:await readFile(join(output,'programs',row.id+'-vertex.glsl'),'utf8'),fragmentSource:await readFile(join(output,'programs',row.id+'-fragment.glsl'),'utf8')})));
 report.boatAllMaterialSources=boatComparisons.map(row=>({name:row.name,...compareBoatAllMaterials(row.baseline,row.candidate,boatPrograms)}));
 report.boatOrderNative=[];
 for(const target of ['screen-msaa4','target-samples0'])for(const id of ['boat-order-response-late','boat-order-offshore-late','boat-order-hydroplane-late'])for(const view of [0,1]){
  const late=boatComparisons.find(row=>row.baseline.id===id&&row.baseline.output===target&&row.baseline.view===view);assert(late,'Missing actual boat comparison');
  const reference=boatComparisons.find(row=>row.baseline.id===late.baseline.nativeProof.referenceCaseId&&row.baseline.output===target&&row.baseline.view===view);assert(reference,'Missing actual boat reference');
  const bindingChecks=['baseline','candidate'].map(side=>validateBoatOrderBindings(late[side],reference[side])),get=metadata=>metadata.nativeProof.rows[0].programId;
  const ids={baselineLate:get(late.baseline),baselineReference:get(reference.baseline),candidateLate:get(late.candidate),candidateReference:get(reference.candidate)},stages=[];
  for(const stage of ['vertex','fragment']){
   const sourceFor=id=>boatPrograms.find(program=>program.id===id)?.[stage+'Source'],before=sourceFor(ids.baselineLate),earlier=sourceFor(ids.baselineReference),after=sourceFor(ids.candidateLate);assert(before&&earlier&&after,'Boat full native source missing');
   for(const source of [before,earlier,after]){assert.equal(/^#define DOUBLE_SIDED\b/m.test(source),id!=='boat-order-response-late','Boat native side changed');assert(!/^#define (?:BELLE_ORIGINAL_SURFACE_COORDS|USE_BATCHING|USE_INSTANCING|USE_SKINNING)\b/m.test(source),'Ordinary boat target acquired a different native axis');}
   const lateCheck=compareBoatOrderStage(before,after,{surfaceRequired:true}),referenceCheck=compareBoatOrderStage(earlier,after,{surfaceRequired:true});assert(!lateCheck.beforeSurfaceFirst&&lateCheck.afterSurfaceFirst,'Actual late boat order was not exercised');assert(referenceCheck.beforeSurfaceFirst&&referenceCheck.afterSurfaceFirst&&referenceCheck.exactAfterUnusedName,'Earlier boat reference source differs beyond unused debug name');stages.push({stage,late:lateCheck,reference:referenceCheck});
  }
  report.boatOrderNative.push({target,id,view,baseline:BOAT_ORDER_BASE,programs:ids,bindingChecks,stages,passed:bindingChecks.every(row=>row.passed)&&stages.every(row=>row.late.passed&&row.reference.passed)});
 }
 report.glowReduction={};
 for(const [target,families]of Object.entries(report.familyReduction)){
  const baselinePrograms=[...new Set(['glow-wheel','glow-hover'].flatMap(family=>families[family].baseline))],candidatePrograms=[...new Set(['glow-wheel','glow-hover'].flatMap(family=>families[family].candidate))];
  const fragmentHashes=[...new Set([...baselinePrograms,...candidatePrograms].map(id=>report.programs.find(program=>program.id===id)?.fragmentSha256))];
  const vertexChecks=[];
  if(candidatePrograms.length===1){
   const candidate=await readFile(join(output,'programs',candidatePrograms[0]+'-vertex.glsl'),'utf8');
   const declaration='uniform float referenceGlowThickness;\n',expression='transformed+=normal*referenceGlowThickness;';
   const exactEdits=(candidate.split(declaration).length===2&&candidate.split(expression).length===2&&(candidate.match(/\breferenceGlowThickness\b/g)??[]).length===2);
   for(const id of baselinePrograms){
    const before=await readFile(join(output,'programs',id+'-vertex.glsl'),'utf8'),literal=before.match(/transformed\+=normal\*(0\.018|0\.045);/)?.[1];
    const restored=literal?candidate.replace(declaration,'').replace(expression,'transformed+=normal*'+literal+';'):null;
    vertexChecks.push({baselineProgram:id,candidateProgram:candidatePrograms[0],literal,passed:exactEdits&&restored===before});
   }
  }
  report.glowReduction[target]={baseline:GLOW_BASE,baselinePrograms,candidatePrograms,fragmentHashes,vertexChecks,passed:baselinePrograms.length===2&&candidatePrograms.length===1&&fragmentHashes.length===1&&!!fragmentHashes[0]&&vertexChecks.length===2&&vertexChecks.every(row=>row.passed)};
 }
 report.batchLifecyclePassed=report.final.batching.length===1&&Object.values(report.final.batching[0].sides).every(b=>b.sourceDraws===4&&b.batches===2&&b.begins===b.ends&&b.begins>=4&&b.sourceGeometryUnchanged&&!b.batchRootVisible&&b.sourceVisibility.every(Boolean));
 report.heroPassed=report.heroSourceIdentity.length===44&&report.heroSourceIdentity.every(row=>row.passed)&&report.shadowComparisons.length===16&&report.shadowComparisons.every(row=>row.equal&&row.subjectVisible)&&report.comparisons.filter(row=>row.baseline.id.startsWith('hero-')).every(row=>row.baseline.heroValidation?.passed&&row.candidate.heroValidation?.passed&&row.contribution?.passed);
 report.orderPassed=report.orderNative.length===8&&report.orderNative.every(row=>row.passed)&&report.comparisons.filter(row=>row.baseline.id.startsWith('order-')).length===16&&report.comparisons.filter(row=>row.baseline.id.startsWith('order-')).every(row=>row.baseline.orderValidation?.passed&&row.candidate.orderValidation?.passed);
 const existingComparisons=report.comparisons.filter(row=>!row.baseline.id.startsWith('boat-order-')),existingControls=report.controls.filter(row=>!row.name.startsWith('mutate-real-boat-order-'));
 report.existingCohortPreserved=existingComparisons.length===212&&report.shadowComparisons.length===16&&existingControls.length===18;
 report.boatOrderPassed=boatComparisons.length===20&&report.boatAllMaterialSources.length===20&&report.boatAllMaterialSources.every(row=>row.passed)&&report.boatOrderNative.length===12&&report.boatOrderNative.every(row=>row.passed)&&boatComparisons.every(row=>row.baseline.boatOrderValidation?.passed&&row.candidate.boatOrderValidation?.passed&&(!row.contribution||row.contribution.minimum===16&&row.contribution.passed))&&report.controls.filter(row=>row.name.startsWith('mutate-real-boat-order-')).length===2;
 report.passed=report.existingCohortPreserved&&report.boatOrderPassed&&report.orderPassed&&report.heroPassed&&report.comparisons.length===232&&report.comparisons.length===report.initial.cases.length*4&&report.comparisons.every(c=>c.equal&&c.subjectVisible&&(!c.contribution||c.contribution.passed))&&report.controls.length===20&&report.controls.length===2+Object.keys(familyControls).length&&report.controls.every(c=>c.passed)&&Object.values(report.cohortReduction).every(c=>c.passed)&&Object.values(report.familyReduction).every(families=>Object.values(families).every(c=>c.passed))&&Object.values(report.groundSourceIdentity).every(families=>Object.values(families).every(c=>c.passed))&&Object.values(report.glowReduction).every(row=>row.passed)&&report.batchLifecyclePassed&&report.final.immutableGeometry&&report.programs.every(p=>p.linked)&&!report.final.errors.length&&!report.errors.length&&!report.consoleErrors.length&&!report.failedRequests.length;
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
