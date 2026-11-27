import {before,after,test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {addGeology} from './geology.ts';
import {ParkTerrain,type ParkMap,type BoulderCollision} from './terrain.ts';
import {fitRockReviewGeometry,type RockReviewPrototype} from './polyhavenRockReview.ts';
import {applyRealisticMaterials,loadRealisticMaterials} from './realisticMaterials.ts';
import {WorldAtmosphere} from './worldAtmosphere.ts';
import {CinematicTerrain} from './cinematicTerrain.ts';
import {hasAtmosphereProgram} from './atmosphereProgramIdentity.ts';

const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
const surfaceTextures:T.Texture[]=[];
type Shader=Parameters<T.Material['onBeforeCompile']>[0];
type Restore={compile:T.Material['onBeforeCompile'];key:T.Material['customProgramCacheKey']};
type Pool=T.InstancedMesh<T.BufferGeometry,T.MeshStandardMaterial>;

before(async()=>{
 const original=T.TextureLoader.prototype.loadAsync;
 T.TextureLoader.prototype.loadAsync=async(url:string)=>{
  const texture=new T.Texture({width:1,height:1} as HTMLImageElement);texture.name=url;surfaceTextures.push(texture);return texture;
 };
 try{await loadRealisticMaterials({capabilities:{getMaxAnisotropy:()=>8},initTexture(){}} as unknown as T.WebGLRenderer);}
 finally{T.TextureLoader.prototype.loadAsync=original;}
});
after(()=>surfaceTextures.forEach(texture=>texture.dispose()));

function prototypes():RockReviewPrototype[]{
 return Array.from({length:3},(_,shape)=>{
  const original=new T.BoxGeometry(1+shape*.2,1.5+shape*.1,.8);
  const geometry=fitRockReviewGeometry(original);original.dispose();
  const material=new T.MeshStandardMaterial({name:'Imported PBR rock '+shape,color:0xaba69c,roughness:.79,metalness:.02,
   map:new T.Texture(),normalMap:new T.Texture(),roughnessMap:new T.Texture(),aoMap:new T.Texture()});
  material.normalScale.set(.8,.9);material.userData.authoredRock=shape;
  // A nonstandard authored hook must survive composition and disposal too.
  if(shape===1){material.onBeforeCompile=shader=>{shader.fragmentShader='// retained imported finish\n'+shader.fragmentShader;};material.customProgramCacheKey=()=> 'authored-imported-rock';}
  return {geometry,material};
 });
}

async function fixture(t:TestContext,review?:RockReviewPrototype[],ownReview=true){
 const scene=new T.Scene(),noise=new T.Texture(),lawn=new CinematicTerrain(scene),atmosphere=new WorldAtmosphere(scene,noise),terrain=new ParkTerrain(map);
 const registrations:BoulderCollision[][]=[],register=terrain.registerBoulders.bind(terrain),prepared:{material:T.MeshStandardMaterial;restore:Restore}[]=[];
 terrain.registerBoulders=items=>{registrations.push(items.map(item=>({...item})));register(items);};
 const restore=review?.map(({material})=>({compile:material.onBeforeCompile,key:material.customProgramCacheKey}));
 const geology=addGeology(scene,map,terrain,review,(material,original)=>{prepared.push({material,restore:original});atmosphere.prepareMaterial(material,original);});
 const pools=scene.children as Pool[],originalMaterials=pools.map(pool=>pool.material),geometries=new Set(pools.map(pool=>pool.geometry));
 const ownedMaterials=new Set(originalMaterials);
 t.after(()=>{
  atmosphere.dispose();lawn.dispose();noise.dispose();
  for(const material of ownedMaterials)material.dispose();for(const geometry of geometries)geometry.dispose();
  if(ownReview)for(const item of review??[]){item.geometry.dispose();item.material.dispose();for(const texture of new Set([item.material.map,item.material.normalMap,item.material.roughnessMap,item.material.aoMap]))texture?.dispose();}
 });
 // createWorld awaits later asset work before its normal surface dressing and
 // before main.ts first applies the public quality setting.
 await Promise.resolve();
 for(const material of applyRealisticMaterials(scene))ownedMaterials.add(material);
 const dressed=pools.map(pool=>pool.material);
 await Promise.resolve();
 return {scene,terrain,atmosphere,geology,pools,originalMaterials,dressed,prepared,restore,registrations,ownedMaterials};
}

function compile(material:T.MeshStandardMaterial):Shader{
 const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}} as Shader;
 material.onBeforeCompile(shader,{} as T.WebGLRenderer);return shader;
}

