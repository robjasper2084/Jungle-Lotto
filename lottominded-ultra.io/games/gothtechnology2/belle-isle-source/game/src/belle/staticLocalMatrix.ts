import type {Object3D} from 'three';

/** Finalize the local transform of an authored rigid object after placement.
 * Call only at a static asset factory boundary: instance data, materials and
 * visibility may still change, but the object's own TRS must not be animated.
 * World updates remain enabled, so transformed parents, camera/shadow passes
 * and ancestor-aware picking keep the original Three.js matrix arithmetic.
 */
export function finalizeStaticLocalMatrix<T extends Object3D>(object:T):T{
 object.updateMatrix();
 object.matrixAutoUpdate=false;
 return object;
}
