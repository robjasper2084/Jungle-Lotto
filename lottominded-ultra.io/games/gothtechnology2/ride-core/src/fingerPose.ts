import {Quaternion,type Object3D,type AnimationClip} from 'three';
import {templateFinger} from './templateActions.ts';
export type HandPose='Relaxed'|'WeaponGrip'|'SupportGrip'|'MeleeFist'|'ReloadRelease';
/** Play only finger rotations from the Blender-authored additive hand clips.
 * Body/arm IK owns every other joint, so holding a gun never freezes footwork. */
export class FingerPose {
 private joints:{bone:Object3D;side:string;rest:Quaternion;poses:Partial<Record<HandPose,Quaternion>>}[]=[];
 constructor(root:Object3D,clips:AnimationClip[]){
  root.traverse(bone=>{const match=/^(Left|Right)Hand(?:Index|Middle|Ring|Pinky|Thumb)[123]$/.exec(bone.name);if(!match)return;
   const poses:Partial<Record<HandPose,Quaternion>>={};
   for(const clip of clips){if(!clip.name.startsWith('Hand_'))continue;const track=clip.tracks.find(t=>t.name===bone.name+'.quaternion');if(track)poses[clip.name.slice(5) as HandPose]=new Quaternion().fromArray(track.values,track.values.length-4).normalize();}
   this.joints.push({bone,side:match[1],rest:bone.quaternion.clone(),poses});
  });
 }
 get jointCount(){return this.joints.length;}
 /** Retarget the template's grip muscles to each glove's authored curl axis. */
 applyTemplateGrip(){
  for(const j of this.joints){if(j.side!=='Right'||!j.poses.WeaponGrip)continue;
   const match=/Hand(Index|Middle|Ring|Pinky|Thumb)([123])$/.exec(j.bone.name);if(!match)continue;
   const stretch=templateFinger(match[1],Number(match[2]));
   const curl=Math.max(.25,Math.min(1.15,(1-stretch)*.68));
   j.bone.quaternion.copy(j.poses.Relaxed??j.rest).slerp(j.poses.WeaponGrip,curl);
  }
 }
 apply(left:HandPose='Relaxed',right:HandPose=left,release=0){
  for(const j of this.joints){const pose=j.side==='Left'?left:right;j.bone.quaternion.copy(j.poses[pose]??j.rest);
   if(j.side==='Left'&&release>0&&j.poses.ReloadRelease)j.bone.quaternion.slerp(j.poses.ReloadRelease,Math.max(0,Math.min(1,release)));
  }
 }
}
