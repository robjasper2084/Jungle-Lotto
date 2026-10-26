import * as T from 'three';
import type {Hero} from '../actors.ts';
import {calibrateLimb,solveAnatomicalLimb,type AnatomicalLimb} from '../../../../ride-core/src/limbIK.ts';
/** A modest view-only lift keeps the selected hero's fingers readable. */
export const FPS_HAND_SCALE=1.25;

/** Use the selected hero's authored forearms, cuffs and articulated hands.
 * Only this separate view rig is refitted; world bones/materials stay untouched. */
export class FpsArms {
 private masks:T.BufferGeometry[]=[];
 private limbs:{upper:T.Object3D;forearm:T.Object3D;hand:T.Object3D;scale:T.Vector3;handScale:T.Vector3;anatomy:AnatomicalLimb}[]=[];
 constructor(hero:Hero,private root:T.Group){
  hero.visibility.setFirstPerson(true,true);
  for(const arm of hero.arms){const forearm=arm.knee,hand=arm.foot;
   this.limbs.push({upper:forearm.parent!,forearm,hand,scale:forearm.scale.clone(),handScale:hand.scale.clone(),anatomy:calibrateLimb(arm,new T.Vector3(0,0,1))});
  }
  const hands=new Set<T.Object3D>();for(const limb of this.limbs)limb.hand.traverse(o=>hands.add(o));
  hero.rider.traverse(o=>{
   if(!(o instanceof T.Mesh))return;o.frustumCulled=false;
   // The source body also contains mitten hands. Keep its real forearms/cuffs,
   // but let the articulated glove supply the fingers without double surfaces.
   if(!(o instanceof T.SkinnedMesh)||/ArticulatedGlove/.test(o.name))return;
   const source=o.geometry,index=source.index,skin=source.getAttribute('skinIndex'),weights=source.getAttribute('skinWeight');if(!index||!skin||!weights)return;
   const handVertex=new Uint8Array(skin.count);
   for(let v=0;v<skin.count;v++){let w=0;for(let i=0;i<4;i++)if(hands.has(o.skeleton.bones[skin.getComponent(v,i)]))w+=weights.getComponent(v,i);handVertex[v]=w>=.5?1:0;}
   const geometry=source.clone(),kept:number[]=[];geometry.clearGroups();
   for(const group of source.groups.length?source.groups:[{start:0,count:index.count,materialIndex:0}]){const start=kept.length;
    for(let i=group.start;i<group.start+group.count;i+=3){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);if(handVertex[a]+handVertex[b]+handVertex[c]<2)kept.push(a,b,c);}
    geometry.addGroup(start,kept.length-start,group.materialIndex);
   }
   geometry.setIndex(kept);this.masks.push(geometry);o.geometry=geometry;
  });
 }
 /** Reset view-only bone matrices before the next animation/IK solve. */
 reset(){for(const limb of this.limbs){
  limb.forearm.scale.copy(limb.scale);limb.forearm.matrixAutoUpdate=true;
  limb.hand.scale.copy(limb.handScale);limb.hand.matrixAutoUpdate=true;
 }}
 update(camera:T.Camera,scale:number,_viewScale:number,eyeLower=0){
  const rotation=camera.getWorldQuaternion(new T.Quaternion()),position=camera.getWorldPosition(new T.Vector3());
  const forward=new T.Vector3(0,0,-1).applyQuaternion(rotation),right=new T.Vector3(1,0,0).applyQuaternion(rotation),up=new T.Vector3(0,1,0).applyQuaternion(rotation);
  for(const [i,limb]of this.limbs.entries()){
   const {upper,forearm,hand}=limb;
   const wrist=hand.getWorldPosition(new T.Vector3()),handRotation=hand.getWorldQuaternion(new T.Quaternion()),handScale=hand.getWorldScale(new T.Vector3());
   // Aim the elbow toward the lower frame, but keep the selected hero's
   // authored limb length. Extending all the way to that screen anchor made
   // forearms several times longer than the third-person hero's arms.
   const depth=wrist.clone().sub(position).dot(forward);
   const anchor=position.clone().addScaledVector(right,(i===0?-.36:.38)*scale).addScaledVector(up,-1.1*scale-eyeLower).addScaledVector(forward,depth*.9);
   const length=forearm.getWorldPosition(new T.Vector3()).distanceTo(wrist);
   const direction=wrist.clone().sub(anchor).normalize(),elbow=wrist.clone().addScaledVector(direction,-length);
   // Continue the real upper sleeve behind the frame instead of making a
   // short forearm span the entire distance from the wrist to the camera.
   const upperLength=upper.getWorldPosition(new T.Vector3()).distanceTo(forearm.getWorldPosition(new T.Vector3()));
   const shoulderAnchor=position.clone().addScaledVector(right,(i===0?-.40:.40)*scale).addScaledVector(up,-1.4*scale-eyeLower).addScaledVector(forward,depth*.8);
   const upperDirection=elbow.clone().sub(shoulderAnchor).normalize(),shoulder=elbow.clone().addScaledVector(upperDirection,-upperLength);
   upper.position.copy(upper.parent!.worldToLocal(shoulder.clone()));
   forearm.scale.copy(limb.scale);
   // Use the imported segment axes and one elbow bend plane. Assuming every
   // hero's bones point along +Y twists the selected hero's sleeve geometry.
   solveAnatomicalLimb({upper,knee:forearm,foot:hand},wrist,elbow.clone().sub(shoulder),limb.anatomy,handRotation,1);
   // Keep the authored hand shape with the reviewed FPS size, without
   // stretching either sleeve or changing the solved camera grip.
   handScale.multiplyScalar(FPS_HAND_SCALE);
   hand.matrixAutoUpdate=false;
   hand.matrix.copy(forearm.matrixWorld).invert().multiply(new T.Matrix4().compose(wrist,handRotation,handScale));
   hand.updateWorldMatrix(false,true);
  }
  this.root.updateMatrixWorld(true);
 }
 dispose(){this.reset();for(const geometry of this.masks)geometry.dispose();}
}
