import * as T from 'three';
import {GLTFLoader} from './compressedGLTFLoader.ts';
import {HeroDetail} from '../../../ride-core/src/heroDetail.ts';
import {RiderWardrobe,baseRiderId} from '../../../ride-core/src/riderWardrobe.ts';

/** Load only the requested rider, on demand. Closing releases the extra context. */
export async function inspectWardrobe(id:string,label:string){
 const dialog=document.createElement('dialog');dialog.className='wardrobe-preview';
 const title=document.createElement('h2');title.textContent=label;
 const stage=document.createElement('div');stage.className='wardrobe-preview-stage';
 const status=document.createElement('p');status.role='status';status.textContent='Loading suit…';
 const controls=document.createElement('div');controls.className='wardrobe-preview-controls';
 const left=document.createElement('button'),right=document.createElement('button'),close=document.createElement('button');
 left.textContent='Rotate left';right.textContent='Rotate right';close.textContent='Close';
 for(const button of [left,right,close])button.type='button';
 controls.append(left,right,close);dialog.append(title,stage,status,controls);document.body.append(dialog);dialog.showModal();close.focus();
 let disposed=false,renderer:T.WebGLRenderer|undefined,model:T.Object3D|undefined,wardrobe:RiderWardrobe|undefined,detail:HeroDetail|undefined,frame=0;
 const ownedTextures=new Set<T.Texture>();
 function cleanup(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);wardrobe?.dispose();detail?.dispose();if(model){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();model.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);}}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of ownedTextures)t.dispose();}renderer?.dispose();renderer?.forceContextLoss();dialog.remove();}
 close.onclick=()=>dialog.close();dialog.addEventListener('close',cleanup,{once:true});
 dialog.addEventListener('keydown',e=>e.stopPropagation());dialog.addEventListener('keyup',e=>e.stopPropagation());
 left.onclick=()=>{if(model)model.rotation.y+=Math.PI/6;};right.onclick=()=>{if(model)model.rotation.y-=Math.PI/6;};
 try{
  const gltf=await new GLTFLoader().loadAsync('/exports/rigged-heroes/'+baseRiderId(id)+'.glb');model=gltf.scene;
  model.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])for(const value of Object.values(m))if(value instanceof T.Texture)ownedTextures.add(value);});
  if(disposed){disposed=false;cleanup();return;}
  if(gltf.animations[0]){const mixer=new T.AnimationMixer(model);mixer.clipAction(gltf.animations[0]).play();mixer.setTime(0);}
  model.updateWorldMatrix(true,true);detail=new HeroDetail(model);wardrobe=new RiderWardrobe(model,id);
  const scene=new T.Scene();scene.background=new T.Color('#15222d');scene.add(new T.HemisphereLight('#deefff','#52515a',2.1));
  const key=new T.DirectionalLight('#ffedcf',3.0);key.position.set(3,4,5);scene.add(key);
  const rim=new T.DirectionalLight('#71b8dc',1.4);rim.position.set(-3,2,-2);scene.add(rim);
  const bounds=new T.Box3().setFromObject(model),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
  const pivot=new T.Group();model.position.sub(center);pivot.add(model);scene.add(pivot);
  // Rotate around the fitted character's center, without altering its skeleton.
  let manual=false;left.onclick=()=>{manual=true;pivot.rotation.y+=Math.PI/6;};right.onclick=()=>{manual=true;pivot.rotation.y-=Math.PI/6;};
  const camera=new T.PerspectiveCamera(35,1,.05,40);const radius=Math.max(size.y,size.x*1.25);camera.position.set(0,0,radius*1.95);camera.lookAt(0,0,0);
  renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(1);renderer.setSize(320,360);camera.aspect=320/360;camera.updateProjectionMatrix();renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;stage.append(renderer.domElement);
  status.textContent='Use Rotate to inspect the helmet, armor and boots.';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let previous=0;
  const render=(now:number)=>{if(disposed)return;frame=requestAnimationFrame(render);if(now-previous<66||document.hidden)return;const dt=Math.min(.1,(now-previous)/1000);previous=now;if(!reduced.matches&&!manual)pivot.rotation.y+=dt*.18;renderer!.render(scene,camera);};frame=requestAnimationFrame(render);
 }catch(error){status.textContent='Preview could not load. Close and try again; your selected suit is saved.';console.warn('Suit preview unavailable',error);}
}
