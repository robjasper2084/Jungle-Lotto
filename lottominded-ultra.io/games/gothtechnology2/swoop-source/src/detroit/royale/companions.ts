import type {BattleDog} from '../../../../ride-core/src/royale/dogPower.ts';
import * as T from 'three';import {CompanionView} from '../companionView.ts';
import type {GLTF} from '../compressedGLTFLoader.ts';import type {RidePose} from '../controller.ts';import type {TerrainSampler} from '../terrain.ts';
export const DOG_COATS=['#e8b979','#7d6c60','#ece8d9','#8c4932','#555d65','#cda66d','#afc0ca','#ad7777','#dfcfaa','#404650'] as const;
/** Server-driven companions share each owner's position visibility. They cannot reveal
 * a hidden opponent or cause client-only hits, blocking, pickups or damage. */
export class RoyaleCompanions {
 private dogs=new Map<string,{view:CompanionView;materials:T.Material[];tick:number}>();
 constructor(private scene:T.Scene,private assets:Map<string,GLTF>,private terrain:TerrainSampler){}
 update(actors:readonly {id:string;pose:Omit<RidePose,'seated'>;alive:boolean;dog:BattleDog&{radar?:boolean}}[],roster:readonly {id:string}[],tick:number,delta:number,low:boolean){
  const visible=new Set<string>();
  for(const actor of actors){if(!actor.alive)continue;const pose={...actor.pose,seated:0};visible.add(actor.id);let dog=this.dogs.get(actor.id);
   if(!dog){const view=new CompanionView(this.assets,this.terrain),materials:T.Material[]=[],coat=new T.Color(DOG_COATS[Math.max(0,roster.findIndex(a=>a.id===actor.id))%10]);
    view.model.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;const tint=(source:T.Material)=>{const m=source.clone() as T.MeshStandardMaterial;if(m.color){m.color.set('#ffffff');m.roughness=.88;m.onBeforeCompile=shader=>{shader.uniforms.dogCoat={value:coat};shader.fragmentShader='uniform vec3 dogCoat;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat dogLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));\ndiffuseColor.rgb=mix(diffuseColor.rgb,dogLuma*dogCoat,smoothstep(.08,.18,dogLuma));');};m.customProgramCacheKey=()=> 'royale-dog-coat-1';}materials.push(m);return m;};mesh.material=Array.isArray(mesh.material)?mesh.material.map(tint):tint(mesh.material);});
    view.root.name='Companion of '+actor.id;this.scene.add(view.root);dog={view,materials,tick:-1};this.dogs.set(actor.id,dog);
   }
   dog.view.root.visible=true;
   dog.tick=tick;void delta;
   // The shared dog rig blends idle/walk/trot/run and plants its paws on terrain.
   dog.view.apply({...actor.dog,y:actor.dog.y+(actor.dog.jumpHeight??0),power:actor.dog.mode==='pounce'?'pounce':actor.dog.radar?'radar':undefined});dog.view.reactToRider(pose,actor.dog);
   dog.view.root.traverse(o=>{if((o as T.Mesh).isMesh)o.castShadow=!low;});
  }
  for(const [id,dog]of this.dogs)if(!visible.has(id))dog.view.root.visible=false;
 }
 dispose(){for(const dog of this.dogs.values()){dog.view.mixer.stopAllAction();dog.view.root.removeFromParent();dog.view.model.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)(o as T.SkinnedMesh).skeleton.dispose();});dog.materials.forEach(m=>m.dispose());}this.dogs.clear();}
}



