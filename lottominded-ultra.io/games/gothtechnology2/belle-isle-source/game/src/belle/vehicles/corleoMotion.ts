import {AnimationClip,AnimationUtils} from 'three';
/** The source clip is a showcase with world travel. Host physics owns all travel. */
export function corleoGaitClips(source:AnimationClip){
 const local=source.clone();local.tracks=local.tracks.filter(t=>!/^CR_Root\.(position|quaternion)$/.test(t.name)&&!/^CR_HUD|Display|Indicator/i.test(t.name));
 return {
  idle:AnimationUtils.subclip(local,'Corleo idle',0,59,30),
  walk:AnimationUtils.subclip(local,'Corleo walk',60,149,30),
  trot:AnimationUtils.subclip(local,'Corleo trot',150,239,30),
 };
}
