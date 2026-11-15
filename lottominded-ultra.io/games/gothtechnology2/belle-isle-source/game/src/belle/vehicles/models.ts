import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {batchRigidChildren} from '../coop/batchRigid.ts';
import {isCockpitPresentationMesh} from './cockpitPresentation.ts';
import {JetsonCockpitController} from './vendor/JetsonCockpitController.js';
import {JetsonVariantSystem} from './vendor/JetsonVariantSystem.js';
import {corleoGaitClips} from './corleoMotion.ts';
import {createCorleoActions,loadCorleoActions} from './corleoActions.ts';
import {corleoDashboard} from './corleoDashboard.ts';
import {fitCorleoRider} from './corleoFit.ts';
import type {AuthoredChoice} from './choices.ts';
import type {HoverPose} from '../hoverController.ts';
const files={
 'jetson-one.glb':'ff1430525309ce62224c765d755bd77907df78bb9ea2207501ace7d17f7063af',
 'pilot-professional.glb':'679c53bacd02a366dcd011eb634bbb13fac97535eca455a1762c94e4465bfd37',
 'pilot-maverick.glb':'48a260626075859ee44de93f3b1beaf42dad62627ebda479d6cbc7356c180c6e',
 'corleo-professional.glb':'eb403561533a708ae203d3d4b668519b7dd4eec6c9adbc4e347613b87de52dd7',
 'corleo-maverick.glb':'eb1e40edbacd44053ae6ede7a53e91c0b0682bb12fc240b97af5aa14b79d0c49',
} as const;
const cache=new Map<string,Promise<GLTF>>();
async function asset(file:keyof typeof files){
 let task=cache.get(file);if(!task){task=(async()=>{
  const url=T.DefaultLoadingManager.resolveURL(new URL('./belle/vehicles/'+file,document.baseURI).href);
  const response=await fetch(url,{credentials:'omit'});if(!response.ok)throw Error('Vehicle model unavailable: '+file);
  const bytes=await response.arrayBuffer(),sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  if(sha!==files[file])throw Error('Vehicle integrity check failed: '+file);
  return new GLTFLoader().parseAsync(bytes,'');
 })();cache.set(file,task);task.catch(()=>cache.delete(file));}return task;
}
export type VehicleModel={root:T.Group;rider:T.Object3D;choice:AuthoredChoice;eye:(out:T.Vector3)=>T.Vector3;firstPerson:(value:boolean)=>void;update:(pose:HoverPose,dt:number,running:boolean,power:number,energy:number,lights?:boolean,brake?:boolean)=>void;dispose:()=>void};
export async function createVehicleModel(choice:AuthoredChoice,signal?:AbortSignal):Promise<VehicleModel>{
 const check=()=>{if(signal?.aborted)throw signal.reason??new DOMException('Vehicle preparation cancelled','AbortError');};check();
 const source=await asset(choice.vehicle==='jetson'?'jetson-one.glb':`corleo-${choice.pilot}.glb`);check();
 const model=clone(source.scene),root=new T.Group();root.name=choice.vehicle+' · '+choice.pilot;root.userData.vehicleChoice={...choice};root.add(model);
 const materials=new Map<T.Material,T.Material>(),skeletons=new Set<T.Skeleton>();
 // The solo controller owns one pre-warmed scene light. Showcase lights are
 // removed from these instances so neither selection nor remote arrivals can
 // change the island's light topology or force a full-scene shader rebuild.
 const showcaseLights:T.Object3D[]=[];
 model.traverse(o=>{const mesh=o as T.Mesh;if((o as T.Light).isLight)showcaseLights.push(o);if((o as T.SkinnedMesh).isSkinnedMesh)skeletons.add((o as T.SkinnedMesh).skeleton);if(!mesh.isMesh)return;mesh.castShadow=false;mesh.receiveShadow=true;const own=(m:T.Material)=>{let c=materials.get(m);if(!c){c=m.clone();materials.set(m,c);}return c;};mesh.material=Array.isArray(mesh.material)?mesh.material.map(own):own(mesh.material);});
 showcaseLights.forEach(light=>light.removeFromParent());
 let variants:JetsonVariantSystem|undefined,cockpit:JetsonCockpitController|undefined,mixer:T.AnimationMixer|undefined,batches:ReturnType<typeof batchRigidChildren>|undefined;
 let disposed=false,displayClock=0;let rider:T.Object3D=model,head:T.Object3D|undefined;const heads:T.Object3D[]=[];
 const dispose=()=>{if(disposed)return;disposed=true;root.removeFromParent();mixer?.stopAllAction();mixer?.uncacheRoot(model);batches?.dispose();variants?.dispose();cockpit?.dispose();for(const s of skeletons)s.dispose();for(const m of materials.values())m.dispose();};
 try{
  let actions:T.AnimationAction[]=[],corleoActions:ReturnType<typeof createCorleoActions>|undefined,dashboard:ReturnType<typeof corleoDashboard>|undefined,fit:ReturnType<typeof fitCorleoRider>|undefined;
  if(choice.vehicle==='jetson'){
   cockpit=new JetsonCockpitController(T,model,{PilotID:choice.pilot,LiveryID:choice.livery});
   variants=new JetsonVariantSystem(T,model,{PilotID:choice.pilot,LiveryID:choice.livery,cloneSkinned:clone,cockpitController:cockpit,loadPilot:(id:string)=>asset(id==='maverick'?'pilot-maverick.glb':'pilot-professional.glb')});await variants.ready;check();
   model.traverse(o=>{if(o.userData.jetson_pilot_instance)rider=o;});
  }else{
   // Blender +Y forward exports to glTF -Z; Belle Isle moves along local +Z.
   model.rotation.y=Math.PI;
   const clip=source.animations[0];if(!clip)throw Error('CORLEO gait animation is missing');
   mixer=new T.AnimationMixer(model);actions=Object.values(corleoGaitClips(clip)).map(c=>mixer!.clipAction(c).play());actions.forEach((a,i)=>a.setEffectiveWeight(i===0?1:0));mixer.update(0);
   const armature=model.getObjectByName(`CR_${choice.pilot==='professional'?'Professional':'Maverick'}_Pilot_Armature`);if(!armature?.parent)throw Error('CORLEO pilot rig is missing');rider=armature.parent;
   fit=fitCorleoRider(model);
   mixer.stopAllAction();mixer.uncacheRoot(model);
   corleoActions=createCorleoActions(model,clip,await loadCorleoActions(choice.pilot));check();mixer=corleoActions.mixer;
   dashboard=corleoDashboard(model);
  }
  model.traverse(o=>{if(o.userData.first_person_hidden)heads.push(o);if((o as T.Bone).isBone&&/head$/i.test(o.name))head=o;});
  // Preserve cockpit targets, head visibility, skeletons, and all animated nodes.
  const animated=new Set(source.animations.flatMap(a=>a.tracks.map(t=>t.name.split('.')[0])));model.traverse(o=>{if(/CTRL|Socket|Attach|Display|Screen|Rotor|Pilot|Head|Helmet|CR_HUD|FixedGrip|StirrupPlate/i.test(o.name)||o.userData.first_person_hidden)animated.add(o.name);});
  corleoActions?.animatedNodes.forEach(name=>animated.add(name));
   // The live Jetson dashboard and cockpit controls must remain attached: the
   // cockpit controller retains their original node references for updates.
   batches=batchRigidChildren(model,animated,choice.vehicle==='jetson'?(mesh)=>isCockpitPresentationMesh(mesh,model):undefined);
  const lamps=[...materials.values()].filter((m):m is T.MeshStandardMaterial=>m instanceof T.MeshStandardMaterial&&/Front white position lamp|CR_Headlamp|CR_RearLamp/.test(m.name)).map(material=>({material,intensity:material.emissiveIntensity}));
  root.updateMatrixWorld(true);
  return {root,rider,choice:{...choice},eye(out){root.updateMatrixWorld(true);return head?head.getWorldPosition(out).add(new T.Vector3(0,.07,0)):out.set(root.position.x,root.position.y+(choice.vehicle==='corleo'?2.1:1.25),root.position.z);},
   firstPerson(value){variants?.setFirstPerson(value);heads.forEach(o=>o.visible=!value);},
   update(p,dt,running,power,energy,lights=true,brake=false){
    root.userData.corleoAction=p.corleoAction;root.userData.corleoTime=p.corleoTime;root.userData.corleoPhase=p.corleoPhase;
    root.position.set(p.x,p.y-(choice.vehicle==='corleo'?.18:0),p.z);root.rotation.set(p.pitch,p.heading,p.roll,'YXZ');
    const delta=running?Math.min(.1,Math.max(0,dt)):0;
    if(cockpit){displayClock+=delta;const context=cockpit.context;if(displayClock<.1)cockpit.context=null;else displayClock%=.1;
     cockpit.update({pitch:-p.pitch*3,roll:p.roll*3,yaw:0,power:Math.max(0,Math.min(1,p.rpm*.75+power*.2)),battery_level:energy,attitude_pitch_deg:p.pitch*180/Math.PI,attitude_roll_deg:p.roll*180/Math.PI,flight_mode:p.rpm>.1?1:0},delta);cockpit.context=context;variants?.update(delta);
    }
    if(corleoActions)fit?.update(corleoActions.update(p,delta));
    lamps.forEach(({material,intensity})=>material.emissiveIntensity=lights?intensity:0);
    dashboard?.(p,power,lights,brake);
   },dispose};
 }catch(error){dispose();throw error;}
}
