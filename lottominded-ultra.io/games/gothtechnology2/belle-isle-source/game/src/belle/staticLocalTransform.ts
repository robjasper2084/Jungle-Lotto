import type {Object3D} from 'three';

/** Cache only a module-owned object's fixed local transform after placement.
 * World matrices and descendant traversal retain Three's native behavior, so
 * moving/reparenting an ancestor, instance animation and culling still work.
 * A caller that later changes this object's transform must call updateMatrix
 * or restore matrixAutoUpdate. Do not apply this to an animated object. */
export function cacheStaticLocalTransform<O extends Object3D>(object:O):O{
 if(object.matrixAutoUpdate){
  object.updateMatrix();
  object.matrixAutoUpdate=false;
 }
 return object;
}