function geometryBytes(geometry:T.BufferGeometry){
 const attributes=Object.fromEntries(Object.entries(geometry.attributes).map(([name,attribute])=>{
  assert(attribute instanceof T.BufferAttribute);
  return [name,{itemSize:attribute.itemSize,normalized:attribute.normalized,array:Array.from(attribute.array)}];
 }));
 return {attributes,index:geometry.index?Array.from(geometry.index.array):null,groups:geometry.groups.map(group=>({...group})),drawRange:{...geometry.drawRange}};
}

function materialInputs(material:T.MeshStandardMaterial){
 return {map:material.map,normalMap:material.normalMap,roughnessMap:material.roughnessMap,aoMap:material.aoMap,
  color:material.color.toArray(),normalScale:material.normalScale.toArray(),roughness:material.roughness,metalness:material.metalness,
  opacity:material.opacity,transparent:material.transparent,side:material.side,depthTest:material.depthTest,depthWrite:material.depthWrite,
  alphaTest:material.alphaTest,envMapIntensity:material.envMapIntensity,userData:{...material.userData}};
}

test('detached imported rocks receive the existing atmosphere hook before a later High material swap',async t=>{
 const review=prototypes(),inputs=review.map(item=>materialInputs(item.material)),bytes=review.map(item=>geometryBytes(item.geometry));
 const f=await fixture(t,review);assert.equal(f.prepared.length,3,'Each detached imported prototype needs explicit preparation');
 f.geology.setQuality('high');f.atmosphere.update(7,new T.Vector3(0,1,0),.7,1,.2,'high',false,false);await Promise.resolve();
 for(let i=0;i<review.length;i++){
  const {material,geometry}=review[i],shader=compile(material);
  assert.equal(f.prepared[i].material,material);assert.deepEqual(f.prepared[i].restore,f.restore![i]);
  assert(hasAtmosphereProgram(material.onBeforeCompile,f.atmosphere));
  assert.equal((shader.vertexShader.match(/varying vec3 belleAtmosphereWorld;/g)||[]).length,1);
  assert(shader.fragmentShader.includes('belleViewDFG'),'Existing physical-lighting preparation must be present');
  if(i===1)assert(shader.fragmentShader.includes('// retained imported finish'));
  assert.equal(shader.uniforms.belleCloudTime,f.atmosphere.uniforms.belleCloudTime);
  assert.equal(shader.uniforms.belleSunDirection,f.atmosphere.uniforms.belleSunDirection);
  for(const key of ['map','normalMap','roughnessMap','aoMap'] as const)assert.equal(material[key],inputs[i][key]);
  assert.deepEqual(materialInputs(material),inputs[i]);assert.deepEqual(geometryBytes(geometry),bytes[i]);
 }
 const hooks=review.map(({material})=>({compile:material.onBeforeCompile,key:material.customProgramCacheKey,version:material.version}));
 for(const quality of ['smooth','automatic','high','high','smooth','high']){
  f.geology.setQuality(quality);await Promise.resolve();
  f.atmosphere.update(11,new T.Vector3(1,1,0),.2,.8,0,quality,false,false);
 }
 assert.equal(f.prepared.length,3,'Quality changes must not add shader wrappers');
 review.forEach(({material},i)=>{
  f.atmosphere.prepareMaterial(material,f.restore![i]);
  assert.equal(material.onBeforeCompile,hooks[i].compile);assert.equal(material.customProgramCacheKey,hooks[i].key);assert.equal(material.version,hooks[i].version);
  assert.deepEqual(materialInputs(material),inputs[i]);
 });
 f.atmosphere.dispose();f.atmosphere.dispose();
 review.forEach(({material},i)=>{assert.equal(material.onBeforeCompile,f.restore![i].compile);assert.equal(material.customProgramCacheKey,f.restore![i].key);});
});

