import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export type RockReviewPrototype={geometry:T.BufferGeometry;material:T.MeshStandardMaterial};
export const REVIEW_ROCK_TRIANGLES=600;
import {REVIEW_ROCK_FILES} from './polyhavenRockReviewFiles.ts';
export {REVIEW_ROCK_FILES} from './polyhavenRockReviewFiles.ts';

/** Normalize only the visual geometry to the existing collider/placement
 * envelope. No new obstacles, coordinates or collision surfaces. */
export function fitRockReviewGeometry(geometry:T.BufferGeometry){
 const g=geometry.clone(),position=g.getAttribute('position');
 if(!position||!g.getAttribute('uv')||!g.getAttribute('normal'))throw Error('Rock preview missing UV or normal');
 const tris=(g.index?.count??position.count)/3;
 if(!Number.isInteger(tris)||tris<1||tris>REVIEW_ROCK_TRIANGLES)throw Error('Rock preview triangle budget');
 g.computeBoundingBox();const box=g.boundingBox!;
 const cx=(box.min.x+box.max.x)/2,cz=(box.min.z+box.max.z)/2,h=box.max.y-box.min.y;
 let r=0;for(let i=0;i<position.count;i++)r=Math.max(r,Math.hypot(position.getX(i)-cx,position.getZ(i)-cz));
 if(!Number.isFinite(h)||!Number.isFinite(r)||h<=0||r<=0)throw Error('Rock preview bounds');
 g.translate(-cx,-box.min.y,-cz);g.scale(.78/r,.98/h,.78/r);g.translate(0,-.32,0);
 g.computeBoundingBox();g.computeBoundingSphere();return g;
}

/** Called only by the dedicated review build; no production network traffic. */
export async function loadRockReview():Promise<RockReviewPrototype[]>{
 const loader=new GLTFLoader();
 const prototypes=await Promise.all(REVIEW_ROCK_FILES.map(async file=>{
  const {scene}=await loader.loadAsync('./belle/polyhaven-review/'+file);
  scene.updateMatrixWorld(true);
  const meshes:T.Mesh[]=[];scene.traverse(o=>{if(o instanceof T.Mesh)meshes.push(o);});
  if(meshes.length!==1)throw Error('Expected single rock prototype: '+file);
  const mesh=meshes[0],material=mesh.material;
  if(!(material instanceof T.MeshStandardMaterial)||!material.map||!material.normalMap||!material.roughnessMap)throw Error('Incomplete PBR maps: '+file);
  const transformed=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  const geometry=fitRockReviewGeometry(transformed);transformed.dispose();
  return {geometry,material};
 }));
 document.documentElement.dataset.polyhavenRockReview='loaded';
 return prototypes;
}
