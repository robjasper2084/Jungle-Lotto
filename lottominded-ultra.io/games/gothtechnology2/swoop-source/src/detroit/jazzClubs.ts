import * as T from 'three';import {GLTFLoader} from './compressedGLTFLoader.ts';
import {JAZZ_CLUBS,jazzMap,jazzSolids} from './jazzSites.ts';import type {SceneryWorld} from './sceneryWorld.ts';
export async function buildJazzClubs(scene:T.Scene,world:SceneryWorld){
 for(const box of jazzSolids())world.addBox(box);
 const clubs=await Promise.all(JAZZ_CLUBS.map(async site=>{
  const root=(await new GLTFLoader().loadAsync('/exports/jazz/'+site.asset+'.glb')).scene;root.name=site.name;root.scale.x=-1;root.position.set(site.x,site.floor,site.z);root.rotation.y=site.heading;
  root.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=o.receiveShadow=true;}});scene.add(root);
  const ps=[[-site.width/2,-site.depth/2],[-site.width/2,site.depth/2],[site.width/2,site.depth/2],[site.width/2,-site.depth/2]].map(([u,v])=>jazzMap(site,u,v));world.addRideSurface(new Float32Array([0,2,1,0,3,2].flatMap(i=>[ps[i].x,site.floor+.04,ps[i].z])),true);
  return{site,root};
 }));
 return{clubs,update(x:number,z:number){for(const c of clubs)c.root.visible=Math.hypot(x-c.site.x,z-c.site.z)<340;}};
}
