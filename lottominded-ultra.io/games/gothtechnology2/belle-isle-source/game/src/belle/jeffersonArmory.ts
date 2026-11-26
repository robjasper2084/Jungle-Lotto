/**
 * Verified-gate, opt-in Jefferson Armory art-study loader.
 * No map, collision, physics, GPS, navigation, or traffic changes.
 * Heights and limestone maps remain ESTIMATES. Source data reuse clearance is pending.
 */
import * as T from 'three';
import type {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export const JEFFERSON_ARMORY=Object.freeze({
 id:'59264442',
 cityObjectId:38712,
 center:[347.303359,-198.411080] as const,
 baseGameY:2,
 file:'Naval_Armory_Jefferson_All_LODs.glb',
 url:'./belle/jefferson-armory/Naval_Armory_Jefferson_All_LODs.glb',
 sha256:'78a24b30d29126e8646aef3eb203199fc23476e23a6f6eb7b2a092f5d5c94f01',
 levelsM:[0,180,480] as const,
 triggerM:750,
 verticalEvidence:'ESTIMATED_GAME_RELATIVE_NOT_SURVEYED',
 originalCollisionHeightM:11.1,
 studyMaximumHeightM:16.3,
});
async function sha256(bytes:ArrayBuffer){
 if(!globalThis.crypto?.subtle)throw Error('Secure SHA-256 required for Jefferson study');
 return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
}
export async function prepareJeffersonArmoryStudy(loader:GLTFLoader, stage:T.Group){
 const response=await fetch(JEFFERSON_ARMORY.url,{cache:'no-store'});
 if(!response.ok)throw Error('Armory preview asset failed HTTP '+response.status);
 const bytes=await response.arrayBuffer();
 if(await sha256(bytes)!==JEFFERSON_ARMORY.sha256)throw Error('Armory study hash mismatch');
 const gltf=await loader.parseAsync(bytes,'./belle/jefferson-armory/');
 const roots=JEFFERSON_ARMORY.levelsM.map((_,i)=>gltf.scene.getObjectByName('LOD'+i));
 if(roots.some(root=>!root||root.children.length===0))throw Error('Armory study must contain all three nonempty LOD roots');
 const lod=new T.LOD();lod.name='JEFFERSON_ARMORY_STUDY__UNSURVEYED_HEIGHT';
 lod.position.set(JEFFERSON_ARMORY.center[0],JEFFERSON_ARMORY.baseGameY,JEFFERSON_ARMORY.center[1]);
 for(const [index,root] of roots.entries()){
  root!.traverse(object=>{
   if(!(object instanceof T.Mesh))return;
   object.geometry.computeBoundingSphere();
   object.receiveShadow=true;
   const materials=Array.isArray(object.material)?object.material:[object.material];
   object.castShadow=!materials.some(m=>m.transparent||m.opacity<1||/glazing|glass/i.test(m.name));
  });
  lod.addLevel(root!,JEFFERSON_ARMORY.levelsM[index],0.12);
 }
 lod.autoUpdate=true;stage.add(lod);
 return {lod,update(x:number,z:number){
  lod.visible=Math.hypot(x-JEFFERSON_ARMORY.center[0],z-JEFFERSON_ARMORY.center[1])<1750;
 }};
}
