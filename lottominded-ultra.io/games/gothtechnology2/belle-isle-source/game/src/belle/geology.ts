import * as T from 'three';
import {inside,type ParkMap,type ParkTerrain,type Point} from './terrain.ts';
import {roadIndex} from './streetPlan.ts';

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
  if(!a||!b)continue;
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
function rockGeometry(shape:number){
 const g=new T.IcosahedronGeometry(1,shape===0?1:2),v=g.attributes.position;
 for(let i=0;i<v.count;i++){
  const x=v.getX(i),y=v.getY(i),z=v.getZ(i);
  const irregular=1+.11*Math.sin(x*6.7+y*3.1+shape)+.07*Math.cos(z*9.3-x*4.7+shape);
  v.setXYZ(i,x*irregular,Math.max(-.42,y)*(.93+.08*shape)*irregular,z*(1.04-.03*shape)*irregular);
 }
 g.computeVertexNormals();g.computeBoundingBox();return g;
}
export function addGeology(scene:T.Scene,map:ParkMap,terrain:ParkTerrain){
 const boulders=planBoulders(map,terrain),geometries=[0,1,2].map(rockGeometry),meshes:T.InstancedMesh[]=[];
 let triangles=0;
 for(let shape=0;shape<3;shape++){
  const members=boulders.filter(b=>b.shape===shape),g=geometries[shape],m=new T.MeshStandardMaterial({name:'Natural lake-and-flatwoods rock',color:0xa5a49a,metalness:0,roughness:.94});
  m.onBeforeCompile=shader=>{
   shader.vertexShader='varying vec3 mineralWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvec4 mineralLocal=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nmineralLocal=instanceMatrix*mineralLocal;\n#endif\nmineralWorld=(modelMatrix*mineralLocal).xyz;');
   shader.fragmentShader='varying vec3 mineralWorld;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float fracture=.5+.25*sin(mineralWorld.x*3.3+mineralWorld.z*1.5)+.25*sin(mineralWorld.z*4.4-mineralWorld.y*2.9);
    float lichen=smoothstep(.63,.91,fracture)*.20;
    diffuseColor.rgb*=mix(vec3(.94,.96,.93),vec3(.78,.84,.70),lichen);
    diffuseColor.rgb*=.91+.12*fracture;
   `);
  };m.customProgramCacheKey=()=> 'belle-mineral-weather-v1';
  const inst=new T.InstancedMesh(g,m,members.length),dummy=new T.Object3D(),color=new T.Color();
  inst.name='Clustered mapped mineral boulders '+shape;inst.castShadow=false;inst.receiveShadow=true;inst.frustumCulled=false;
  members.forEach((b,i)=>{
   dummy.position.set(b.x,b.y+b.height*.32,b.z);dummy.rotation.set(0,b.yaw,0);dummy.scale.set(b.radius,b.height,b.radius);dummy.updateMatrix();
   inst.setMatrixAt(i,dummy.matrix);inst.setColorAt(i,color.setHSL(.09+b.hue*.045,.065+b.hue*.05,.70+b.hue*.12));
  });
  inst.instanceMatrix.needsUpdate=true;inst.computeBoundingSphere();scene.add(inst);meshes.push(inst);
  triangles+=(g.index?.count??g.attributes.position.count)/3*members.length;
 }
 // Physics is registered independently of quality and render distance.
 // The model footprint sits in mapped inland/shore focal points, never on a route.
 terrain.registerBoulders(boulders.map(b=>({x:b.x,z:b.z,bottom:b.y,top:b.y+b.height*.98,radius:b.radius*.78})));
 return {stats:{boulders:boulders.length,drawCalls:meshes.length,triangles,colliders:boulders.length},boulders};
}
