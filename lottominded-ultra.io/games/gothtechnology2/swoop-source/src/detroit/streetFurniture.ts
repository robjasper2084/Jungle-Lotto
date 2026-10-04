import * as T from 'three';
import {GLTFLoader} from './compressedGLTFLoader.ts';
import {heightAt,type DetroitWorld} from './world.ts';
import {streetFurnitureSites,type StreetAsset} from './streetFurnitureLayout.ts';

export async function buildStreetFurniture(scene:T.Scene,world:DetroitWorld,groupAt:(x:number,z:number)=>T.Group){
 const names:StreetAsset[]=['street-lamp','camera-pole','hydrant','bench','waste-bin','bike-rack','drain-grate','utility-cover'];
 const loader=new GLTFLoader(),assets=await Promise.all(names.map(n=>loader.loadAsync('/exports/street-furniture/'+n+'.glb')));
 const allowed=(x:number,z:number)=>world.chunks.some(c=>Math.abs(c.x-x)<=50&&Math.abs(c.z-z)<=50);
 const sites=streetFurnitureSites(allowed),lenses=new Set<T.MeshStandardMaterial>();
 world.step(); // The new draped sidewalks must be queryable before grounding assets.
 for(const asset of assets)asset.scene.traverse(o=>{if(!(o as T.Mesh).isMesh)return;const m=o as T.Mesh;m.castShadow=m.receiveShadow=true;for(const a of Array.isArray(m.material)?m.material:[m.material])if(a.name==='Street LED diffuser'){lenses.add(a as T.MeshStandardMaterial);(a as T.MeshStandardMaterial).emissiveIntensity=0;}});
 const counts=Object.fromEntries(names.map(n=>[n,0])) as Record<StreetAsset,number>;
 for(const s of sites){
  const model=assets[names.indexOf(s.asset)].scene.clone(true),base=heightAt(s.x,s.z);
  const y=world.sampleGround(s.x,s.z,{height:base,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false},base+.15).height;
  model.position.set(s.x,y+.004,s.z);model.rotation.y=s.heading;model.name=s.asset+' · '+s.street;
  model.userData={source:'Original Blender street furniture; estimated position beside OSM road',decorativeCamera:s.asset==='camera-pole'};
  groupAt(s.x,s.z).add(model);counts[s.asset]++;
  // Flush fittings are riding detail. Tall props have small matching footprints,
  // positioned outside the complete sidewalk, never across its access route.
  const footprint=s.asset==='street-lamp'?{hx:.20,hy:3.8,hz:.20}:s.asset==='camera-pole'?{hx:.20,hy:2.9,hz:.20}:s.asset==='hydrant'?{hx:.28,hy:.44,hz:.28}:s.asset==='bench'?{hx:.87,hy:.5,hz:.36}:s.asset==='waste-bin'?{hx:.32,hy:.48,hz:.32}:s.asset==='bike-rack'?{hx:.9,hy:.45,hz:.34}:null;
  if(footprint)world.addBox({x:s.x,y:y+footprint.hy,z:s.z,...footprint,yaw:s.heading,kind:s.asset});
 }
 const lamps=sites.filter(s=>s.asset==='street-lamp');
 const pool=Array.from({length:2},()=>{const light=new T.SpotLight('#fff0d2',0,25,.65,.75,2);light.castShadow=false;scene.add(light,light.target);return light;});
 let dusk=false,lastX=Infinity,lastZ=Infinity;
 return {counts,count:lamps.length,sites:sites.length,
  setDusk(value:boolean){dusk=value;lastX=Infinity;for(const m of lenses)m.emissiveIntensity=value?1.4:0;if(!value)pool.forEach(l=>l.intensity=0);},
  update(x:number,z:number){
   if(!dusk||Math.hypot(x-lastX,z-lastZ)<2)return;lastX=x;lastZ=z;
   const nearest=lamps.map(s=>({s,d:Math.hypot(s.x-x,s.z-z)})).sort((a,b)=>a.d-b.d).slice(0,pool.length);
   pool.forEach((l,i)=>{const n=nearest[i],compact=document.documentElement.dataset.renderQuality==='compact';l.intensity=n&&n.d<65&&(!compact||i===0)?175:0;if(n){const y=heightAt(n.s.x,n.s.z),dx=Math.sin(n.s.heading)*1.83,dz=Math.cos(n.s.heading)*1.83;l.position.set(n.s.x+dx,y+7.92,n.s.z+dz);l.target.position.set(n.s.x+dx,y,n.s.z+dz);}});
  }
 };
}
