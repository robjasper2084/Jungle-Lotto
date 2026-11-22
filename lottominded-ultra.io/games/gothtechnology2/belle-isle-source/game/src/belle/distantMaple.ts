import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// A folded four-corner leaf with the same projected area and height centroid as
// the authored maple. Its two triangular faces preserve the central crease.
export function mapleDetail(original:T.BufferGeometry){
 const halfWidth=.227/.71,waist=3*.04842290749-.43+.28;
 const corners=[[0,-.28],[-halfWidth,waist],[0,.43],[halfWidth,waist]];
 const far=new T.BufferGeometry();
 far.setAttribute('position',new T.Float32BufferAttribute(corners.flatMap(([x,y])=>[x,Math.abs(x)*.13,-y]),3));
 far.setAttribute('uv',new T.Float32BufferAttribute(corners.flat(),2));
 far.setIndex([0,2,1,0,3,2]);far.computeVertexNormals();
 const geometry=mergeGeometries([original,far])!;
 const originalCount=original.index!.count;
 geometry.setDrawRange(0,originalCount);
 // Raycasts and Three's initial frustum test use the full authored bounds.
 original.computeBoundingSphere();geometry.boundingSphere=original.boundingSphere!.clone();
 far.dispose();
 return {geometry,originalCount};
}

export function useDistantMaple(mesh:T.InstancedMesh,detail:ReturnType<typeof mapleDetail>){
 const pixels=new T.Vector2(),bounds=new T.Sphere();
 mesh.onBeforeRender=(renderer,_scene,camera)=>{
  const perspective=camera as T.PerspectiveCamera;
  if(!perspective.isPerspectiveCamera||renderer.xr.isPresenting||renderer.getRenderTarget()||!mesh.boundingSphere)return;
  renderer.getDrawingBufferSize(pixels);
  const p=camera.projectionMatrix.elements;
  bounds.copy(mesh.boundingSphere).applyMatrix4(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
  const near=-bounds.center.z-bounds.radius;
  const slopeX=(1+Math.abs(p[8]))/Math.abs(p[0]),slopeY=(1+Math.abs(p[9]))/Math.abs(p[5]);
  const focal=Math.max(Math.abs(p[0])*pixels.x,Math.abs(p[5])*pixels.y)/2;
  // The 3D outline error is below 15 cm before instance scaling. The largest
  // leaf in this grove is 2.2×. Bound perspective displacement in pixels.
  const error=.15*2.2*mesh.matrixWorld.getMaxScaleOnAxis();
  if(near>error && error*focal*Math.hypot(1,slopeX,slopeY)<(near-error)*.5)
   detail.geometry.setDrawRange(detail.originalCount,6);
 };
 // The range only changes during a colour draw. Shadows, reflection targets,
 // picking and subsequent cameras see the complete source geometry.
 mesh.onAfterRender=()=>detail.geometry.setDrawRange(0,detail.originalCount);
}
