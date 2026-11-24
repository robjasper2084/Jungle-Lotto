import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {mkdir,open,readFile,readdir,writeFile} from 'node:fs/promises';
import {dirname,resolve,relative,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';

const BASE='e424aac64ad82f2448c11717c38c592d666c2af9';
const GROUND_BASE='8cd309d76c93593025b22f971c580b47aadcad01';
const LEAFLESS_BASE='a1c369132618cd27bec00a87ba6376a3ebac46bd';
const LEAFLESS_PRODUCT='ee25df3bd46aded3d9d37b85752076a1b982dbec';
const OUTPUTS=['screen-msaa4','target-samples0'];
const ORIGINAL_CASE_IDS=[
 'axis-planar-pigment','axis-planar-zero','axis-triplanar-pigment','axis-triplanar-zero',
 'ordered-material-switches','authored-shader-hook','maps-normal-alpha-shadow','maps-normal-zero-pigment',
 'instanced-color-material','moving-original-coordinates','skinned-cloth-motion','static-palette-projection-bindings',
 'bank-river-grass','bank-lagoon-earth','bank-formal-stone','pond-service-brick','pond-service-roof',
 'street-plain','street-curb','street-gutter','scott-shipped-granite','scott-shipped-marble',
 'river-near-original-mesh','river-far-original-mesh',
 'lawn-original','lawn-original-rediscovered','lawn-garden-soil','lawn-garden-soil-rediscovered',
 'lawn-garden-green-rediscovered','lawn-oudolf-rediscovered','pitch-ordinary-material','pitch-joined-rediscovered',
];
const ORIGINAL_FAMILY_CONTROLS={bank:'bank-river-grass',pond:'pond-service-brick',street:'street-plain',
 scott:'scott-shipped-granite',river:'river-near-original-mesh',lawn:'lawn-original',pitch:'pitch-ordinary-material'};
const LEAFLESS_CASES={
 'leafless-near-quarter':[{far:false,weight:.25}],
 'leafless-far-three-quarters':[{far:true,weight:.75}],
 'leafless-near-half':[{far:false,weight:.5}],
 'leafless-far-half':[{far:true,weight:.5}],
 'leafless-near-float32':[{far:false,weight:Math.fround(.37)}],
 'leafless-far-float32':[{far:true,weight:Math.fround(1-Math.fround(.37))}],
 'leafless-near-full':[{far:false,weight:1}],
 'leafless-far-full':[{far:true,weight:1}],
 'leafless-near-far-near':[{far:false,weight:.25},{far:true,weight:.75},{far:false,weight:.25}],
};
const LEAFLESS_IDS=Object.keys(LEAFLESS_CASES);
const LEAFLESS_CONTROLS=[{far:false,id:'leafless-near-quarter'},{far:true,id:'leafless-far-three-quarters'}];
const game=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(process.env.BELLE_SURFACE_OUTPUT??resolve(game,'surface-program-evidence'));
const source=resolve(game,'src/belle/realisticMaterials.ts');
const fixture=resolve(game,'scripts/surface-program-fixture.ts');
const virtual='\0virtual:belle-surface-baseline';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',['-C',game,...args],{encoding:'utf8',maxBuffer:16*1024*1024}).trim();
const report={version:1,baseline:BASE,groundCompositionBaseline:GROUND_BASE,leaflessBaseline:LEAFLESS_BASE,pureProduct:LEAFLESS_PRODUCT,passed:false,setupComplete:false,buildOnly:process.env.BELLE_SURFACE_BUILD_ONLY==='1',
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
 const colors=new Set();for(let i=0;i<rgba.length;i+=4)colors.add(rgba.readUInt32LE(i));
 await writeFile(join(output,'captures',name+'.rgba'),rgba);await writeFile(join(output,'captures',name+'.png'),png);
 const {rgba:_,png:__,...metadata}=capture;return {bytes:rgba,metadata:{...metadata,rgbaSha256:sha(rgba),pngSha256:sha(png),uniqueColors:colors.size}};
}
async function capture(id,side,view,target,name){
 const value=await page.evaluate(({id,side,view,target})=>window.__surfaceProgramFixture.render(id,side,view,target),{id,side,view,target});
 return saveCapture(name,value);
}
function verifyLeaflessCapture(metadata,{id,side,view,target,subjectPresent=true,controlledFar}){
 assert.deepEqual([metadata.id,metadata.side,metadata.view,metadata.output,metadata.subjectPresent],[id,side,view,target,subjectPresent],'Leafless capture identity changed');
 assert.deepEqual([metadata.width,metadata.height,metadata.samples],[320,240,target==='screen-msaa4'?4:0],'Leafless output dimensions/samples changed');
 const expected=subjectPresent?LEAFLESS_CASES[id]:[],proof=metadata.leaflessProof;
 assert(expected&&proof&&Array.isArray(proof.color)&&Array.isArray(proof.shadow),'Missing actual leafless draw proof');
 if(!subjectPresent){
  const frozen=metadata.frozenBaselineShadow;assert(frozen,'Hidden leafless reference must retain its native shadow-freeze receipt');
  assert.deepEqual([side,frozen.side,frozen.subjectPresent,frozen.autoUpdate,frozen.needsUpdate,frozen.retainedMap],['baseline','baseline',false,false,false,true]);
  assert(Number.isInteger(frozen.textureId)&&frozen.textureId>=0,'Frozen baseline shadow texture identity missing');
 }
 assert.equal(proof.color.length,expected.length,'Every requested trunk must submit one color draw');
 const integer=value=>Number.isInteger(value)&&value>=0;
 for(const [slot,row]of proof.color.entries()){
  const {far,weight}=expected[slot],controlActive=controlledFar===far;
  assert.deepEqual([row.case,row.side,row.slot,row.far,row.constructorFar],[id,side,slot,far,far],'Independent constructor/observed draw order mismatch');
  assert.deepEqual([row.controlActive,row.expectedSelector],[controlActive,controlActive?!far:far],'Selector truth must derive from the constructor plus explicit control');
  assert([row.objectId,row.materialId,row.programId].every(integer)&&Number.isInteger(row.uniformTableId)&&row.uniformTableId>0,'Missing observed native program/material/table identity');
  assert.equal(row.calls,1);assert(Number.isFinite(row.triangles)&&row.triangles>0,'Nonempty native instanced trunk draw required');
  assert.deepEqual([row.count,row.weight,row.castShadow,row.receiveShadow],[1,weight,!far,true],'Authored count/weight/shadow contract changed');
  for(const name of ['skinProfile','skinPlanar','belleCloudTime','belleCloudCoverage','belleCloudStrength','belleSunDirection',...(side==='candidate'?['treeFarLod']:[])]){
   const value=row.values?.[name];assert(value&&Object.hasOwn(value,'expected')&&Object.hasOwn(value,'observed'),'Missing native uniform readback '+name);
   assert.deepEqual(value.observed,value.expected,'Native uniform binding differs from material table '+name);
  }
  if(side==='candidate')assert.deepEqual(row.values.treeFarLod,{expected:controlActive?!far:far,observed:controlActive?!far:far},'Native selector must match independent constructor truth');
  else assert(!Object.hasOwn(row.values,'treeFarLod'),'Baseline must use the original compiled predicate');
 }
 const expectedShadows=expected.flatMap((row,slot)=>row.far?[]:[slot]);
 assert.equal(proof.shadow.length,expectedShadows.length,'Exact original near-only shadow draws required');
 for(const [index,row]of proof.shadow.entries()){
  const slot=expectedShadows[index];assert.deepEqual([row.case,row.side,row.slot,row.far,row.objectId],[id,side,slot,false,proof.color[slot].objectId]);
  assert.equal(row.calls,1);assert(Number.isFinite(row.triangles)&&row.triangles>0,'Nonempty native near shadow draw required');
  assert(row.defaultDepth===true&&row.defaultDistance===true,'Trunks must retain the original default shadow-material path');
 }
 if(expected.length===3){
  const [near,far,nearAgain]=proof.color;
  assert.equal(near.materialId,nearAgain.materialId);assert.equal(near.uniformTableId,nearAgain.uniformTableId);assert.equal(near.programId,nearAgain.programId);
  assert.notEqual(near.materialId,far.materialId);assert.notEqual(near.uniformTableId,far.uniformTableId);
  assert.equal(new Set(proof.color.map(row=>row.programId)).size,side==='candidate'?1:2,'Actual near/far/near program sharing is incorrect');
 }
 return {passed:true,colorDraws:proof.color.length,shadowDraws:proof.shadow.length,constructorTruth:true,materialTableOrder:true};
}
function verifyLeaflessInputs(inputs){
 assert(Array.isArray(inputs));assert.equal(inputs.length,22,'Retain both sides of all11 actual trunk instances');
 const keys=inputs.map(row=>[row.case,row.side,row.slot].join('/'));assert.equal(new Set(keys).size,22,'Duplicate/missing trunk inputs');
 for(const [id,expected]of Object.entries(LEAFLESS_CASES))for(const [slot,{far,weight}]of expected.entries()){
  const pair=['baseline','candidate'].map(side=>inputs.find(row=>row.case===id&&row.side===side&&row.slot===slot));assert(pair.every(Boolean));
  for(const row of pair){
   assert.equal(row.constructorFar,far);assert.equal(row.species,'maple');assert.equal(row.height,12);
   assert.deepEqual([row.instanceCount,row.castShadow,row.receiveShadow,row.frustumCulled,row.defaultDepth,row.defaultDistance],[1,!far,true,false,true,true]);
   assert.equal(row.transparent,false);assert.equal(row.alphaTest,0);assert.equal(row.alphaToCoverage,false);
   assert(row.geometry?.attributes?.lodWeight&&row.geometry?.attributes?.position&&row.sourceGeometry?.attributes?.position,'Actual trunk geometry and instance weights required');
   const weights=row.geometry.attributes.lodWeight,bytes=Buffer.from(weights.base64,'base64');
   assert.deepEqual([weights.type,weights.bytes,weights.count,weights.itemSize,weights.meshPerAttribute,bytes.length],['Float32Array',4,1,1,1,4]);
   assert.equal(bytes.readFloatLE(0),weight,'Retained instance weight must match the independently specified Float32 input');
  }
  const [{side:beforeSide,...before},{side:afterSide,...after}]=pair;assert.deepEqual(before,after,'Baseline/candidate authored geometry, material flags or instances differ');
 }
 return {passed:true,instances:inputs.length,baselineInstances:11,candidateInstances:11,constructorTruth:true,geometryAndInstancesEqual:true};
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
async function verifyLeaflessPrograms(){
 const proof={},hashExpression='float lodSeed=fract(52.9829189*fract(dot(lodCell,vec3(.06711056,.00583715,.02383154))));';
 const nearPredicate='if(lodSeed>=treeWeight)discard;',farPredicate='if(lodSeed<1.0-treeWeight)discard;';
 for(const target of OUTPUTS){
  const counts=report.final.leaflessPrograms?.[target];assert(counts,'Missing actual leafless output/program census');
  const rows=report.comparisons.filter(row=>LEAFLESS_IDS.includes(row.baseline.id)&&row.baseline.output===target);
  assert.equal(rows.length,18,'Both views of each added case must contribute native proof');
  const sidePrograms=Object.fromEntries(['baseline','candidate'].map(side=>[side,[...new Set(rows.flatMap(row=>row[side].leaflessProof.color.map(draw=>draw.programId)))].sort((a,b)=>a-b)]));
  assert.deepEqual(counts,sidePrograms,'Leafless program receipt must match actual normal draw observations');
  assert.equal(counts.baseline.length,2);assert.equal(counts.candidate.length,1);
  const stages=[];
  for(const side of ['baseline','candidate'])for(const id of counts[side]){
   const program=report.programs.find(program=>program.id===id);assert(program?.linked,'Missing linked native trunk shader');
   const fragment=await readFile(join(output,'programs',id+'-fragment.glsl'),'utf8');
   assert(fragment.includes(hashExpression)&&fragment.includes('vec3 lodCell=floor(localTreePos*6.0);'),'Original object-space hash arithmetic changed');
   assert(fragment.includes('if(treeWeight<=0.0)discard;')&&fragment.includes('if(treeWeight<1.0){'),'Original LOD endpoint guards changed');
   const actual=rows.flatMap(row=>row[side].leaflessProof.color).filter(draw=>draw.programId===id),fars=[...new Set(actual.map(draw=>draw.constructorFar))].sort();
   if(side==='candidate'){
    assert.deepEqual(fars,[false,true]);assert(/uniform\s+bool\s+treeFarLod\s*;/.test(fragment));
    assert(fragment.includes('if(treeFarLod){')&&fragment.includes(nearPredicate)&&fragment.includes(farPredicate),'Candidate must retain both original branch expressions');
   }else{
    assert.equal(fars.length,1);assert(!/uniform\s+bool\s+treeFarLod\s*;/.test(fragment),'Original baseline must remain compile-selected');
    assert(fragment.includes(fars[0]?farPredicate:nearPredicate));assert(!fragment.includes(fars[0]?nearPredicate:farPredicate));
   }
   stages.push({side,programId:id,constructorFarValues:fars,vertexSha256:program.vertexSha256,fragmentSha256:program.fragmentSha256,originalHashAndPredicates:true});
  }
  proof[target]={baseline:LEAFLESS_BASE,baselinePrograms:counts.baseline,candidatePrograms:counts.candidate,expectedBaseline:2,expectedCandidate:1,stages,passed:true};
 }
 return proof;
}
async function main(){
 await mkdir(join(output,'captures'),{recursive:true});await mkdir(join(output,'programs'),{recursive:true});
 const repo=git('rev-parse','--show-toplevel');const relativeSource=relative(repo,source).split(sep).join('/');
 const baselineSource=execFileSync('git',['-C',repo,'show',BASE+':'+relativeSource],{maxBuffer:16*1024*1024});
 const candidateSource=await readFile(source);report.source={head:git('rev-parse','HEAD'),baseline:BASE,path:relativeSource,baselineSha256:sha(baselineSource),candidateSha256:sha(candidateSource),fixtureSha256:sha(await readFile(fixture)),driverSha256:sha(await readFile(fileURLToPath(import.meta.url)))};
 report.source.pureProduct=LEAFLESS_PRODUCT;report.source.pureProductTree=git('rev-parse',LEAFLESS_PRODUCT+'^{tree}');
 assert.equal(git('show','-s','--format=%P',LEAFLESS_PRODUCT),LEAFLESS_BASE,'Reviewed leafless product must directly extend a1');
 if(report.source.head!==LEAFLESS_PRODUCT)assert.equal(git('show','-s','--format=%P','HEAD'),LEAFLESS_PRODUCT,'Validation experiment must directly extend the reviewed pure leafless product');
 else assert(report.buildOnly,'Native collection must run from a committed validation experiment, not the pure product');
 await writeFile(join(output,'baseline-realisticMaterials.ts'),baselineSource);await writeFile(join(output,'candidate-realisticMaterials.ts'),candidateSource);
 const moduleFiles={surface:'realisticMaterials.ts',bank:'surfaceFinish.ts',pond:'pondServiceBuildings.ts',street:'streetDetails.ts',scott:'fountainDetail.ts',water:'water.ts',atmosphere:'worldAtmosphere.ts',terrain:'cinematicTerrain.ts',sunset:'sunsetGround.ts',world:'world.ts',oudolf:'oudolfScene.ts',sky:'islandSky.ts',seasonal:'seasonalMaterial.ts'};
 const modules=new Map();report.moduleSources={};
 for(const [name,file]of Object.entries(moduleFiles)){
  const path=resolve(game,'src/belle',file),repoPath=relative(repo,path).split(sep).join('/');
  const ref=name==='seasonal'?LEAFLESS_BASE:['atmosphere','terrain','sunset','world','oudolf','sky'].includes(name)?GROUND_BASE:BASE;
  const before=execFileSync('git',['-C',repo,'show',ref+':'+repoPath]),after=await readFile(path);
  modules.set('\0virtual:belle-'+name+'-baseline',{path,code:before.toString('utf8')});
  report.moduleSources[name]={path:repoPath,baseline:ref,baselineSha256:sha(before),candidateSha256:sha(after)};
  await writeFile(join(output,'baseline-'+file),before);await writeFile(join(output,'candidate-'+file),after);
 }
 // The added trunk cases use the same actual a1 tree, dressing and atmosphere
 // modules on both sides. Only seasonalMaterial is virtualized to its a1 bytes.
 // Pin the complete local support closure instead of calling the current
 // candidate modules an older baseline after unrelated changes.
 const leaflessSupport=['referenceTrees.ts','treeGrounding.ts','seasonModel.ts','worldAtmosphere.ts','atmosphereShaders.ts',
  'physicalLighting.ts','presentationPolicy.ts','referenceLeafDisplay.ts','sharedGeometryBuffers.ts','atmosphereProgramIdentity.ts',
  'realisticMaterials.ts','startupWork.ts','surfaceRetry.ts','realisticMaterialRules.ts'];
 await mkdir(join(output,'leafless-support'),{recursive:true});report.leaflessSources={baseline:LEAFLESS_BASE,product:LEAFLESS_PRODUCT,support:[],helperSha256:sha(await readFile(join(game,'scripts/leafless-program-fixtures.ts')))};
 const committedSeasonal=execFileSync('git',['-C',repo,'show',LEAFLESS_PRODUCT+':'+report.moduleSources.seasonal.path]);
 assert.equal(sha(committedSeasonal),report.moduleSources.seasonal.candidateSha256,'Candidate seasonal bytes must match the reviewed pure product');
 report.leaflessSources.seasonal={...report.moduleSources.seasonal,product:LEAFLESS_PRODUCT,productSha256:sha(committedSeasonal)};
 for(const file of leaflessSupport){
  const path=resolve(game,'src/belle',file),repoPath=relative(repo,path).split(sep).join('/');
  const before=execFileSync('git',['-C',repo,'show',LEAFLESS_BASE+':'+repoPath]),after=await readFile(path);
  const row={path:repoPath,baseline:LEAFLESS_BASE,baselineSha256:sha(before),candidateSha256:sha(after),equal:sha(before)===sha(after)};
  report.leaflessSources.support.push(row);await writeFile(join(output,'leafless-support',file),after);await checkpoint();
  assert(row.equal,'Leafless supporting source differs from its stated a1 baseline: '+file);
 }
 report.leaflessSources.supportUnchanged=true;
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
 const buildDir=join(output,'bundle');
 await build({configFile:false,root:game,publicDir:false,logLevel:'warn',plugins:[{
  name:'exact-baseline-surface-module',
  async resolveId(id,importer){
   if(modules.has('\0'+id)||id==='virtual:belle-scott-materials')return '\0'+id;
   if(modules.has(importer)&&id.startsWith('.'))return this.resolve(resolve(dirname(modules.get(importer).path),id),undefined,{skipSelf:true});
  },
  load(id){if(modules.has(id))return {code:modules.get(id).code,map:null};if(id==='\0virtual:belle-scott-materials')return 'export default '+JSON.stringify(materialRecords)+';';},
  transform(code,id){if(modules.has(id))return import('typescript').then(({default:ts})=>({code:ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText,map:null}));}
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
 assert.deepEqual(report.initial.originalCaseIds,ORIGINAL_CASE_IDS,'All original32 cases must retain their identity and order');
 assert.deepEqual(report.initial.leafless?.caseIds,LEAFLESS_IDS,'All nine additional trunk cases must retain their identity and order');
 assert.deepEqual(report.initial.cases,[...ORIGINAL_CASE_IDS,...LEAFLESS_IDS],'Exact41-case inventory required');
 const leaflessInputsBefore=await page.evaluate(()=>window.__surfaceProgramFixture.leaflessInputs());
 const leaflessInputBytes=JSON.stringify(leaflessInputsBefore,null,2)+'\n';await writeFile(join(output,'leafless-inputs-before.json'),leaflessInputBytes);
 report.leaflessInputs={before:{path:'leafless-inputs-before.json',sha256:sha(leaflessInputBytes)},...verifyLeaflessInputs(leaflessInputsBefore)};await checkpoint();
 for(const id of report.initial.cases)for(const view of [0,1])for(const target of OUTPUTS){
  const name=[id,'view'+view,target].join('-');
  const a=await capture(id,'baseline',view,target,name+'-baseline');
  const b=await capture(id,'candidate',view,target,name+'-candidate');
  // A genuine dark zero-pigment surface may use fewer than 20 encoded colors.
  // Prove the subject contributes pixels by rendering the same scene with only
  // that subject hidden, instead of treating low color diversity as a blank.
  // Retain every raw capture before any assertion, including failed evidence.
  const isLeafless=LEAFLESS_IDS.includes(id);let background,seed,seedComparison;
  if(isLeafless){
   // Re-render the exact baseline first, then hide only its color subject while
   // retaining that render's shadow map. Differences cannot be shadow-only.
   const reference=await page.evaluate(({id,view,target})=>window.__surfaceProgramFixture.renderLeaflessSurfaceReference(id,'baseline',view,target),{id,view,target});
   seed=await saveCapture(name+'-surface-reference-seed',reference.seed);
   background=await saveCapture(name+'-without-subject-frozen-shadow',reference.background);seedComparison=compare(a.bytes,seed.bytes);
  }else{
   const backgroundValue=await page.evaluate(({id,view,target})=>window.__surfaceProgramFixture.renderWithoutSubject(id,'baseline',view,target),{id,view,target});
   background=await saveCapture(name+'-without-subject',backgroundValue);
  }
  const baselineCoverage=compare(a.bytes,background.bytes),candidateCoverage=compare(b.bytes,background.bytes);
  const subjectVisible=baselineCoverage.differingPixels>=16&&candidateCoverage.differingPixels>=16;
  const comparison={name,...compare(a.bytes,b.bytes),subjectVisible,baselineCoverage,candidateCoverage,background:background.metadata,baseline:a.metadata,candidate:b.metadata,
   ...(isLeafless?{leaflessSurfaceReference:{seed:seed.metadata,seedComparison,frozenShadowReference:true}}:{})};report.comparisons.push(comparison);
  await writeFile(join(output,'captures',name+'-comparison.json'),JSON.stringify(comparison,null,2)+'\n');
  await checkpoint();
  if(isLeafless){
   const options={id,view,target};
   comparison.leaflessValidation={baseline:verifyLeaflessCapture(a.metadata,{...options,side:'baseline'}),candidate:verifyLeaflessCapture(b.metadata,{...options,side:'candidate'}),
    seed:verifyLeaflessCapture(seed.metadata,{...options,side:'baseline'}),background:verifyLeaflessCapture(background.metadata,{...options,side:'baseline',subjectPresent:false})};
   assert(seedComparison.equal,'Frozen-shadow seed must exactly reproduce the normal baseline '+name);
   await writeFile(join(output,'captures',name+'-comparison.json'),JSON.stringify(comparison,null,2)+'\n');await checkpoint();
  }
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
 const familyControls=await page.evaluate(()=>window.__surfaceProgramFixture.familyControlCases());
 assert.deepEqual(familyControls,ORIGINAL_FAMILY_CONTROLS,'All seven original authored-family controls must remain');
 for(const [family,id]of Object.entries(familyControls)){
  const before=await capture(id,'candidate',0,controlTarget,family+'-control-before');let changed;
  try{await page.evaluate(family=>window.__surfaceProgramFixture.setFamilyNegativeControl(family,true),family);changed=await capture(id,'candidate',0,controlTarget,family+'-control-changed');}
  finally{await page.evaluate(family=>window.__surfaceProgramFixture.setFamilyNegativeControl(family,false),family);}
  const restored=await capture(id,'candidate',0,controlTarget,family+'-control-restored');
  const difference=compare(before.bytes,changed.bytes),restoration=compare(before.bytes,restored.bytes);
  report.controls.push({name:'mutate-real-'+family+'-binding',passed:!difference.equal&&restoration.equal,difference,restoration,before:before.metadata,changed:changed.metadata,restored:restored.metadata});
  await checkpoint();
 }
 assert.equal(report.controls.length,9,'Retain the original nine controls before adding selector controls');
 const leaflessControls=await page.evaluate(()=>window.__surfaceProgramFixture.leaflessControlCases());
 assert.deepEqual(leaflessControls,LEAFLESS_CONTROLS,'Require both independent constructor-far controls');
 for(const {far,id}of leaflessControls){
  const prefix='leafless-'+(far?'far':'near')+'-control',before=await capture(id,'candidate',0,controlTarget,prefix+'-before');let changed;
  try{await page.evaluate(far=>window.__surfaceProgramFixture.setLeaflessControl(far,true),far);changed=await capture(id,'candidate',0,controlTarget,prefix+'-changed');}
  finally{await page.evaluate(far=>window.__surfaceProgramFixture.setLeaflessControl(far,false),far);}
  const restored=await capture(id,'candidate',0,controlTarget,prefix+'-restored');
  const difference=compare(before.bytes,changed.bytes),restoration=compare(before.bytes,restored.bytes);
  const row={name:'mutate-real-leafless-'+(far?'far':'near')+'-selector',constructorFar:far,passed:false,difference,restoration,before:before.metadata,changed:changed.metadata,restored:restored.metadata};
  report.controls.push(row);await checkpoint();
  const options={id,side:'candidate',view:0,target:controlTarget};
  row.bindingProof={before:verifyLeaflessCapture(before.metadata,options),changed:verifyLeaflessCapture(changed.metadata,{...options,controlledFar:far}),restored:verifyLeaflessCapture(restored.metadata,options)};
  row.passed=!difference.equal&&restoration.equal;await checkpoint();
 }
 const leaflessInputsAfter=await page.evaluate(()=>window.__surfaceProgramFixture.leaflessInputs()),leaflessAfterBytes=JSON.stringify(leaflessInputsAfter,null,2)+'\n';
 await writeFile(join(output,'leafless-inputs-after.json'),leaflessAfterBytes);
 report.leaflessInputs.after={path:'leafless-inputs-after.json',sha256:sha(leaflessAfterBytes)};
 report.leaflessInputs.unchanged=leaflessInputBytes===leaflessAfterBytes;await checkpoint();
 assert(report.leaflessInputs.unchanged,'Leafless source geometry/instances/material flags changed during validation');verifyLeaflessInputs(leaflessInputsAfter);
 await saveProgramEvidence();
 report.leaflessReduction=await verifyLeaflessPrograms();
 await page.screenshot({path:join(output,'fixture-window.png')});
 assert.equal(sha(await readFile(source)),report.source.candidateSha256,'Candidate source changed duringfixture');
 assert.equal(sha(await readFile(join(game,'src/belle/seasonalMaterial.ts'))),report.moduleSources.seasonal.candidateSha256,'Candidate seasonal source changed during fixture');
 assert.equal(sha(await readFile(join(game,'scripts/leafless-program-fixtures.ts'))),report.leaflessSources.helperSha256,'Leafless fixture helper changed during validation');
 for(const row of report.leaflessSources.support)assert.equal(sha(await readFile(resolve(repo,row.path))),row.candidateSha256,'Leafless support changed during validation: '+row.path);
 report.leaflessSources.unchangedAfter=true;
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
 report.batchLifecyclePassed=report.final.batching.length===1&&Object.values(report.final.batching[0].sides).every(b=>b.sourceDraws===4&&b.batches===2&&b.begins===b.ends&&b.begins>=4&&b.sourceGeometryUnchanged&&!b.batchRootVisible&&b.sourceVisibility.every(Boolean));
 report.retainedOriginal={caseIds:ORIGINAL_CASE_IDS,expectedComparisons:128,comparisons:report.comparisons.filter(c=>ORIGINAL_CASE_IDS.includes(c.baseline.id)).length,
  expectedControls:9,controls:report.controls.slice(0,9).map(c=>c.name),passed:report.comparisons.filter(c=>ORIGINAL_CASE_IDS.includes(c.baseline.id)).length===128&&report.comparisons.filter(c=>ORIGINAL_CASE_IDS.includes(c.baseline.id)).every(c=>c.equal&&c.subjectVisible)&&report.controls.slice(0,9).every(c=>c.passed)};
 report.leaflessAcceptance={caseIds:LEAFLESS_IDS,expectedComparisons:36,comparisons:report.comparisons.filter(c=>LEAFLESS_IDS.includes(c.baseline.id)).length,
  expectedControls:2,controls:report.controls.slice(9).map(c=>c.name),inputsUnchanged:report.leaflessInputs.unchanged,
  scope:'Actual reference maple trunk color and unchanged near-only default shadows, two views and outputs, constructor-owned native selector and same-material near/far/near order. Weight-zero endpoint is covered only by the product CPU regression; no Metal pipeline or performance claim.',
  passed:report.comparisons.filter(c=>LEAFLESS_IDS.includes(c.baseline.id)).length===36&&report.comparisons.filter(c=>LEAFLESS_IDS.includes(c.baseline.id)).every(c=>c.equal&&c.subjectVisible&&c.leaflessValidation&&c.leaflessSurfaceReference.seedComparison.equal)&&report.controls.slice(9).length===2&&report.controls.slice(9).every(c=>c.passed)&&report.final.leafless?.inputsUnchanged===true&&report.final.leafless?.controlsActive===0};
 report.passed=report.comparisons.length===164&&report.comparisons.every(c=>c.equal&&c.subjectVisible)&&report.controls.length===11&&report.controls.every(c=>c.passed)&&report.retainedOriginal.passed&&report.leaflessAcceptance.passed&&Object.values(report.leaflessReduction).every(c=>c.passed)&&Object.values(report.cohortReduction).every(c=>c.passed)&&Object.values(report.familyReduction).every(families=>Object.values(families).every(c=>c.passed))&&Object.values(report.groundSourceIdentity).every(families=>Object.values(families).every(c=>c.passed))&&report.batchLifecyclePassed&&report.final.immutableGeometry&&report.programs.every(p=>p.linked)&&!report.final.errors.length&&!report.errors.length&&!report.consoleErrors.length&&!report.failedRequests.length;
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
