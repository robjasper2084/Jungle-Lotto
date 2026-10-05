import {Quaternion,Vector3} from 'three';

/** Carry the original elbow bend plane with the reach instead of twisting a sleeve sideways. */
export function transportedBend(shoulder:Vector3,elbow:Vector3,hand:Vector3,target:Vector3,fallback:Vector3){
 const from=hand.clone().sub(shoulder).normalize(),to=target.clone().sub(shoulder).normalize();
 const bend=elbow.clone().sub(shoulder);bend.addScaledVector(from,-bend.dot(from));
 if(bend.lengthSq()<1e-8){bend.copy(fallback);bend.addScaledVector(from,-bend.dot(from));}
 if(bend.lengthSq()<1e-8)bend.copy(from).cross(Math.abs(from.y)<.9?new Vector3(0,1,0):new Vector3(1,0,0));
 return bend.normalize().applyQuaternion(new Quaternion().setFromUnitVectors(from,to));
}
