import {PerspectiveCamera,Quaternion,Vector3} from 'three';
import {CAMERA_PROFILE} from './cameraProfile.ts';
const key='digital-static-camera-transitions-v1';
export function cameraTransitionsEnabled(){try{return localStorage.getItem(key)!=='off';}catch{return true;}}
export function mountCameraPreferences(parent:HTMLElement){
  const group=document.createElement('fieldset'),legend=document.createElement('legend'),label=document.createElement('label'),input=document.createElement('input'),note=document.createElement('p');
  legend.textContent='Camera movement';input.type='checkbox';input.checked=cameraTransitionsEnabled();input.style.width='auto';input.style.minHeight='24px';input.onchange=()=>{try{localStorage.setItem(key,input.checked?'on':'off');}catch{}};
  label.append(input,document.createTextNode(' Smooth camera changes'));note.textContent='Shared across all three games. First-person and aiming stay immediate. Reduced motion disables camera blends.';note.style.fontSize='12px';group.append(legend,label,note);parent.append(group);return group;
}
/** Cinemachine-authored blend timing adapted to the browser renderer. The normal
 * riding spring, head motion, and server simulation still own their original poses. */
export class CameraBlend {
  private mode='';private elapsed=1;private eye=new Vector3();private rotation=new Quaternion();private fov=55;
  private fromEye=new Vector3();private fromRotation=new Quaternion();private fromFov=55;
  reset(){this.mode='';}
  apply(camera:PerspectiveCamera,mode:string,dt:number,reduced=false){
    const immediate=reduced||mode==='first'||mode==='ads'||this.mode==='first'||this.mode==='ads'||!this.mode||camera.position.distanceToSquared(this.eye)>900;
    if(mode!==this.mode){this.fromEye.copy(this.eye);this.fromRotation.copy(this.rotation);this.fromFov=this.fov;this.elapsed=0;}
    if(immediate)this.elapsed=CAMERA_PROFILE.blendSeconds;
    this.elapsed=Math.min(CAMERA_PROFILE.blendSeconds,this.elapsed+Math.max(0,Math.min(.1,dt)));
    if(this.elapsed<CAMERA_PROFILE.blendSeconds){const t=this.elapsed/CAMERA_PROFILE.blendSeconds,s=t*t*(3-2*t);camera.position.lerpVectors(this.fromEye,camera.position,s);camera.quaternion.slerpQuaternions(this.fromRotation,camera.quaternion,s);camera.fov=this.fromFov+(camera.fov-this.fromFov)*s;}
    this.mode=mode;this.eye.copy(camera.position);this.rotation.copy(camera.quaternion);this.fov=camera.fov;
  }
}
