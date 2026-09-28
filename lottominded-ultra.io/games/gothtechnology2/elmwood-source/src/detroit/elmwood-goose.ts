import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
let source:Promise<T.Group>|undefined;
export function loadElmwoodGoose(){
 return source??=new GLTFLoader().loadAsync('/elmwood/models/canada-goose.glb').then(g=>{
  g.scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=o.receiveShadow=true;const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials)if(m instanceof T.MeshStandardMaterial&&m.map)m.map.anisotropy=4;}});return g.scene;
 });
}
