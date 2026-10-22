import {BattleDogPresentation} from './dogPresentation.ts';
import type {BattleDog} from '../../../../ride-core/src/royale/dogPower.ts';
import * as T from 'three';import {CompanionView} from '../companionView.ts';
import type {GLTF} from '../compressedGLTFLoader.ts';import type {RidePose} from '../controller.ts';import type {TerrainSampler} from '../terrain.ts';
export const DOG_COATS=['#e8b979','#7d6c60','#ece8d9','#8c4932','#555d65','#cda66d','#afc0ca','#ad7777','#dfcfaa','#404650'] as const;
/** Server-driven companions share each owner's position visibility. They cannot reveal
 * a hidden opponent or cause client-only hits, blocking, pickups or damage. */
export class RoyaleCompanions {
 private dogs=new Map<string,{view:CompanionView;tick:number;previous:BattleDog;current:BattleDog;motion:BattleDogPresentation;landing:number;victory:number;low?:boolean}>();
 constructor(private scene:T.Scene,private assets:Map<string,GLTF>,private terrain:TerrainSampler,private prepare?:(root:T.Object3D)=>void){}
 update(actors:readonly {id:string;pose:Omit<RidePose,'seated'>;alive:boolean;dog:BattleDog&{radar?:boolean}}[],roster:readonly {id:string}[],tick:number,delta:number,low:boolean,reduced=false,winner?:string|null,displayTick=tick-3,visibleAt?:(p:{x:number;y:number;z:number})=>boolean){
  const visible=new Set<string>();
  for(const actor of actors){if(!actor.alive)continue;const pose={...actor.pose,seated:0};visible.add(actor.id);let dog=this.dogs.get(actor.id);
   if(!dog){const view=new CompanionView(this.assets,this.terrain),coat=new T.Color(DOG_COATS[Math.max(0,roster.findIndex(a=>a.id===actor.id))%10]);
    view.model.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;const tint=(source:T.Material)=>{const m=source as T.MeshStandardMaterial;if(m.color){m.color.set('#ffffff');m.roughness=.94;m.onBeforeCompile=shader=>{shader.uniforms.dogCoat={value:coat};shader.fragmentShader='uniform vec3 dogCoat;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat dogLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));\ndiffuseColor.rgb=mix(diffuseColor.rgb,dogLuma*dogCoat,smoothstep(.08,.18,dogLuma));');};m.customProgramCacheKey=()=> 'royale-dog-coat-1';}return m;};mesh.material=Array.isArray(mesh.material)?mesh.material.map(tint):tint(mesh.material);});
    view.root.name='Companion of '+actor.id;this.prepare?.(view.root);this.scene.add(view.root);dog={view,tick:-1,previous:{...actor.dog},current:{...actor.dog},motion:new BattleDogPresentation(),landing:0,victory:0};this.dogs.set(actor.id,dog);
   }
   dog.view.root.visible=!visibleAt||visibleAt(actor.dog);if(!dog.view.root.visible)continue;
   const reset=tick<dog.tick||actor.dog.time<dog.current.time||Math.hypot(actor.dog.x-dog.current.x,actor.dog.z-dog.current.z)>3;
   if(reset){dog.previous={...actor.dog};dog.current={...actor.dog};dog.motion=new BattleDogPresentation();dog.landing=0;}
   else if(actor.dog.time!==dog.current.time){dog.previous=dog.current;dog.current={...actor.dog};if((dog.previous.jumpHeight??0)>.01&&(actor.dog.jumpHeight??0)<=.01)dog.landing=1;}
   dog.tick=tick;dog.landing*=Math.exp(-12*Math.max(0,delta));
   const rendered:BattleDog&{sit?:number;gaitSpeed?:number}=dog.motion.sample(actor.dog,tick,displayTick);
   const deceleration=Math.max(-6,Math.min(6,(dog.current.speed-dog.previous.speed)/Math.max(.05,dog.current.time-dog.previous.time)));
   rendered.pitch+=(reduced?0:deceleration*.009);
   rendered.landing=reduced?0:dog.landing;
   dog.victory+=((winner===actor.id?1:0)-dog.victory)*(1-Math.exp(-5*Math.max(0,delta)));
   if(dog.victory>.001){rendered.speed*=1-dog.victory;rendered.gaitSpeed=rendered.speed;rendered.sit=dog.victory;}
   // The shared dog rig blends idle/walk/trot/run and plants its paws on terrain.
   dog.view.apply({...rendered,y:rendered.y+(rendered.jumpHeight??0),power:actor.dog.mode==='pounce'?'pounce':actor.dog.radar?'radar':undefined});dog.view.reactToRider(pose,rendered);
   if(dog.low!==low){dog.low=low;dog.view.root.traverse(o=>{if((o as T.Mesh).isMesh)o.castShadow=!low;});}
  }
  for(const [id,dog]of this.dogs)if(!visible.has(id))dog.view.root.visible=false;
 }
 dispose(){for(const dog of this.dogs.values()){dog.view.dispose();}this.dogs.clear();}
}



