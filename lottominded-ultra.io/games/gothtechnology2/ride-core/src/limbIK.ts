import {Object3D,Quaternion,Vector3,Matrix4,MathUtils} from 'three';

export type LimbChain={upper:Object3D;knee:Object3D;foot:Object3D};
/** Segment frames captured before posing. Both local X axes describe the same
 * anatomical hinge normal; local Y follows that segment's imported length axis. */
export type AnatomicalLimb={upperBasisInverse:Quaternion;kneeBasisInverse:Quaternion;parentNormal:Vector3;bendSign:number};
const epsilon=1e-6;

function frame(normal:Vector3,direction:Vector3){
  const y=direction.clone().normalize(),x=normal.clone().addScaledVector(y,-normal.dot(y)).normalize();
  const z=x.clone().cross(y).normalize();x.copy(y).cross(z).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z));
}

/** Capture at the rig's authored rest pose, before applying fall/IK rotations.
 * bendNormal is a world-space anatomical knee hinge (usually the rig's right). */
export function calibrateLimb(l:LimbChain,bendNormal:Vector3):AnatomicalLimb{
  l.upper.updateWorldMatrix(true,true);
  const a=l.upper.getWorldPosition(new Vector3()),b=l.knee.getWorldPosition(new Vector3()),c=l.foot.getWorldPosition(new Vector3());
  const authoredNormal=b.clone().sub(a).normalize().cross(c.clone().sub(b).normalize());
  const bent=authoredNormal.lengthSq()>1e-8;
  const normal=(bent?authoredNormal:bendNormal).clone().normalize();
  const bendSign=bent&&normal.dot(bendNormal)<0?-1:1;normal.multiplyScalar(bendSign);
  const basis=(bone:Object3D,child:Object3D)=>{
    const inverse=bone.getWorldQuaternion(new Quaternion()).invert();
    const direction=child.getWorldPosition(new Vector3()).sub(bone.getWorldPosition(new Vector3())).applyQuaternion(inverse).normalize();
    return frame(normal.clone().applyQuaternion(inverse),direction).invert();
  };
  const parentNormal=normal.clone().multiplyScalar(bendSign);if(l.upper.parent)parentNormal.applyQuaternion(l.upper.parent.getWorldQuaternion(new Quaternion()).invert());
  return {upperBasisInverse:basis(l.upper,l.knee),kneeBasisInverse:basis(l.knee,l.foot),parentNormal:parentNormal.normalize(),bendSign};
}

/** Opt-in anatomical IK: unlike independent shortest-arc rotations, it constrains
 * both segments to one bend plane, so a valid ankle target cannot corkscrew the
 * knee skin. maxFlexRadians optionally keeps short recovery rigs from folding
 * a shin fully into its thigh; unreachable ankle targets remain length-clamped.
 * Existing general-purpose solveLimb callers retain their behavior. */
