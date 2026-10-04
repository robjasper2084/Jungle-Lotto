import * as T from 'three';
import {GLTFLoader} from './compressedGLTFLoader.ts';
import {cityPoint} from './atwater.ts';
import {MILLIKEN_BERM} from './millikenTerrain.ts';
import {heightAt,type DetroitWorld} from './world.ts';
export const LIGHTHOUSE_GPS={latitude:42.3322455,longitude:-83.0249708};
export async function buildMillikenLandmarks(scene:T.Scene,world:DetroitWorld){
 const loader=new GLTFLoader(),[lighthouse,viewer]=await Promise.all(['milliken-lighthouse','milliken-viewer'].map(n=>loader.loadAsync('/exports/atwater/'+n+'.glb')));
 const p=cityPoint(LIGHTHOUSE_GPS.latitude,LIGHTHOUSE_GPS.longitude),root=lighthouse.scene;
 root.position.set(p.x,.1,p.z);root.name='Milliken lighthouse · Google Maps anchor';scene.add(root);
 world.addBox({x:p.x,y:8,z:p.z,hx:2.1,hy:8,hz:2.1,kind:"lighthouse"});
 const pier=new T.Mesh(new T.CylinderGeometry(8,8,.35,48),new T.MeshStandardMaterial({color:0xbebcaf,roughness:.9}));pier.position.set(p.x,-.075,p.z);scene.add(pier);
 const deck=new T.CircleGeometry(8,48);deck.rotateX(-Math.PI/2);deck.translate(p.x,.1,p.z);const flat=deck.toNonIndexed();world.addRideSurface(flat.attributes.position.array as Float32Array);deck.dispose();flat.dispose();
 for(const side of [-1,1]){const x=MILLIKEN_BERM.x+side*2.4,z=MILLIKEN_BERM.z,y=heightAt(x,z);const v=viewer.scene.clone(true);v.position.set(x,y+.09,z);v.rotation.y=-Math.PI/2;scene.add(v);world.addBox({x,y:y+.7,z,hx:.26,hy:.7,hz:.25,kind:"viewer"});}
 return root;
}
