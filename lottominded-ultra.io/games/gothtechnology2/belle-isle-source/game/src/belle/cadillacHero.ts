import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {applyRealisticMaterials} from './realisticMaterials.ts';

// Reuse the original long-haired, black-suited hero. Vite packages these exact
// repository bytes locally; the model is requested only when the Cadillac loads.
const heroUrl=new URL('../../../../swoop-source/public/exports/rigged-heroes/DS_Man_01.glb',import.meta.url).href;
const hoodieUrl=new URL('../../../../swoop-source/public/exports/rigged-heroes/DS_Hoodie_Woman_01.glb',import.meta.url).href;
let source:Promise<GLTF>|undefined;
let hoodieSource:Promise<GLTF>|undefined;
export function cadillacHeroModel(){
 return source??=new GLTFLoader().loadAsync(heroUrl).then(asset=>{
  applyRealisticMaterials(asset.scene,'actor');return asset;
 }).catch(error=>{source=undefined;throw error;});
}

export function cadillacHoodieDriverModel(){
 return hoodieSource??=new GLTFLoader().loadAsync(hoodieUrl).then(asset=>{
  applyRealisticMaterials(asset.scene,'actor');return asset;
 }).catch(error=>{hoodieSource=undefined;throw error;});
}
