import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {BelleVR} from './vr.ts';import {createPose} from '../../runtime/ride-core/src/controller.ts';

// Lifecycle/coordinate tests use real Three objects and simulated XR events.
// They cannot establish headset rendering, controller ergonomics or frame rate.
test('Belle Isle VR session lifecycle, tracked origin and interrupted inputs',async t=>{
 const names=['document','window','navigator','isSecureContext'] as const,originals=names.map(n=>Object.getOwnPropertyDescriptor(globalThis,n));
 const elements=new Map<string,any>();
 const context={clearRect(){},fillRect(){},fillText(){},font:'',fillStyle:''};
 const doc:any=new EventTarget();doc.createElement=()=>({width:0,height:0,getContext:()=>context});doc.getElementById=(id:string)=>{if(!elements.has(id))elements.set(id,{textContent:'',disabled:true,onclick:null});return elements.get(id);};
 const win=new EventTarget(),pose=createPose();Object.assign(pose,{x:10,y:2,z:30,headingY:.7});
 const pads=['left','right'].map(handedness=>({handedness,gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:Array.from({length:6},()=>({pressed:false,value:0}))}}));
 const session:any=new EventTarget();session.visibilityState='visible';session.inputSources=pads;
 const grips=[new T.Group(),new T.Group()],rays=[new T.Group(),new T.Group()];
 const xr:any=new T.EventDispatcher();xr.isPresenting=false;xr.cameraAutoUpdate=true;xr.enabled=false;
 xr.setReferenceSpaceType=(s:string)=>assert.equal(s,'local-floor');xr.setFramebufferScaleFactor=()=>{};xr.setFoveation=()=>{};
 xr.getControllerGrip=(i:number)=>grips[i];xr.getController=(i:number)=>rays[i];xr.getSession=()=>session;xr.getReferenceSpace=()=>({});xr.updateCamera=()=>{};
 xr.setSession=async()=>{xr.isPresenting=true;};session.end=async()=>{xr.isPresenting=false;session.dispatchEvent(new Event('end'));xr.dispatchEvent({type:'sessionend'});};
 const nav:any={xr:{isSessionSupported:async()=>true,requestSession:async(mode:string,options:any)=>{assert.equal(mode,'immersive-vr');assert.deepEqual(options.requiredFeatures,['local-floor']);return session;},addEventListener(){}}};
 for(const [i,value]of [doc,win,nav,true].entries())Object.defineProperty(globalThis,names[i],{configurable:true,value});
 let enters=0,exits=0,clears=0,travel=0,blocked=false;
 const renderer:any={xr,shadowMap:{enabled:true}},scene=new T.Scene(),camera=new T.PerspectiveCamera();scene.add(camera);
 const terrain:any={raycastObstacle:()=>blocked?0:null};
 const vr=new BelleVR(renderer,scene,camera,terrain,{ready:()=>true,pose:()=>pose,enter:()=>enters++,exit:()=>exits++,clear:()=>clears++,places:()=>[{label:'Aquarium',go:()=>travel++}]});
 const frame:any={getViewerPose:()=>({transform:{position:{x:1,y:1.65,z:2},orientation:{x:0,y:0,z:0,w:1}}})};
 const press=(hand:number,key:number,on:boolean)=>pads[hand].gamepad.buttons[key]={pressed:on,value:+on};
 try{
  await Promise.resolve();
  await t.test('entry attaches a floor origin; exit restores camera, shadows and controls once',async()=>{
   await elements.get('enter-vr').onclick();assert(vr.active);assert.equal(enters,1);assert(camera.parent===vr.rig);assert.equal(renderer.shadowMap.enabled,false);assert.equal(xr.cameraAutoUpdate,false);
   vr.poll(frame);vr.update(pose,1/90);const head=new T.Vector3(1,1.65,2).applyMatrix4(vr.rig.matrixWorld);assert(Math.abs(head.x-pose.x)<1e-6);assert(Math.abs(head.z-pose.z)<1e-6);assert(Math.abs(head.y-3.65)<1e-6);
   pose.rollAngle=1;pose.groundPitch=.6;pose.airHeight=1;pose.y=3;vr.update(pose,1/90);assert.equal(vr.rig.rotation.x,0);assert.equal(vr.rig.rotation.z,0);assert.equal(vr.rig.position.y,2);
   await session.end();assert(!vr.active);assert.equal(exits,1);assert(camera.parent===scene);assert(renderer.shadowMap.enabled);assert(xr.cameraAutoUpdate);
  });
  Object.assign(pose,{y:2,airHeight:0,rollAngle:0,groundPitch:0});await elements.get('enter-vr').onclick();vr.poll(frame);
  await t.test('menu selection cannot inherit its held button and mount survives a zero-step frame',()=>{
   pads[0].gamepad.axes[3]=1;vr.poll(frame);pads[0].gamepad.axes[3]=0;vr.poll(frame); // select Mount
   press(1,4,true);vr.poll(frame);vr.consumed(1);assert.equal(vr.poll(frame).dismount,undefined); // Menu frame cannot consume an action it has not dispatched.
   press(1,4,false);let a=vr.poll(frame);assert(a.dismount);vr.consumed(0);assert(vr.poll(frame).dismount);vr.consumed(1);assert(!vr.poll(frame).dismount);
  });
  await t.test('focus loss pauses, discards queued actions and requires a fresh neutral sample',()=>{
   press(0,4,true);assert(vr.poll(frame).recover);win.dispatchEvent(new Event('blur'));assert(vr.suspended);assert.equal(vr.poll(frame).recover,undefined);press(0,4,false);vr.poll(frame);
   press(0,5,true);vr.poll(frame);press(0,5,false);assert(!vr.poll(frame).recover);assert(clears>0);
  });
  await t.test('walking follows tracked heading and snap turn without feeding heading back into the origin',()=>{
   pose.footMode=2;vr.poll(frame);const a=vr.poll(frame);assert(Math.abs(a.facingYaw!-.7)<1e-6);
   pads[1].gamepad.axes[2]=1;const b=vr.poll(frame);assert(Math.abs(b.facingYaw!-(.7-Math.PI/6))<1e-6);pose.headingY=b.facingYaw!;vr.update(pose,1/90);assert(Math.abs(vr.poll(frame).facingYaw!-b.facingYaw!)<1e-6);
   pads[1].gamepad.axes[2]=0;vr.poll(frame);
  });
  await t.test('physical head offset into a wall suspends movement; a recovered pose remains stable',()=>{
   frame.getViewerPose=()=>({transform:{position:{x:1.5,y:1.65,z:2},orientation:{x:0,y:0,z:0,w:1}}});blocked=true;assert.deepEqual(vr.poll(frame),{});assert(vr.suspended);blocked=false;assert(vr.poll(frame).facingYaw!==undefined);
  });
  await t.test('tracking loss opens the guide and source loss cannot leave movement held',()=>{
   const tracked=frame.getViewerPose;frame.getViewerPose=()=>null;assert.deepEqual(vr.poll(frame),{});assert(vr.suspended);frame.getViewerPose=tracked;vr.poll(frame);
   session.inputSources=[pads[0]];session.dispatchEvent(new Event('inputsourceschange'));vr.poll(frame);assert(vr.suspended);session.inputSources=pads;vr.poll(frame);
  });
  await session.end();
  await t.test('failed session setup restores the desktop state and offers a retry',async()=>{
   xr.setSession=async()=>{throw Error('XR layer rejected');};await elements.get('enter-vr').onclick();assert(!vr.active);assert(camera.parent===scene);assert(renderer.shadowMap.enabled);assert(xr.cameraAutoUpdate);assert.match(elements.get('vr-status').textContent,/XR layer rejected/);assert.equal(elements.get('enter-vr').disabled,false);
  });
  assert.equal(travel,0); // No travel action is accidentally dispatched by unrelated inputs.
 }finally{for(const [i,name]of names.entries()){const d=originals[i];if(d)Object.defineProperty(globalThis,name,d);else delete (globalThis as any)[name];}}
});
