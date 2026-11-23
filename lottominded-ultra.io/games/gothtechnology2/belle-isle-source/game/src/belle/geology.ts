import * as T from 'three';
import {prepareColoredDetailPool} from './sceneWarmup.ts';
import {inside,type ParkMap,type ParkTerrain,type Point} from './terrain.ts';
import {roadIndex} from './streetPlan.ts';
import {selectGeology,type GeologyTier} from './geologyLod.ts';

export type Boulder={x:number;z:number;y:number;radius:number;height:number;yaw:number;shape:number;hue:number};
export const MAX_BOULDERS=90;
/** Map-constrained, reproducible clusters; rendered rocks are not a site survey.
 * The 9 m road/trail shoulder guard protects every mapped race corridor.
 */
export function planBoulders(map:ParkMap,terrain:Pick<ParkTerrain,'land'|'height'|'obstructed'|'bridge'>):Boulder[]{
 let seed=208416;const rand=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
 const occupied=roadIndex(map.roads),restricted=map.areas.filter(a=>['beach','pitch','track','pedestrian','playground','golf_course','swimming_pool','garden','marina','fitness_station','outdoor_seating'].includes(a.kind));
 const rocks:Boulder[]=[];
 const valid=(x:number,z:number,r:number)=>{
  if(!terrain.land(x,z)||terrain.bridge(x,z).active||terrain.obstructed(x,z,r+.35)||occupied(x,z,'',9+r))return false;
  if(restricted.some(a=>inside(x,z,a.points)))return false;
  if(map.buildings.some(b=>inside(x,z,b.points)))return false;
  if((map.monuments||[]).some(m=>Math.hypot(x-m.x,z-m.z)<m.radius+r+8))return false;
  return rocks.every(b=>Math.hypot(x-b.x,z-b.z)>r+b.radius+.45);
 };
 const add=(x:number,z:number)=>{
  const radius=.7+rand()*.86,px=Math.round(x*100)/100,pz=Math.round(z*100)/100;
  if(!valid(px,pz,radius))return false;
  rocks.push({x:px,z:pz,y:terrain.height(px,pz),radius,height:radius*(.7+rand()*.62),yaw:rand()*Math.PI*2,shape:Math.floor(rand()*3),hue:rand()});
  return true;
 };
 const cluster=(x:number,z:number)=>{
  if(!add(x,z))return;
  const count=1+Math.floor(rand()*3);
  for(let i=0;i<count;i++){const angle=rand()*Math.PI*2,offset=3.2+rand()*4.7;add(x+Math.cos(angle)*offset,z+Math.sin(angle)*offset);}
 };
 // Preserve human-scaled open lawns, cluster stones in wooded inland pockets.
 const woods=map.areas.filter(a=>['wood','forest'].includes(a.kind)&&a.points.length>=4);
 for(let i=0;i<720&&rocks.length<57&&woods.length;i++){
  const w=woods[Math.floor(rand()*woods.length)],xs=w.points.map(p=>p[0]),zs=w.points.map(p=>p[1]);
  const x=Math.min(...xs)+rand()*(Math.max(...xs)-Math.min(...xs)),z=Math.min(...zs)+rand()*(Math.max(...zs)-Math.min(...zs));
  if(inside(x,z,w.points)&&!(w.holes||[]).some(h=>inside(x,z,h)))cluster(x,z);
 }
 // Natural coastal outcrops: stay on dry land, inland of the shoreline slope.
 const rings=[map.island,...(map.outerIslets||[]).map(i=>i.points)];
 for(let i=0;i<500&&rocks.length<MAX_BOULDERS;i++){
  const ring=rings[Math.floor(rand()*rings.length)];
  if(ring.length<3)continue;
  // Prefer actual adjacent shoreline segments over long chords.
  const j=Math.floor(rand()*(ring.length-1)),p=ring[j],q=ring[j+1],dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);
  if(len<1)continue;
  const t=rand(),x=p[0]+dx*t,z=p[1]+dz*t,nx=dz/len,nz=-dx/len,off=6+rand()*15;
  const side=inside(x+nx,z+nz,ring)?1:-1;
  const px=x+nx*off*side,pz=z+nz*off*side;
  if(inside(px,pz,ring))cluster(px,pz);
 }
 return rocks.slice(0,MAX_BOULDERS);
}
function rockGeometry(shape:number,detail:'near'|'far'){
 // Coarse twenty-face far silhouettes prevent dense rock detail on the
 // starting-line GPU; near boulders retain their original angular geometry.
 const g=new T.IcosahedronGeometry(1,detail==='far'?0:shape===0?1:2),v=g.attributes.position;
 for(let i=0;i<v.count;i++){
  const x=v.getX(i),y=v.getY(i),z=v.getZ(i);
  const irregular=1+.11*Math.sin(x*6.7+y*3.1+shape)+.07*Math.cos(z*9.3-x*4.7+shape);
  v.setXYZ(i,x*irregular,Math.max(-.42,y)*(.93+.08*shape)*irregular,z*(1.04-.03*shape)*irregular);
 }
 g.computeVertexNormals();g.computeBoundingBox();return g;
}
export function addGeology(scene:T.Scene,map:ParkMap,terrain:ParkTerrain){
 const boulders=planBoulders(map,terrain),pools:{shape:number;detail:'near'|'far';mesh:T.InstancedMesh}[]=[];
 const dummy=new T.Object3D(),color=new T.Color();
 let triangles=0;
 for(let shape=0;shape<3;shape++){
  const material=new T.MeshStandardMaterial({name:'Natural lake-and-flatwoods rock',color:0xa5a49a,metalness:0,roughness:.94});
  material.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec3 mineralWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvec4 mineralLocal=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nmineralLocal=instanceMatrix*mineralLocal;\n#endif\nmineralWorld=(modelMatrix*mineralLocal).xyz;');
   shader.fragmentShader='varying vec3 mineralWorld;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float fracture=.5+.25*sin(mineralWorld.x*3.3+mineralWorld.z*1.5)+.25*sin(mineralWorld.z*4.4-mineralWorld.y*2.9);
    float lichen=smoothstep(.63,.91,fracture)*.20;
    diffuseColor.rgb*=mix(vec3(.94,.96,.93),vec3(.78,.84,.70),lichen);
    diffuseColor.rgb*=.91+.12*fracture;
   `);
  };material.customProgramCacheKey=()=> 'belle-mineral-weather-v1';
  for(const detail of ['near','far'] as const){
   const g=rockGeometry(shape,detail),mesh=new T.InstancedMesh(g,material,boulders.length);
   prepareColoredDetailPool(mesh);
   mesh.name='Clustered mapped mineral boulders '+shape+' '+detail;
   mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.count=0;mesh.visible=false;
   mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
   scene.add(mesh);pools.push({shape,detail,mesh});
   triangles+=(g.index?.count??g.attributes.position.count)/3*boulders.filter(b=>b.shape===shape).length;
  }
 }
 // Physics remains at full fidelity even for hidden/distant graphics.
 terrain.registerBoulders(boulders.map(b=>({x:b.x,z:b.z,bottom:b.y,top:b.y+b.height*.98,radius:b.radius*.78})));
 let quality:GeologyTier='automatic',lastX=Infinity,lastZ=Infinity;
 const stats={boulders:boulders.length,drawCalls:pools.length,activeDrawCalls:0,visibleNear:0,visibleFar:0,triangles,colliders:boulders.length};
 function update(x:number,z:number){
  if(Math.hypot(x-lastX,z-lastZ)<6)return;
  lastX=x;lastZ=z;
  const selected=selectGeology(boulders,x,z,quality);
  stats.visibleNear=selected.near.length;stats.visibleFar=selected.far.length;stats.activeDrawCalls=0;
  for(const {shape,detail,mesh}of pools){
   const rocks=(detail==='near'?selected.near:selected.far).filter(b=>b.shape===shape);
   mesh.count=rocks.length;mesh.visible=mesh.count>0;
   if(mesh.visible)stats.activeDrawCalls++;
   rocks.forEach((b,i)=>{
    dummy.position.set(b.x,b.y+b.height*.32,b.z);dummy.rotation.set(0,b.yaw,0);
    dummy.scale.set(b.radius,b.height,b.radius);dummy.updateMatrix();
    mesh.setMatrixAt(i,dummy.matrix);
    mesh.setColorAt(i,color.setHSL(.09+b.hue*.045,.065+b.hue*.05,.70+b.hue*.12));
   });
   if(mesh.count){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  }
 }
 return {stats,boulders,update,setQuality(value:string){
  quality=value==='high'||value==='smooth'?value:'automatic';lastX=Infinity;
 }};
}