export function solveAnatomicalLimb(l:LimbChain,target:Vector3,hint:Vector3,anatomy:AnatomicalLimb,rotation?:Quaternion,reachFraction=.975,maxFlexRadians=Math.PI){
  l.upper.updateWorldMatrix(true,true);
  const a=l.upper.getWorldPosition(new Vector3()),b=l.knee.getWorldPosition(new Vector3()),c=l.foot.getWorldPosition(new Vector3());
  const l1=a.distanceTo(b),l2=b.distanceTo(c);
  if(l1<epsilon||l2<epsilon||!target.toArray().every(Number.isFinite))return;
  const direction=target.clone().sub(a);
  if(direction.lengthSq()<epsilon*epsilon)direction.copy(c).sub(a);
  if(direction.lengthSq()<epsilon*epsilon)direction.copy(b).sub(a);
  direction.normalize();
  const maxFlex=MathUtils.clamp(Number.isFinite(maxFlexRadians)?maxFlexRadians:Math.PI,0,Math.PI);
  const flexReach=Math.sqrt(Math.max(0,l1*l1+l2*l2+2*l1*l2*Math.cos(maxFlex)));
  const minimum=Math.max(Math.abs(l1-l2)+epsilon,flexReach),maximum=Math.max(minimum,(l1+l2)*MathUtils.clamp(reachFraction,.01,1)-epsilon);
  const distance=MathUtils.clamp(target.distanceTo(a),minimum,maximum);
  const pole=hint.clone().addScaledVector(direction,-hint.dot(direction));
  if(pole.lengthSq()<epsilon){
    const normal=anatomy.parentNormal.clone();if(l.upper.parent)normal.applyQuaternion(l.upper.parent.getWorldQuaternion(new Quaternion()));
    pole.copy(direction).cross(normal);
  }
  if(pole.lengthSq()<epsilon){pole.set(Math.abs(direction.x)<.8?1:0,Math.abs(direction.x)<.8?0:1,0);pole.addScaledVector(direction,-pole.dot(direction));}
  pole.normalize();
  const along=(l1*l1+distance*distance-l2*l2)/(2*distance),bend=Math.sqrt(Math.max(0,l1*l1-along*along));
  const knee=a.clone().addScaledVector(direction,along).addScaledVector(pole,bend),end=a.clone().addScaledVector(direction,distance);
  const normal=pole.clone().cross(direction).normalize().multiplyScalar(anatomy.bendSign);
  const place=(bone:Object3D,childDirection:Vector3,basisInverse:Quaternion)=>{
    const world=frame(normal,childDirection).multiply(basisInverse);
    bone.quaternion.copy(bone.parent?bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(world):world);
    bone.updateWorldMatrix(false,true);
  };
  place(l.upper,knee.clone().sub(a),anatomy.upperBasisInverse);
  place(l.knee,end.clone().sub(knee),anatomy.kneeBasisInverse);
  if(rotation&&rotation.toArray().every(Number.isFinite)){
    l.foot.quaternion.copy(rotation);
    if(l.foot.parent)l.foot.quaternion.premultiply(l.foot.parent.getWorldQuaternion(new Quaternion()).invert());
  }
  l.upper.updateWorldMatrix(false,true);
}
function point(bone:Object3D,child:Object3D,target:Vector3){
  const origin=bone.getWorldPosition(new Vector3());
  const from=child.getWorldPosition(new Vector3()).sub(origin),to=target.clone().sub(origin);
  if(from.lengthSq()<epsilon*epsilon||to.lengthSq()<epsilon*epsilon)return;
  const world=bone.getWorldQuaternion(new Quaternion()).premultiply(new Quaternion().setFromUnitVectors(from.normalize(),to.normalize()));
  if(bone.parent)world.premultiply(bone.parent.getWorldQuaternion(new Quaternion()).invert());
  bone.quaternion.copy(world);bone.updateWorldMatrix(false,false);
}

/** Two-bone IK shared by all game adapters. Rotate only: keep imported bone lengths
 * and skin weights intact. A collapsed reach or parallel hint must never flip or
 * shorten a limb. The caller's reusable target and hint vectors remain unchanged. */
export function solveLimb(l:LimbChain,target:Vector3,hint:Vector3,rotation?:Quaternion,reachFraction=1){
  // World queries below refresh the ancestor path they need. Defer unrelated
  // descendants (including every finger/toe) until the completed solve.
  l.upper.updateWorldMatrix(true,false);
  const a=l.upper.getWorldPosition(new Vector3()),b=l.knee.getWorldPosition(new Vector3()),c=l.foot.getWorldPosition(new Vector3());
  const l1=a.distanceTo(b),l2=b.distanceTo(c);
  if(l1<epsilon||l2<epsilon||!target.toArray().every(Number.isFinite)){l.upper.updateWorldMatrix(false,true);return;}
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
  }
  l.upper.updateWorldMatrix(false,true);
}