test('High far pools and every Smooth or Automatic pool retain the actual prepared fallback material',async t=>{
 const review=prototypes(),f=await fixture(t,review);
 assert(f.dressed.every((material,i)=>material!==f.originalMaterials[i]&&material.userData.realisticSurface),'The normal world dresser must actually replace the original material');
 const kinds=f.dressed.map(material=>material.userData.realisticSurface),hooks=f.dressed.map(material=>material.onBeforeCompile);
 for(const quality of ['high','smooth','automatic','high','automatic','smooth','high']){
  f.geology.setQuality(quality);
  f.pools.forEach((pool,i)=>{
   const shape=Math.floor(i/2),imported=quality==='high'&&pool.name.endsWith(' near');
   assert.equal(pool.material,imported?review[shape].material:f.dressed[i],quality+' '+pool.name);
   if(!imported){assert.equal(pool.material.onBeforeCompile,hooks[i]);assert.equal(pool.material.userData.realisticSurface,kinds[i]);}
  });
 }
 // A later dressing of a fallback must be retained, while an installed imported
 // material must never become the saved fallback on repeated High requests.
 f.geology.setQuality('smooth');const pool=f.pools[0],latest=pool.material.clone();
 latest.onBeforeCompile=pool.material.onBeforeCompile;latest.customProgramCacheKey=pool.material.customProgramCacheKey;f.ownedMaterials.add(latest);pool.material=latest;
 f.geology.setQuality('high');f.geology.setQuality('high');f.geology.setQuality('automatic');
 assert.equal(pool.material,latest,'Retain the current prepared fallback without capturing a review material');
});

test('quality switching preserves native pool transforms, active colors, geometry bytes and collider queries',async t=>{
 const review=prototypes(),f=await fixture(t,review),ordinary=await fixture(t),ground=new ParkTerrain(map);
 const poolObjects=[...f.pools],matrices=f.pools.map(pool=>pool.instanceMatrix),colors=f.pools.map(pool=>pool.instanceColor),fallbackGeometry=f.pools.map(pool=>pool.geometry);
 const fallbackBytes=fallbackGeometry.map(geometryBytes),reviewBytes=review.map(item=>geometryBytes(item.geometry));
 assert.deepEqual(f.geology.boulders,ordinary.geology.boulders);assert.deepEqual(f.registrations,ordinary.registrations);assert.equal(f.registrations.length,1);
 const rocks=f.geology.boulders;assert(rocks.length>0);
 const stops=[rocks[0],{x:rocks[0].x+3,z:rocks[0].z},{x:rocks[0].x+7,z:rocks[0].z},rocks.at(-1)!,{x:1e6,z:1e6}];
 for(const quality of ['high','smooth','automatic','high','high','smooth']){
  f.geology.setQuality(quality);ordinary.geology.setQuality(quality);
  for(const stop of stops){
   f.geology.update(stop.x,stop.z);ordinary.geology.update(stop.x,stop.z);
   f.pools.forEach((pool,i)=>{
    const expected=ordinary.pools[i],shape=Math.floor(i/2),imported=quality==='high'&&pool.name.endsWith(' near');
    assert.equal(pool,poolObjects[i]);assert.equal(pool.instanceMatrix,matrices[i]);assert.equal(pool.instanceColor,colors[i]);
    assert.equal(pool.count,expected.count);assert.equal(pool.visible,expected.visible);
    assert.equal(pool.frustumCulled,expected.frustumCulled);assert.equal(pool.castShadow,expected.castShadow);assert.equal(pool.receiveShadow,expected.receiveShadow);
    assert.deepEqual(Array.from(pool.instanceMatrix.array),Array.from(expected.instanceMatrix.array));
    assert.equal(pool.geometry,imported?review[shape].geometry:fallbackGeometry[i]);
    assert.deepEqual(geometryBytes(pool.geometry),imported?reviewBytes[shape]:fallbackBytes[i]);
    for(let j=0;j<pool.count*3;j++)assert.equal(pool.instanceColor!.array[j],imported?1:expected.instanceColor!.array[j]);
   });
  }
  for(const rock of rocks){
   assert.equal(f.terrain.height(rock.x,rock.z),ground.height(rock.x,rock.z),'No ground-height change');
   assert.equal(f.terrain.obstructed(rock.x,rock.z,.27),ordinary.terrain.obstructed(rock.x,rock.z,.27));
   const origin={x:rock.x-rock.radius*2-1,y:rock.y+rock.height*.5,z:rock.z},direction={x:1,y:0,z:0},distance=rock.radius*4+2;
   assert.equal(f.terrain.raycastObstacle(origin,direction,distance,.27),ordinary.terrain.raycastObstacle(origin,direction,distance,.27));
   assert.equal(f.terrain.raycastFlight(origin,direction,distance,.27),ordinary.terrain.raycastFlight(origin,direction,distance,.27));
  }
 }
 assert.equal(f.registrations.length,1,'Graphics changes never register new colliders');assert.deepEqual(f.registrations,ordinary.registrations);
});

