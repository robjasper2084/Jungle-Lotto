import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {gunzipSync} from 'fflate';
import manifest from '../../../public/belle/vehicles/corleo/manifest.json' with {type:'json'};
import {inPlaceCorleoClip,disposeCorleoModel} from '../corleoAnimation.ts';
import {corleoGaitClips} from './corleoMotion.ts';
import {CORLEO_TRANSITION_SECONDS,type CorleoAction} from './corleoState.ts';
import type {HoverPose} from '../hoverController.ts';
import {createHorseGait} from './corleoHorseGait.ts';
type Clips=Record<'MOUNT'|'RUN'|'CRAWL'|'JUMP'|'DISMOUNT',T.AnimationClip>;
const cache=new Map<string,Promise<Clips>>();
const digest=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(bytes).buffer)),v=>v.toString(16).padStart(2,'0')).join('');
/** The original lossless animation packages supply clips; the fitted model stays shared. */
export function loadCorleoActions(pilot:'professional'|'maverick'){
 let task=cache.get(pilot);if(!task){task=(async()=>{
  const style=pilot==='professional'?'Professional':'Maverick',clips={} as Clips;
  await Promise.all((['MOUNT','RUN','CRAWL','JUMP','DISMOUNT'] as const).map(async action=>{
   const entry=manifest.files.find(file=>file.animation==='CORLEO_'+style+'_'+action);if(!entry)throw Error('CORLEO action receipt missing');
   const url=new URL('./belle/vehicles/corleo/'+entry.packed.name,document.baseURI);
   const response=await fetch(url,{credentials:'omit'});if(!response.ok)throw Error('CORLEO action unavailable: '+action);
   const packed=new Uint8Array(await response.arrayBuffer());
   const compressed=packed[0]===0x1f&&packed[1]===0x8b;
   if(compressed&&(packed.length!==entry.packed.size||await digest(packed)!==entry.packed.sha256))throw Error('CORLEO packed action integrity failed: '+action);
   const bytes=compressed?gunzipSync(packed):packed;
   if(bytes.length!==entry.size||await digest(bytes)!==entry.sha256)throw Error('CORLEO action integrity failed: '+action);
   const gltf=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'');
   try{const clip=gltf.animations.find(c=>c.name===entry.animation);if(!clip)throw Error('CORLEO action animation missing: '+action);clips[action]=inPlaceCorleoClip(clip,action==='JUMP');}finally{disposeCorleoModel(gltf.scene);}
  }));return clips;
 })();cache.set(pilot,task);task.catch(()=>cache.delete(pilot));}return task;
}
export function createCorleoActions(model:T.Object3D,source:T.AnimationClip,clips:Clips){
 const mixer=new T.AnimationMixer(model),gaits=corleoGaitClips(source);
 const library:Record<CorleoAction,T.AnimationClip>={IDLE:gaits.idle,WALK:gaits.walk,TROT:gaits.trot,...clips};
 const actions=new Map<CorleoAction,T.AnimationAction>();
 for(const [name,sourceClip]of Object.entries(library)){
  const clip=sourceClip.clone();clip.tracks=clip.tracks.filter(track=>!/^CR_HUD|Display|Indicator/i.test(track.name)&&!track.name.endsWith('.scale')&&track.name!=='CR_Root.quaternion'&&!!model.getObjectByName(track.name.split('.')[0]));
  const action=mixer.clipAction(clip).play();action.setEffectiveWeight(0);action.setEffectiveTimeScale(0);actions.set(name as CorleoAction,action);
 }
 const horse=createHorseGait(model);let current:CorleoAction|undefined;
 return {mixer,animatedNodes:new Set([...actions.values()].flatMap(action=>action.getClip().tracks.map(track=>track.name.split('.')[0]))),update(p:HoverPose,dt=1/60){
  const name=p.corleoAction??(Math.abs(p.speed)>.05?'WALK':'IDLE'),action=actions.get(name)!;
  if(current!==name){for(const a of actions.values())a.setEffectiveWeight(a===action?1:0);current=name;}
  const seconds=p.corleoTime??0,duration=action.getClip().duration;
  const transition=name==='MOUNT'||name==='DISMOUNT';
  const time=transition?seconds/CORLEO_TRANSITION_SECONDS*duration:name==='JUMP'?seconds/(2*3.2/9.81)*duration:seconds*(name==='IDLE'?1:Math.min(2.5,Math.abs(p.speed)/(name==='CRAWL'?.22:1.7835)));
  action.time=transition||name==='JUMP'?Math.min(duration-.00001,Math.max(0,time)):((time%duration)+duration)%duration;
  mixer.update(0);horse.update(p,dt);return !transition;
 }};
}
