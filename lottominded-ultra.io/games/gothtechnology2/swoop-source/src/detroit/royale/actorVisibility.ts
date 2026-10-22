import * as T from 'three';
/** Presentation only: retain server actors, collision, hitboxes and shadows near
 * the player, but do not solve an off-camera skeleton on every display frame. */
export class ActorVisibility {
 private frustum=new T.Frustum();private matrix=new T.Matrix4();private sphere=new T.Sphere();
 update(camera:T.Camera){camera.updateMatrixWorld();this.frustum.setFromProjectionMatrix(this.matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));}
 visible(position:{x:number;y:number;z:number},focus:{x:number;z:number}){
  // Nearby actors can cast a visible shadow even when behind the camera.
  if(Math.hypot(position.x-focus.x,position.z-focus.z)<28)return true;
  this.sphere.center.set(position.x,position.y+1,position.z);this.sphere.radius=5;
  return this.frustum.intersectsSphere(this.sphere);
 }
}
