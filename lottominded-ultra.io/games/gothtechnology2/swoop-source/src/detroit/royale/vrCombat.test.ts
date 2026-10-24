import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {RoyaleVR} from './vrCombat.ts';
import {createPose} from '../../../../ride-core/src/controller.ts';

test('Royale XR origin preserves physical head pose, avoids facing feedback, and restores flat view',async()=>{
 const savedDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),savedSecure=Object.getOwnPropertyDescriptor(globalThis,'isSecureContext'),savedXR=Object.getOwnPropertyDescriptor(navigator,'xr');
 class Element {textContent='';disabled=false;children:unknown[]=[];setAttribute(){}append(...children:unknown[]){this.children.push(...children);}getContext(){return {clearRect(){},fillRect(){},fillText(){}};}}
 Object.defineProperty(globalThis,'document',{value:{createElement:()=>new Element()},configurable:true});Object.defineProperty(globalThis,'isSecureContext',{value:true,configurable:true});
 const session=Object.assign(new EventTarget(),{visibilityState:'visible',inputSources:[],end:async()=>{xr.isPresenting=false;session.dispatchEvent(new Event('end'));}});
 const service=Object.assign(new EventTarget(),{isSessionSupported:async()=>true,requestSession:async()=>session});Object.defineProperty(navigator,'xr',{value:service,configurable:true});
 const grips=[new T.Group(),new T.Group()],rays=[new T.Group(),new T.Group()];
 const xr={enabled:false,isPresenting:false,getControllerGrip:(i:number)=>grips[i],getController:(i:number)=>rays[i],setReferenceSpaceType(){},setFramebufferScaleFactor(){},setFoveation(){},setSession:async()=>{xr.isPresenting=true;},getReferenceSpace:()=>({})};
 const renderer={xr,shadowMap:{enabled:true}},scene=new T.Scene(),camera=new T.PerspectiveCamera(76,1,.12,1000);scene.add(camera);camera.position.set(5,6,7);camera.rotation.set(.1,.2,.3);const oldQ=camera.quaternion.clone();let entered=0,exited=0,paused=0;
 const vr=new RoyaleVR(renderer as unknown as T.WebGLRenderer,scene,camera,new Element() as unknown as HTMLElement,{ready:()=>true,enter:()=>entered++,exit:()=>exited++,pause:()=>paused++,unlock(){}});
 try{
  await vr.check();assert(!vr.button.disabled);await vr.toggle();assert(vr.active&&entered===1);assert.equal(renderer.shadowMap.enabled,false);
  const q=new T.Quaternion().setFromEuler(new T.Euler(.2,.1,-.08)),frame={getViewerPose:()=>({transform:{position:{x:.3,y:1.65,z:.2},orientation:q}})} as unknown as XRFrame;
  const p={...createPose(),x:120,y:3,z:240,headingY:.7,footMode:2};vr.update(p,1.7,frame);
  assert(camera.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(120,4.7,240))<1e-6);assert(camera.quaternion.angleTo(q)<1e-7);
  const heading=vr.origin.rotation.y;vr.update({...p,headingY:1.9,rollAngle:.8,crashBlend:1},1.7,frame);assert.equal(vr.origin.rotation.y,heading,'aim/fall must not spin the VR room');assert.equal(vr.origin.rotation.z,0);
  vr.snap(Math.PI/6);vr.update(p,1.7,frame);assert(Math.abs(vr.origin.rotation.y-heading-Math.PI/6)<1e-6);
  session.visibilityState='hidden';session.dispatchEvent(new Event('visibilitychange'));assert.equal(paused,1);assert(!vr.poll().fire);
  await vr.toggle();assert(!vr.active&&exited===1);assert.equal(camera.parent,scene);assert.deepEqual(camera.position.toArray(),[5,6,7]);assert(camera.quaternion.angleTo(oldQ)<1e-7);assert.equal(camera.near,.12);assert(renderer.shadowMap.enabled);
 }finally{
  vr.dispose();if(savedDocument)Object.defineProperty(globalThis,'document',savedDocument);else Reflect.deleteProperty(globalThis,'document');if(savedSecure)Object.defineProperty(globalThis,'isSecureContext',savedSecure);else Reflect.deleteProperty(globalThis,'isSecureContext');if(savedXR)Object.defineProperty(navigator,'xr',savedXR);else Reflect.deleteProperty(navigator,'xr');
 }
});
