import * as T from 'three';
import {inheritAtmosphereProgram} from './atmosphereProgramIdentity.ts';

const identity=new T.Matrix4();
const identityMaterials=new WeakMap<T.Material,{compile:T.Material['onBeforeCompile'];key:T.Material['customProgramCacheKey']}>();

/** The audited factory bakes every position and normal into world space. Native
 * BatchedMesh nevertheless inserts an identity matrix multiply/divide into the
 * vertex path. Metal can round that additional arithmetic differently at thin
 * street edges. Disabling only that unused path keeps the original shader
 * arithmetic; Three still owns the multi-draw ranges, visibility and ordering.
 * The pinned shader regression covers every USE_BATCHING consumer in r185.
 */
function preserveIdentityVertexPath(batch:T.BatchedMesh,sources:T.Mesh[]):boolean {
 const material=batch.material;
 const colors=(batch as T.BatchedMesh&{_colorsTexture:T.DataTexture|null})._colorsTexture;
 if(T.REVISION!=='185'||Array.isArray(material)||!(material instanceof T.MeshStandardMaterial)||
    material.type!=='MeshStandardMaterial'||material.transparent||material.opacity!==1||material.alphaTest||material.vertexColors||
    colors!==null||!batch.matrix.equals(identity)||!batch.matrixWorld.equals(identity)||
    !sources.length||sources.some(source=>source.material!==material||!source.matrix.equals(identity)||!source.matrixWorld.equals(identity)))return false;
 const installed=identityMaterials.get(material);
 if(installed)return material.onBeforeCompile===installed.compile&&material.customProgramCacheKey===installed.key;
 const previousCompile=material.onBeforeCompile,previousKey=material.customProgramCacheKey;
 const compile:T.Material['onBeforeCompile']=function(this:T.Material,...args){
  const result=Reflect.apply(previousCompile,this,args);
  // USE_BATCHING is supplied by WebGLProgram before this source. It is absent
  // in the original Mesh variant, where the undef is an inert preprocessing
  // directive. The fragment shader and every original uniform stay untouched.
  args[0].vertexShader='#undef USE_BATCHING\n'+args[0].vertexShader;
  return result;
 };
 const key:T.Material['customProgramCacheKey']=function(this:T.Material,...args){return Reflect.apply(previousKey,this,args)+'|street-identity-vertex-v1';};
 material.onBeforeCompile=compile;material.customProgramCacheKey=key;inheritAtmosphereProgram(material,previousCompile);material.needsUpdate=true;
 identityMaterials.set(material,{compile,key});return true;
}

/** Preserve the native opaque order for one exact-material street tile batch.
 * Its factory-owned sources are ordinary, world-baked meshes with one material,
 * render order and layer mask. No other draw uses that material (metal tiles
 * are excluded by the factory). Native r185 sorts these sources by projected
 * sphere-center depth, then original object ID, rather than insertion order.
 * The original geometry bounds and matrices remain the authority here too.
 */
export function preserveStreetBatchOrder(batch:T.BatchedMesh,sources:T.Mesh[]):false|void{
 if(!preserveIdentityVertexPath(batch,sources))return false;
 const projection=new T.Matrix4(),center=new T.Vector3();
 batch.sortObjects=true;
 batch.setCustomSort((list,camera)=>{
  projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  // The public declaration omits the instance index; pinned r185 supplies it
  // on every native MultiDrawRenderList row. The regression exercises this
  // actual callback and indirect list, rather than an imitation of the sort.
  const rows=list as Array<{start:number;count:number;z:number;index:number}>;
  for(const row of rows){
   const source=sources[row.index];
   center.copy(source.geometry.boundingSphere!.center).applyMatrix4(source.matrixWorld).applyMatrix4(projection);
   row.z=center.z;
  }
  rows.sort((a,b)=>a.z!==b.z?a.z-b.z:sources[a.index].id-sources[b.index].id);
 });
}
