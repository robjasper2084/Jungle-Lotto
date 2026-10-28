import * as T from 'three';
import {harborFixtures,DOCK_TOP} from './harborLayout.ts';

/** Authored marina fittings. All positions are outside the existing riding deck. */
export function harborMoorings(){
 return harborFixtures().boats.flatMap(boat=>{
  const forward=new T.Vector3(Math.sin(boat.heading),0,Math.cos(boat.heading));
  const right=new T.Vector3(Math.cos(boat.heading),0,-Math.sin(boat.heading));
  return [-1,1].map(side=>{
   const stern=new T.Vector3(boat.x,.63,boat.z).addScaledVector(forward,-4.3).addScaledVector(right,side*1.15);
   const cleat=new T.Vector3(boat.x,DOCK_TOP+.10,boat.z).addScaledVector(forward,-6.12).addScaledVector(right,side*2.1);
   return{stern,cleat};
  });
 });
}

/** Timber grain is analytic: no texture downloads or extra rendering passes. */
export function dockTimber(){
 const wood=new T.MeshStandardMaterial({color:'#8c8878',roughness:.9});
 wood.name='Weathered harbor timber';
 wood.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 timberLocal;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntimberLocal=position;');
  s.fragmentShader='varying vec3 timberLocal;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float grainPhase=timberLocal.z*210.+sin(timberLocal.x*6.+timberLocal.z*23.)*2.;
   float grain=.5+.5*sin(grainPhase);
   float grainAA=1.-smoothstep(.6,2.5,fwidth(grainPhase));
   diffuseColor.rgb*=.93+grainAA*(grain-.5)*.19;
   diffuseColor.rgb*=mix(.76,1.,smoothstep(-.45,.35,timberLocal.y));`);
 };
 wood.customProgramCacheKey=()=> 'harbor-timber-grain-v1';return wood;
}

export function buildHarborDetail(groupAt:(x:number,z:number)=>T.Group){
 const steel=new T.MeshStandardMaterial({color:'#6e7472',metalness:.7,roughness:.46});
 const rubber=new T.MeshStandardMaterial({color:'#17211f',roughness:.96});
 const timber=dockTimber(),wet=new T.MeshStandardMaterial({color:'#34473b',roughness:.72});
 const ropeMaterial=new T.MeshStandardMaterial({color:'#a89d78',roughness:1});
 const parts=new Map<T.Group,Map<string,{geometry:T.BufferGeometry;material:T.Material;matrices:T.Matrix4[]}>>();
 const cyl=new T.CylinderGeometry(1,1,1,10),cap=new T.ConeGeometry(1,1,10),cube=new T.BoxGeometry(1,1,1);
 const add=(name:string,x:number,y:number,z:number,scale:T.Vector3,geometry:T.BufferGeometry,material:T.Material,angle=0)=>{
  const group=groupAt(x,z),bins=parts.get(group)??new Map(),batch=bins.get(name)??{geometry,material,matrices:[]};
  batch.matrices.push(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),angle),scale));
  bins.set(name,batch);parts.set(group,bins);
 };
 for(const p of harborFixtures().pilings){
  add('Round timber mooring piles',p.x,-.37,p.z,new T.Vector3(.19,3.24,.19),cyl,timber);
  add('Pile weather caps',p.x,1.30,p.z,new T.Vector3(.215,.19,.215),cap,steel);
  add('Pile tidal staining',p.x,-.27,p.z,new T.Vector3(.193,.33,.193),cyl,wet);
  for(const y of [.24,.99])add('Pile steel straps',p.x,y,p.z,new T.Vector3(.197,.055,.197),cyl,steel);
 }
 for(const boat of harborFixtures().boats){
  const f=new T.Vector3(Math.sin(boat.heading),0,Math.cos(boat.heading)),r=new T.Vector3(Math.cos(boat.heading),0,-Math.sin(boat.heading));
  for(const side of [-1,1]){
   const p=new T.Vector3(boat.x,0,boat.z).addScaledVector(f,-5.68).addScaledVector(r,side*1.25);
   add('Harbor rubber fenders',p.x,-.025,p.z,new T.Vector3(.14,.7,.14),cyl,rubber);
   add('Fender fastening blocks',p.x,DOCK_TOP-.07,p.z,new T.Vector3(.10,.08,.15),cube,steel,boat.heading);
  }
 }
 // Curve each line down under its own weight, keeping both ends at their fittings.
 for(const {stern,cleat} of harborMoorings()){
  const middle=stern.clone().lerp(cleat,.5);middle.y-=.22;
  const curve=new T.QuadraticBezierCurve3(stern,middle,cleat);
  const line=new T.Mesh(new T.TubeGeometry(curve,8,.019,5,false),ropeMaterial);
  line.name='Taut harbor mooring line';line.receiveShadow=true;groupAt(cleat.x,cleat.z).add(line);
  add('Stern mooring cleat bases',cleat.x,DOCK_TOP+.025,cleat.z,new T.Vector3(.32,.045,.15),cube,steel);
  add('Stern mooring cleat horns',cleat.x,DOCK_TOP+.105,cleat.z,new T.Vector3(.38,.045,.06),cube,steel);
 }
 for(const [group,bins]of parts)for(const [name,b]of bins){
  const mesh=new T.InstancedMesh(b.geometry,b.material,b.matrices.length);mesh.name=name;
  b.matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);
 }
}
