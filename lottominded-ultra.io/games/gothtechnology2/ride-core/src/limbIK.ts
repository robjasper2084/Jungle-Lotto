import {Object3D,Quaternion,Vector3,MathUtils} from 'three';

export type LimbChain={upper:Object3D;knee:Object3D;foot:Object3D};
const epsilon=1e-6;
function point(bone:Object3D,child:Object3D,target:Vector3){
  const origin=bone.getWorldPosition(new Vector3());
  const from=child.getWorldPosition(new Vector3()).sub(origin),to=target.clone().sub(origin);
  if(from.lengthSq()<epsilon*epsilon||to.lengthSq()<epsilon*epsilon)return;
  const world=bone.getWorldQuaternion(new Quaternion()).premultiply(new Quaternion().setFromUnitVectors(from.normalize(),to.normalize()));
  if(bone.parent)world.premultiply(bone.parent.getWorldQuaternion(new Quaternion()).invert());
  bone.quaternion.copy(world);bone.updateWorldMatrix(false,true);
}

/** Two-bone IK shared by all game adapters. Rotate only: keep imported bone lengths
 * and skin weights intact. A collapsed reach or parallel hint must never flip or
 * shorten a limb. The caller's reusable target and hint vectors remain unchanged. */
export function solveLimb(l:LimbChain,target:Vector3,hint:Vector3,rotation?:Quaternion,reachFraction=1){
  l.upper.updateWorldMatrix(true,true);
  const a=l.upper.getWorldPosition(new Vector3()),b=l.knee.getWorldPosition(new Vector3()),c=l.foot.getWorldPosition(new Vector3());
  const l1=a.distanceTo(b),l2=b.distanceTo(c);
  if(l1<epsilon||l2<epsilon||!target.toArray().every(Number.isFinite))return;
  const direction=target.clone().sub(a);
  if(direction.lengthSq()<epsilon*epsilon)direction.copy(c).sub(a);
  if(direction.lengthSq()<epsilon*epsilon)direction.copy(b).sub(a);
  const requested=target.distanceTo(a);direction.normalize();
  const minimum=Math.abs(l1-l2)+epsilon,maximum=Math.max(minimum,(l1+l2)*MathUtils.clamp(reachFraction,.01,1)-epsilon);
  const distance=MathUtils.clamp(requested,minimum,maximum);
  const pole=hint.clone().addScaledVector(direction,-hint.dot(direction));
  if(pole.lengthSq()<epsilon){pole.copy(b).sub(a);pole.addScaledVector(direction,-pole.dot(direction));}
  if(pole.lengthSq()<epsilon){pole.set(Math.abs(direction.x)<.8?1:0,Math.abs(direction.x)<.8?0:1,0);pole.addScaledVector(direction,-pole.dot(direction));}
  pole.normalize();
  const along=(l1*l1+distance*distance-l2*l2)/(2*distance),bend=Math.sqrt(Math.max(0,l1*l1-along*along));
  point(l.upper,l.knee,a.clone().addScaledVector(direction,along).addScaledVector(pole,bend));
  point(l.knee,l.foot,a.clone().addScaledVector(direction,distance));
  if(rotation&&rotation.toArray().every(Number.isFinite)){
    l.foot.quaternion.copy(rotation);
    if(l.foot.parent)l.foot.quaternion.premultiply(l.foot.parent.getWorldQuaternion(new Quaternion()).invert());
    l.foot.updateWorldMatrix(false,true);
  }
}
