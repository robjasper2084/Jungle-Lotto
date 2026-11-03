import {GLTFLoader as BaseGLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import type {LoadingManager} from 'three';
import {makeTextureBudget} from './renderBudget.ts';
import {startupTextureBudget} from './sharedGraphicsQuality.ts';
import {mobileRiderUrl} from './mobileRiderUrl.ts';
export type {GLTF} from 'three/addons/loaders/GLTFLoader.js';

/** Accept both original preview models and losslessly compressed Pages models. */
export class GLTFLoader extends BaseGLTFLoader {
 override async loadAsync(url:string,onProgress?:(event:ProgressEvent)=>void){
  const limits=startupTextureBudget(),mobileUrl=mobileRiderUrl(url,limits.mobile,limits.maxSize);
  try{return await super.loadAsync(mobileUrl,onProgress);}catch(error){if(mobileUrl===url)throw error;return super.loadAsync(url,onProgress);}
 }
 constructor(manager?:LoadingManager){super(manager);this.setMeshoptDecoder(MeshoptDecoder);
  const budget=makeTextureBudget({retainOriginals:false});
  // Budget all loaded models, including unselected heroes retained in the asset
  // library. Waiting for scene traversal leaves their decoded textures unbounded.
  this.register(()=>({name:'DigitalStaticMobileTextures',afterRoot:async result=>{const limits=startupTextureBudget();if(limits.mobile)for(const scene of result.scenes)budget(scene,limits.maxSize);}}));
 }
}
