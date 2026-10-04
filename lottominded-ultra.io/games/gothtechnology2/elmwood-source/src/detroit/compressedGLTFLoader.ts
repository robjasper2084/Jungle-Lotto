import {GLTFLoader as BaseGLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import type {LoadingManager} from 'three';
export type {GLTF} from 'three/addons/loaders/GLTFLoader.js';

/** Accept both original preview models and losslessly compressed Pages models. */
export class GLTFLoader extends BaseGLTFLoader {
 constructor(manager?:LoadingManager){super(manager);this.setMeshoptDecoder(MeshoptDecoder);}
}
