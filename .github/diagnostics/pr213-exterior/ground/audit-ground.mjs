/** Geometry-only measurements of pinned shipped meshes against unchanged terrain.
 * No source, model, material, renderer, controller or collider is modified. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import pins from './source-pins.json' with {type:'json'};

assert.equal(process.argv.length,5,'Usage: node audit-ground.mjs REPOSITORY DIST OUTPUT');
const [root,dist,out]=process.argv.slice(2).map(p=>resolve(p));
const game=join(root,pins.gamePath);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const blob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
for(const [path,sha] of Object.entries(pins.sourceFiles))assert.equal(blob(await readFile(join(root,path))),sha,'Changed exact source '+path);
const threePackage=JSON.parse(await readFile(join(game,'node_modules/three/package.json'),'utf8'));
assert.equal(threePackage.version,'0.185.1');
const T=await import(pathToFileURL(join(game,'node_modules/three/build/three.module.js')).href);
const {GLTFLoader}=await import(pathToFileURL(join(game,'node_modules/three/examples/jsm/loaders/GLTFLoader.js')).href);
const {MeshoptDecoder}=await import(pathToFileURL(join(game,'node_modules/three/examples/jsm/libs/meshopt_decoder.module.js')).href);
const {ParkTerrain}=await import(pathToFileURL(join(game,'src/belle/terrain.ts')).href);
const rawMap=await readFile(join(dist,'belle/map.json'));
assert.equal(blob(rawMap),pins.mapBlob);
const map=JSON.parse(rawMap),terrain=new ParkTerrain(map,true);
const manifestBytes=await readFile(join(dist,'belle/staged-architecture/manifest.json'));
assert.equal(hash(manifestBytes),pins.manifestSha256);
const manifest=JSON.parse(manifestBytes);assert.equal(manifest.productionReady,false);
const legacyBytes=await readFile(join(dist,'belle/landmarks.glb'));assert.equal(hash(legacyBytes),pins.legacySha256);
let texturePlaceholders=0;
const legacyLoader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).register(parser=>{
 parser.loadTexture=async()=>{texturePlaceholders++;return new T.Texture();};
 return{name:'geometry_audit_only_texture_placeholder'};
});
const legacy=await legacyLoader.parseAsync(Uint8Array.from(legacyBytes).buffer,'');legacy.scene.updateMatrixWorld(true);
const retained=[];legacy.scene.traverse(o=>{if(o.isMesh&&o.name==='107310050_Conservatory_concrete_paving')retained.push(o);});
assert.equal(retained.length,1,'The original retained paving must be present exactly once');
const paving=retained[0],positionHash=hash(Buffer.from(paving.geometry.attributes.position.array.buffer));
const report={version:1,sourceHead:pins.sourceHead,sourceTree:pins.sourceTree,sourceFiles:pins.sourceFiles,
 artifact:pins.artifact,threeVersion:threePackage.version,mapBlob:pins.mapBlob,
 scope:'Independent CPU rays against the exact shipped GLB geometry and unchanged terrain. Image decoding alone is replaced by empty textures so Node can read legacy geometry. These are game-coordinate measurements, not native image, avatar/tyre clipping, complete collision, real-world survey or performance acceptance.',
 legacy:{sha256:pins.legacySha256,bytes:legacyBytes.length,mesh:paving.name,position:paving.position.toArray(),quaternion:paving.quaternion.toArray(),matrixWorld:paving.matrixWorld.elements.slice(),
  positionArraySha256:positionHash,vertices:paving.geometry.attributes.position.count,indices:paving.geometry.index.count,texturePlaceholders},models:[],samples:[]};
const down=new T.Vector3(0,-1,0);
function world(cfg,u,v){return{x:cfg.center[0]+Math.cos(cfg.yaw)*u-Math.sin(cfg.yaw)*v,z:cfg.center[1]-Math.sin(cfg.yaw)*u-Math.cos(cfg.yaw)*v};}
function surfaces(object,point,floor){
 const ray=new T.Raycaster(new T.Vector3(point.x,floor+1,point.z),down,0,2);
 return ray.intersectObject(object,true).filter(h=>h.face&&h.face.normal.clone().transformDirection(h.object.matrixWorld).y>.5)
  .map(h=>({mesh:h.object.name,face:h.faceIndex,y:h.point.y,offsetFromTerrain:h.point.y-floor}));
}
function sample(model,cfg,file,lod,kind,u,v){
 const p=world(cfg,u,v),floor=terrain.height(p.x,p.z),stagedSurfaces=surfaces(model,p,floor);
 const retainedSurfaces=cfg.id==='107310050'?surfaces(paving,p,floor):[];
 // Use the highest visible surface. Choosing the closest surface to the
 // collider could incorrectly hide a second overlapping higher slab.
 const stagedTop=stagedSurfaces.length?Math.max(...stagedSurfaces.map(s=>s.y)):null;
 const retainedTop=retainedSurfaces.length?Math.max(...retainedSurfaces.map(s=>s.y)):null;
 const combinedTop=Math.max(floor,stagedTop??-Infinity,retainedTop??-Infinity);
 report.samples.push({site:cfg.id,file,lod,kind,local:{u,v},world:p,terrain:floor,
  blockedAtStandingHeight:!!terrain.obstructed(p.x,p.z,.27),stagedSurfaces,retainedSurfaces,stagedTop,retainedTop,combinedTop,
  stagedMinusTerrain:stagedTop===null?null:stagedTop-floor,
  stagedMinusRetained:stagedTop===null||retainedTop===null?null:stagedTop-retainedTop,
  combinedMinusTerrain:combinedTop-floor,
  hypotheticalThresholdOnlyLoweringCombinedTop:cfg.id==='107310050'?Math.max(floor,retainedTop??-Infinity,stagedTop===null?-Infinity:stagedTop-.08):null});
}
for(const definition of manifest.models.filter(m=>['107227742','107310050'].includes(m.placement.gameMapId))){
 const cfg=map[definition.placement.gameMapId==='107227742'?'aquarium':'conservatory'];
 assert.deepEqual(definition.placement.center_xz,cfg.center);assert.equal(definition.placement.yaw_rad,cfg.yaw);assert.equal(definition.placement.groundWorldY,2);
 for(const lod of definition.lods){
  const bytes=await readFile(join(dist,'belle/staged-architecture',lod.file));assert.equal(hash(bytes),lod.sha256);assert.equal(bytes.length,lod.bytes);
  const loaded=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'');
  const model=new T.Group();model.position.set(cfg.center[0],2,cfg.center[1]);model.rotation.y=cfg.yaw;model.add(loaded.scene);model.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(model);let meshes=0;model.traverse(o=>{if(o.isMesh)meshes++;});
  report.models.push({file:lod.file,lod:lod.lod,sha256:lod.sha256,bytes:bytes.length,meshes,worldBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}});
  if(cfg.id==='107227742'){
   const s=cfg.stairs;
   for(let i=0;i<s.count;i++)for(const u of [-1.4,-.7,.7,1.4])sample(model,cfg,lod.file,lod.lod,'outside-tread-'+i,u,s.outsideStart+(i+.5)*s.tread);
   for(const u of [-1.4,-.7,.7,1.4])for(const v of [-39.4,-38.1,-36.6])sample(model,cfg,lod.file,lod.lod,'landing',u,v);
   for(let i=0;i<s.count-1;i++)for(const u of [-1.4,-.7,.7,1.4])sample(model,cfg,lod.file,lod.lod,'inside-tread-'+i,u,s.landingEnd+(i+.5)*s.tread);
  }else{
   for(const u of [-21.2,-20,-18.8,-17.2,-16.2])for(const v of [-1.2,-.6,0,.6,1.2])sample(model,cfg,lod.file,lod.lod,'original-25-point-grid',u,v);
   for(let i=0;i<=28;i++)for(let j=0;j<=16;j++)sample(model,cfg,lod.file,lod.lod,'threshold-footprint-grid',-21.599+i*5.598/28,-1.649+j*3.298/16);
  }
 }
}
assert.equal(hash(Buffer.from(paving.geometry.attributes.position.array.buffer)),positionHash,'Retained geometry changed during measurement');
const aquarium=report.samples.filter(s=>s.site==='107227742'),conservatory=report.samples.filter(s=>s.site==='107310050');
assert.equal(aquarium.length,120);assert.equal(conservatory.length,1554);
report.summary={aquarium:{samples:aquarium.length,missingSurfaces:aquarium.filter(s=>s.stagedTop===null).length,
 maximumAbsoluteTreadAndLandingDifference:Math.max(...aquarium.map(s=>Math.abs(s.stagedMinusTerrain??Infinity)))},
 conservatory:[0,1,2].map(lod=>{const samples=conservatory.filter(s=>s.lod===lod),original=samples.filter(s=>s.kind==='original-25-point-grid');
 return{lod,samples:samples.length,retainedPavingHits:samples.filter(s=>s.retainedTop!==null).length,
 originalGridHits:original.filter(s=>s.retainedTop!==null).length,originalGridBlocked:original.filter(s=>s.blockedAtStandingHeight).length,
 stagedSurfaceHits:samples.filter(s=>s.stagedTop!==null).length,
 combinedMinusTerrainRange:[Math.min(...samples.map(s=>s.combinedMinusTerrain)),Math.max(...samples.map(s=>s.combinedMinusTerrain))],
 maximumStagedIncrement:samples.some(s=>s.stagedMinusRetained!==null)?Math.max(...samples.flatMap(s=>s.stagedMinusRetained===null?[]:[s.stagedMinusRetained])):null,
 maximumEffectOfThresholdOnlyLowering:Math.max(...samples.map(s=>Math.abs(s.combinedTop-s.hypotheticalThresholdOnlyLoweringCombinedTop)))};}),
 fullExteriorAccepted:false,completeCollisionAccepted:false,surveyedGroundAccepted:false};
await mkdir(out,{recursive:true});await writeFile(join(out,'ground-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary,null,2));
assert.equal(report.summary.aquarium.missingSurfaces,0,'Missing authored Aquarium support surface');
assert(report.summary.aquarium.maximumAbsoluteTreadAndLandingDifference<1e-5,'Authored stairs do not match existing support');
assert(report.summary.conservatory.every(row=>row.retainedPavingHits===518),'A retained Conservatory floor sample is missing');
