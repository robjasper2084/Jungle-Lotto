import * as T from 'three';
import {bridgeFrame} from './bridges.ts';
import {CUT_METRES} from './geography.ts';
import {cutPoint,heightAt} from './world.ts';
import {GEO,nearestRamp,cutWidth} from './geo-profile.ts';
/** Original Cut lantern family, based on SmithGroup's project photographs.
 * Dimensions and spacing are approximations, not a surveyed lighting plan. */
const bridgeClearances=GEO.bridges.map(bridgeFrame);
/** Include skewed decks and bank approaches, plus room for the lantern cap. */
export function lampClearOfBridges(x:number,z:number){
 return bridgeClearances.every(f=>{const [u,v]=f.project(x,z);return u<f.lo-47||u>f.hi+47||v<f.near-2||v>f.far+2;});
}
export function cutLampSites(){
 const sites:{x:number;y:number;z:number}[]=[];
 for(let d=30;d<CUT_METRES;d+=32){
  if(GEO.bridges.some(b=>Math.abs(b.at-d)<19))continue;
  for(const side of [-1,1]){
   const p=cutPoint(d,side*(cutWidth(d)/2+1.1));
   if(nearestRamp(p.x,p.z).distance<3||!lampClearOfBridges(p.x,p.z))continue;
   sites.push({x:p.x,y:heightAt(p.x,p.z),z:p.z});
  }
 }
 return sites;
}
export function buildCutLights(scene:T.Scene,groupAt:(x:number,z:number)=>T.Group){
 const metal=new T.MeshStandardMaterial({color:'#8d989f',metalness:.75,roughness:.36});
 const dark=new T.MeshStandardMaterial({color:'#455159',metalness:.65,roughness:.42});
 const concrete=new T.MeshStandardMaterial({color:'#a09f92',roughness:.95});
 const lens=new T.MeshStandardMaterial({color:'#e4ece9',roughness:.4,emissive:'#fff0d2',emissiveIntensity:0});
 const sites=cutLampSites();
 const parts:[T.BufferGeometry,T.Material,number][]=[
  [new T.CylinderGeometry(.22,.26,.18,12),concrete,.09],
  [new T.CylinderGeometry(.14,.17,.24,12),dark,.25],
  [new T.CylinderGeometry(.065,.095,4.35,12),metal,2.5],
  [new T.CylinderGeometry(.13,.10,.13,12),dark,4.72],
  [new T.CylinderGeometry(.22,.13,.46,16),lens,5.01],
  [new T.CylinderGeometry(.255,.23,.09,16),dark,5.28],
  [new T.CylinderGeometry(.30,.255,.10,16),metal,5.37],
  [new T.ConeGeometry(.30,.12,16),metal,5.48],
 ];
 for(const s of sites){const g=groupAt(s.x,s.z);
  for(const [geo,mat,y] of parts){const m=new T.Mesh(geo,mat);m.name='Cut silver lantern';m.position.set(s.x,s.y+y,s.z);m.castShadow=m.receiveShadow=true;g.add(m);}
  const hatch=new T.Mesh(new T.BoxGeometry(.075,.23,.022),dark);hatch.position.set(s.x,s.y+.67,s.z+.087);g.add(hatch);
 }
 // A fixed light pool avoids a shader for every pole and keeps mobile/VR cost bounded.
 const pool=Array.from({length:4},()=>{const l=new T.SpotLight('#fff0d2',0,15,Math.PI*.39,.65,2);l.castShadow=false;scene.add(l,l.target);return l;});
 let dusk=false,lastX=Infinity,lastZ=Infinity;
 return {count:sites.length,setDusk(value:boolean){dusk=value;lastX=Infinity;lens.emissiveIntensity=value?1.6:0;if(!value)for(const light of pool)light.intensity=0;},update(x:number,z:number){
  if(!dusk||Math.hypot(x-lastX,z-lastZ)<2)return;lastX=x;lastZ=z;
  const nearest=sites.map(s=>({s,d:Math.hypot(s.x-x,s.z-z)})).sort((a,b)=>a.d-b.d).slice(0,pool.length);
  pool.forEach((l,i)=>{const n=nearest[i];l.intensity=dusk&&n&&n.d<65?110:0;if(n){l.position.set(n.s.x,n.s.y+4.88,n.s.z);l.target.position.set(n.s.x,n.s.y,n.s.z);}});
 }};
}
