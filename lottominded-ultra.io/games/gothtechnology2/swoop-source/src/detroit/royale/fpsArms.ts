import * as T from 'three';
import type {Hero} from '../actors.ts';
import {calibrateLimb,solveAnatomicalLimb,type AnatomicalLimb} from '../../../../ride-core/src/limbIK.ts';

/** Use the selected hero's authored forearms, cuffs and articulated hands.
 * The same shoulder/elbow/wrist IK as the world hero supplies the pose. */
export class FpsArms {
 private masks:T.BufferGeometry[]=[];
 private anatomy:AnatomicalLimb[]=[];
 private limbs:{forearm:T.Object3D;hand:T.Object3D;scale:T.Vector3;handScale:T.Vector3;length:number}[]=[];
  constructor(private hero:Hero,private root:T.Group){
   const full=new Map<T.Mesh,T.BufferGeometry>();hero.rider.traverse(o=>{if(o instanceof T.Mesh)full.set(o,o.geometry);});
  // Choose the same mode used by FirstPersonView before installing fitted
  // sleeve masks; switching modes later would replace these geometries.
  hero.visibility.setFirstPerson(true,true);
  for(const arm of hero.arms){const forearm=arm.knee,hand=arm.foot;
    this.anatomy.push(calibrateLimb(arm,new T.Vector3(0,0,1)));
   this.limbs.push({forearm,hand,scale:forearm.scale.clone(),handScale:hand.scale.clone(),length:hand.position.length()});
  }
   const hands=new Set<T.Object3D>(),armBones=new Set<T.Object3D>();for(const limb of this.limbs)limb.hand.traverse(o=>hands.add(o));for(const arm of hero.arms)arm.upper.traverse(o=>armBones.add(o));
  hero.rider.traverse(o=>{
   if(!(o instanceof T.Mesh))return;o.frustumCulled=false;
   // The source body also contains mitten hands. Keep its real forearms/cuffs,
   // but let the articulated glove supply the fingers without double surfaces.
   if(!(o instanceof T.SkinnedMesh)||/ArticulatedGlove/.test(o.name))return;
    const source=full.get(o)!,index=source.index,skin=source.getAttribute('skinIndex'),weights=source.getAttribute('skinWeight');if(!index||!skin||!weights)return;
    const handVertex=new Uint8Array(skin.count),armVertex=new Uint8Array(skin.count);
    for(let v=0;v<skin.count;v++){let w=0,a=0;for(let i=0;i<4;i++){const bone=o.skeleton.bones[skin.getComponent(v,i)],weight=weights.getComponent(v,i);if(hands.has(bone))w+=weight;if(armBones.has(bone))a+=weight;}handVertex[v]=w>=.5?1:0;armVertex[v]=a>=.35?1:0;}
    const geometry=source.clone(),kept:number[]=[];geometry.clearGroups();
    // At the shoulder seam, remove weights to the hidden torso before moving
    // the view-only arm chain. Otherwise those vertices remain at the chest.
    const fittedWeights=geometry.getAttribute('skinWeight');
    for(let v=0;v<skin.count;v++)if(armVertex[v]){let sum=0;for(let i=0;i<4;i++)if(armBones.has(o.skeleton.bones[skin.getComponent(v,i)]))sum+=weights.getComponent(v,i);
     for(let i=0;i<4;i++)fittedWeights.setComponent(v,i,armBones.has(o.skeleton.bones[skin.getComponent(v,i)])?weights.getComponent(v,i)/sum:0);
    }
   for(const group of source.groups.length?source.groups:[{start:0,count:index.count,materialIndex:0}]){const start=kept.length;
     for(let i=group.start;i<group.start+group.count;i+=3){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);if(armVertex[a]&&armVertex[b]&&armVertex[c]&&handVertex[a]+handVertex[b]+handVertex[c]<2)kept.push(a,b,c);}
    geometry.addGroup(start,kept.length-start,group.materialIndex);
   }
    geometry.setIndex(kept);this.masks.push(geometry);o.geometry=geometry;o.visible=kept.length>0;
  });
 }
 /** Reset view-only bone matrices before the next animation/IK solve. */
 reset(){for(const limb of this.limbs){
  limb.forearm.scale.copy(limb.scale);limb.forearm.matrixAutoUpdate=true;
  limb.hand.scale.copy(limb.handScale);limb.hand.matrixAutoUpdate=true;
 }}
  update(camera:T.Camera,_scale:number,_viewScale:number,_eyeLower=0){
   // Moving only the elbow disconnects vertices weighted to both upper arm
   // and forearm, producing stretched cuffs/spikes. Preserve the complete
   // authored chain and move the whole presentation rig in FirstPersonView.
   const rotation=camera.getWorldQuaternion(new T.Quaternion()),right=new T.Vector3(1,0,0).applyQuaternion(rotation),up=new T.Vector3(0,1,0).applyQuaternion(rotation),forward=new T.Vector3(0,0,-1).applyQuaternion(rotation);
   for(const [i,arm]of this.hero.arms.entries()){
    const wrist=arm.foot.getWorldPosition(new T.Vector3()),grip=arm.foot.getWorldQuaternion(new T.Quaternion()),shoulder=arm.upper.getWorldPosition(new T.Vector3()),elbow=arm.knee.getWorldPosition(new T.Vector3());
    const length=shoulder.distanceTo(elbow)+elbow.distanceTo(wrist),side=i===0?-1:1;
    // Fit the whole chain below the view while retaining each hero's actual
    // bone lengths. The sleeve continues through the elbow, with no cut end.
    const offset=right.clone().multiplyScalar(side*.28).addScaledVector(up,-.92).addScaledVector(forward,-.26).normalize().multiplyScalar(length*.94);
    arm.upper.position.copy(arm.upper.parent!.worldToLocal(wrist.clone().add(offset)));
    arm.upper.updateWorldMatrix(true,true);
    solveAnatomicalLimb(arm,wrist,right.clone().multiplyScalar(side*.35).addScaledVector(up,-1),this.anatomy[i],grip,.995);
   }
   this.root.updateMatrixWorld(true);
 }
 dispose(){this.reset();for(const geometry of this.masks)geometry.dispose();}
}