test('the ordinary path never prepares imported materials or replaces its dressed pool materials',async t=>{
 const f=await fixture(t);assert.equal(f.prepared.length,0);
 for(const quality of ['high','smooth','automatic','high']){
  f.geology.setQuality(quality);f.geology.update(map.spawn.x,map.spawn.z);
  f.pools.forEach((pool,i)=>assert.equal(pool.material,f.dressed[i]));
 }
 assert.equal(f.prepared.length,0);assert.equal(f.registrations.length,1);
});

test('independent worlds bind imported shaders to their own live uniforms and restore their own original hooks',async t=>{
 const a=await fixture(t,prototypes()),b=await fixture(t,prototypes());
 a.atmosphere.update(13,new T.Vector3(1,1,0),.2,1,0,'high',false,false);
 b.atmosphere.update(29,new T.Vector3(-1,1,0),.7,.4,.3,'high',false,false);
 for(let i=0;i<3;i++){
  const ma=a.prepared[i]?.material,mb=b.prepared[i]?.material;assert(ma&&mb,'Both owners must prepare their own detached assets');
  const sa=compile(ma),sb=compile(mb);
  assert(hasAtmosphereProgram(ma.onBeforeCompile,a.atmosphere));assert(!hasAtmosphereProgram(ma.onBeforeCompile,b.atmosphere));
  assert(hasAtmosphereProgram(mb.onBeforeCompile,b.atmosphere));assert(!hasAtmosphereProgram(mb.onBeforeCompile,a.atmosphere));
  assert.equal(sa.uniforms.belleCloudTime,a.atmosphere.uniforms.belleCloudTime);assert.equal(sb.uniforms.belleCloudTime,b.atmosphere.uniforms.belleCloudTime);
  assert.notEqual(sa.uniforms.belleCloudTime,sb.uniforms.belleCloudTime);assert.equal(sa.uniforms.belleCloudTime.value,13);assert.equal(sb.uniforms.belleCloudTime.value,29);
 }
 const bHooks=b.prepared.map(({material})=>material.onBeforeCompile);a.atmosphere.dispose();
 b.prepared.forEach(({material},i)=>assert.equal(material.onBeforeCompile,bHooks[i]));
 a.prepared.forEach(({material},i)=>{assert.equal(material.onBeforeCompile,a.restore![i].compile);assert.equal(material.customProgramCacheKey,a.restore![i].key);});
});

test('a disposed world releases shared imported materials for a new atmosphere owner',async t=>{
 const review=prototypes(),originals=review.map(({material})=>({compile:material.onBeforeCompile,key:material.customProgramCacheKey}));
 const a=await fixture(t,review,false);a.geology.setQuality('high');
 assert.equal(a.prepared.length,3);
 const oldHooks=review.map(({material})=>material.onBeforeCompile);a.atmosphere.dispose();
 review.forEach(({material},i)=>{assert.equal(material.onBeforeCompile,originals[i].compile);assert.equal(material.customProgramCacheKey,originals[i].key);});
 const b=await fixture(t,review);b.geology.setQuality('high');b.atmosphere.update(41,new T.Vector3(0,1,1),.3,.7,0,'high',false,false);
 for(let i=0;i<review.length;i++){
  const {material}=review[i],shader=compile(material);
  assert.notEqual(material.onBeforeCompile,oldHooks[i]);assert(hasAtmosphereProgram(material.onBeforeCompile,b.atmosphere));assert(!hasAtmosphereProgram(material.onBeforeCompile,a.atmosphere));
  assert.equal(shader.uniforms.belleCloudTime,b.atmosphere.uniforms.belleCloudTime);assert.equal(shader.uniforms.belleCloudTime.value,41);
  assert.equal((shader.vertexShader.match(/varying vec3 belleAtmosphereWorld;/g)||[]).length,1);
  assert.deepEqual(b.prepared[i].restore,originals[i]);
 }
 b.atmosphere.dispose();
 review.forEach(({material},i)=>{assert.equal(material.onBeforeCompile,originals[i].compile);assert.equal(material.customProgramCacheKey,originals[i].key);});
});
