import * as T from 'three';
import type {Hero} from '../actors.ts';

/** Use the selected hero's authored forearms, cuffs and articulated hands.
 * Only this separate view rig is refitted; world bones/materials stay untouched. */
export class FpsArms {
 private masks:T.BufferGeometry[]=[];
 private limbs:{forearm:T.Object3D;hand:T.Object3D;scale:T.Vector3;handScale:T.Vector3;length:number}[]=[];
 constructor(private hero:Hero,private root:T.Group){
  hero.visibility.setFirstPerson(true);
  for(const arm of hero.arms){const forearm=arm.knee,hand=arm.foot;
   this.limbs.push({forearm,hand,scale:forearm.scale.clone(),handScale:hand.scale.clone(),length:hand.position.length()});
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
   const {forearm,hand}=limb;
   const wrist=hand.getWorldPosition(new T.Vector3()),handRotation=hand.getWorldQuaternion(new T.Quaternion()),handScale=hand.getWorldScale(new T.Vector3());
   // Off-screen elbows reveal the actual jacket/armor UVs, not generic tubes.
   const elbow=position.clone().addScaledVector(right,(i===0?-.36:.38)*scale).addScaledVector(up,-.57*scale-eyeLower).addScaledVector(forward,-.06*scale);
   const direction=wrist.clone().sub(elbow),parent=forearm.parent!,armRotation=forearm.getWorldQuaternion(new T.Quaternion());
   armRotation.premultiply(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0).applyQuaternion(armRotation),direction.clone().normalize()));
   forearm.position.copy(parent.worldToLocal(elbow.clone()));
   forearm.quaternion.copy(parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(armRotation));
   const parentScale=parent.getWorldScale(new T.Vector3()).y;
   forearm.scale.copy(limb.scale);forearm.scale.y=direction.length()/Math.max(.00001,limb.length*parentScale);
   forearm.updateWorldMatrix(true,false);
   // Counter the forearm stretch at the wrist. Enlarge the actual hands, not
   // the gun, while keeping finger proportions and the solved grip rotation.
   handScale.multiplyScalar(this.hero.riderId.startsWith('DS_Mascot_')?1.35:1.5);
   hand.matrixAutoUpdate=false;
   hand.matrix.copy(forearm.matrixWorld).invert().multiply(new T.Matrix4().compose(wrist,handRotation,handScale));
   hand.updateWorldMatrix(false,true);
  }
  this.root.updateMatrixWorld(true);
 }
 dispose(){this.reset();for(const geometry of this.masks)geometry.dispose();}
}
