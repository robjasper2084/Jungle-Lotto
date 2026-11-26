import * as T from 'three';

/** Preserve the native opaque order for one exact-material street tile batch.
 * Its factory-owned sources are ordinary, world-baked meshes with one material,
 * render order and layer mask. No other draw uses that material (metal tiles
 * are excluded by the factory). Native r185 sorts these sources by projected
 * sphere-center depth, then original object ID, rather than insertion order.
 * The original geometry bounds and matrices remain the authority here too.
 */
export function preserveStreetBatchOrder(batch:T.BatchedMesh,sources:T.Mesh[]){
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
