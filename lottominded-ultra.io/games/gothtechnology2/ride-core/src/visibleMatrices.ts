import type {Object3D} from 'three';

const installed=new WeakSet<Object3D>();
/** For distance-culled scenery roots only. Invisible render trees need no world
 * matrix traversal. Returning to visibility flushes all descendants in one pass.
 * Direct world-position queries still use Three's independent updateWorldMatrix.
 * Do not install on skeleton bones, camera targets or simulation objects. */
export function visibleSceneryMatrices(root:Object3D){
 if(installed.has(root))return;installed.add(root);
 const original=root.updateMatrixWorld;
 let hidden=false;
 root.updateMatrixWorld=function(force?:boolean){
  if(!this.visible){hidden=true;return;}
  original.call(this,force||hidden);hidden=false;
 };
}
