import * as T from 'three';
import {GLTFLoader} from './compressedGLTFLoader.ts';
import {cutPoint,heightAt,hash,surfaceAt} from './world.ts';
import {CUT_METRES} from './geography.ts';
import {cutWidth,nearestRamp} from './geo-profile.ts';
import {inMillikenPark} from './parkPaths.ts';
import {inValadePark,inValadeBeach,inValadeInlet,VALADE} from './valadeSite.ts';
import {inHarbor} from './harbor.ts';
import {inWaterfrontPond,polygonContains,WATERFRONT} from './waterfrontSite.ts';
import {roadwayClearance} from './roadsidePlacement.ts';
import type {DetroitWorld} from './world.ts';
/** Grounded Blender meshes, instanced in short independently culled trail sections. */
export async function buildGrassField(scene:T.Scene,world:DetroitWorld,ground:T.MeshStandardMaterial){
 const [asset,albedo,normal]=await Promise.all([
  new GLTFLoader().loadAsync(new URL('../../art/swoop-field-pack/field-assets.glb',import.meta.url).href),
  new T.TextureLoader().loadAsync(new URL('../../art/swoop-field-pack/grass_01.jpg',import.meta.url).href),
  new T.TextureLoader().loadAsync(new URL('../../art/swoop-field-pack/grass_01_normal.jpg',import.meta.url).href),
 ]);
 albedo.colorSpace=T.SRGBColorSpace;albedo.wrapS=albedo.wrapT=T.RepeatWrapping;albedo.anisotropy=8;
 ground.map?.dispose();ground.normalMap?.dispose();ground.roughnessMap?.dispose();ground.map=albedo;normal.wrapS=normal.wrapT=T.RepeatWrapping;normal.anisotropy=4;ground.normalMap=normal;ground.normalScale.set(.35,.35);ground.roughnessMap=null;ground.color.set('#ffffff');ground.roughness=1;ground.needsUpdate=true;
 // Broad, restrained colour variation breaks tile repetition without painted shadows.
 ground.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 fieldWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nfieldWorld=position;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 fieldWorld;').replace('#include <map_fragment>','#include <map_fragment>\nfloat meadowVariation=sin(fieldWorld.x*.093+sin(fieldWorld.z*.041))*sin(fieldWorld.z*.067); diffuseColor.rgb*=mix(vec3(.88,.94,.82),vec3(1.05,1.03,.97),meadowVariation*.5+.5);\nif(fieldWorld.x> -360.0 && fieldWorld.x<30.0 && fieldWorld.z< -1010.0 && fieldWorld.z> -2000.0) diffuseColor.rgb*=vec3(.70,1.04,.61);');};
 ground.customProgramCacheKey=()=> 'swoop-field-ground-park-2';
 asset.scene.updateMatrixWorld(true);const meshes=new Map<string,T.Mesh>();asset.scene.traverse(o=>{if(o instanceof T.Mesh)meshes.set(o.name,o);});
 const names=['GrassTuft','DryTuft','CloverPatch'],time={value:0},rider={value:new T.Vector3(1e6,0,1e6)},materials:T.MeshStandardMaterial[]=[];
 const sources=names.map(name=>{const o=meshes.get(name);if(!o)throw Error('Missing Blender grass mesh: '+name);const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld),material=(o.material as T.MeshStandardMaterial).clone();material.side=T.DoubleSide;material.roughness=.93;material.vertexColors=false;
  material.onBeforeCompile=s=>{s.uniforms.fieldTime=time;s.uniforms.fieldRider=rider;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float fieldTime; uniform vec3 fieldRider;').replace('#include <begin_vertex>',`#include <begin_vertex>
   vec3 wp=(instanceMatrix*vec4(position,1.0)).xyz;
   float tip=smoothstep(0.0,.25,position.y),nearby=1.0-smoothstep(.5,1.7,distance(wp.xz,fieldRider.xz));
   transformed.x+=tip*(sin(fieldTime*1.3+wp.x*.8+wp.z*.5)*.026*(.75+.45*sin(fieldTime*.43))+nearby*.07);
   transformed.z+=tip*cos(fieldTime+wp.x)*.011;
  `);};material.customProgramCacheKey=()=> 'swoop-field-blades-1';materials.push(material);return {geometry,material};});
 const chunks:{group:T.Group;x:number;z:number}[]=[],dummy=new T.Object3D();let total=0;
 for(let start=350;start<CUT_METRES;start+=50){
  const positions:{x:number;y:number;z:number;scale:number;rotation:number;type:number}[]=[];
  for(let d=start;d<Math.min(start+50,CUT_METRES-3);d+=1.6)for(const side of [-1,1])for(let band=0;band<6;band++){
   const seed=d*61+side*7+band*83;if(hash(seed)<.16)continue;
   const u=side*(cutWidth(d)/2+.38+band*.55+hash(seed+9)*.35),p=cutPoint(d+hash(seed+4)*1.1,u);
   if(surfaceAt(p.x,p.z)!=='grass'||nearestRamp(p.x,p.z).distance<2.6||world.solids.some(s=>Math.hypot(p.x-s.x,p.z-s.z)<Math.hypot(s.hx,s.hz)+.4))continue;
   positions.push({...p,y:heightAt(p.x,p.z)+.005,scale:(band<2?.5:.8)+hash(seed+1)*.6,rotation:hash(seed+2)*Math.PI*2,type:hash(seed+3)<.12?1:hash(seed+5)<.18?2:0});
  }
  const group=new T.Group(),centre=cutPoint(start+25);group.name='Swoop botanical grass '+start;
  sources.forEach((source,type)=>{const list=positions.filter(p=>p.type===type);if(!list.length)return;const mesh=new T.InstancedMesh(source.geometry,source.material,list.length);mesh.receiveShadow=true;mesh.castShadow=false;
   list.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.rotation,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new T.Color().setHSL(.2+hash(i+start)*.035,.30+hash(i)*.18,.57+hash(i*5)*.2));});mesh.computeBoundingSphere();group.add(mesh);total+=list.length;
 });scene.add(group);chunks.push({group,x:centre.x,z:centre.z});
 }
 // Low, irregular blades and clover add near detail to the riverfront lawns.
 // The short tile batches use the same quality-dependent visibility as the trail.
 for(const c of world.chunks){
  if(!(inMillikenPark(c.x,c.z)&&c.z>-1510||inValadePark(c.x,c.z)))continue;
  const positions:{x:number;y:number;z:number;scale:number;rotation:number;type:number}[]=[];
  for(let x=c.x-48;x<c.x+49;x+=3.2)for(let z=c.z-48;z<c.z+49;z+=3.2){
   const seed=x*71+z*37,px=x+hash(seed)*2,pz=z+hash(seed+9)*2;
   if(!(inMillikenPark(px,pz)&&pz>-1510||inValadePark(px,pz))||inValadeInlet(px,pz)||inValadeBeach(px,pz)||inHarbor(px,pz)||inWaterfrontPond(px,pz)||heightAt(px,pz)<0||roadwayClearance({x:px,z:pz})<.65)continue;
   if(WATERFRONT.buildings.some(b=>polygonContains(b.points,px,pz))||Math.hypot(px-VALADE.play.x,pz-VALADE.play.z)<7||world.solids.some(s=>Math.abs(s.x-px)<s.hx+.5&&Math.abs(s.z-pz)<s.hz+.5))continue;
   positions.push({x:px,y:heightAt(px,pz)+.008,z:pz,scale:.33+hash(seed+1)*.30,rotation:hash(seed+2)*Math.PI*2,type:hash(seed+3)<.25?2:0});
  }
  if(!positions.length)continue;const group=new T.Group();group.name='Riverfront lawn detail '+c.x+','+c.z;
  sources.forEach((source,type)=>{const list=positions.filter(p=>p.type===type);if(!list.length)return;const mesh=new T.InstancedMesh(source.geometry,source.material,list.length);mesh.receiveShadow=true;
   list.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.rotation,0);dummy.scale.setScalar(p.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new T.Color('#91ad60'));});mesh.computeBoundingSphere();group.add(mesh);total+=list.length;
  });scene.add(group);chunks.push({group,x:c.x,z:c.z});
 }
 // Original drain mesh adds trail-edge detail; this is decorative, flush to supported paving.
 const drain=meshes.get('TrailDrain');if(drain){for(let d=1780;d<CUT_METRES-30;d+=130){const p=cutPoint(d,-cutWidth(d)/2+.25);if(nearestRamp(p.x,p.z).distance<5)continue;const o=new T.Mesh(drain.geometry.clone().applyMatrix4(drain.matrixWorld),drain.material);o.position.set(p.x,heightAt(p.x,p.z)+.028,p.z);o.rotation.y=p.heading;scene.add(o);}}
 return {count:total,update(x:number,z:number,t:number,reduced=false,compact=false){time.value=reduced?0:t;rider.value.set(reduced?1e6:x,0,z);let visible=0;for(const c of chunks){c.group.visible=Math.hypot(c.x-x,c.z-z)<(compact?85:155);if(c.group.visible)visible++;}return visible;}};
}
