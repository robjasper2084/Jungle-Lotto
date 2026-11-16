import * as T from 'three';
import {segment,inside,type ParkMap,type ParkTerrain} from './terrain.ts';
import {roadIndex} from './streetPlan.ts';
import type {Plant} from './naturePlan.ts';
export type RootSite={x:number;y:number;z:number;angle:number;length:number;thickness:number};
export const ROOT_LIMITS={smooth:{count:36,range:135},automatic:{count:88,range:245},high:{count:170,range:380}} as const;
/** Interpret exposed shoreline roots from existing trees. No roots are added to
 * physics or moved into mapped drive/trail corridors or beach sand. */
export function planCanalRoots(map:ParkMap,terrain:Pick<ParkTerrain,'land'|'height'|'obstructed'>,trees:readonly Plant[]):RootSite[]{
 const occupied=roadIndex(map.roads),shore=map.water.filter(w=>w.points.length>2);
 // Each tree tests only nearby 32 m shoreline cells; avoid rebuilding a
 // flat-map of every water edge for thousands of tree instances at startup.
 const cell=32,pad=13,grid=new Map<string,{a:[number,number];b:[number,number]}[]>();
 for(const w of shore)for(let i=1;i<w.points.length;i++){
  const b=w.points[i],prev=w.points[i-1];
  for(let x=Math.floor((Math.min(prev[0],b[0])-pad)/cell);x<=Math.floor((Math.max(prev[0],b[0])+pad)/cell);x++)
   for(let z=Math.floor((Math.min(prev[1],b[1])-pad)/cell);z<=Math.floor((Math.max(prev[1],b[1])+pad)/cell);z++){
    const key=x+','+z,items=grid.get(key)||[];items.push({a:prev,b});grid.set(key,items);
   }
 }
 const beach=map.areas.filter(a=>a.kind==='beach'),roots:RootSite[]=[];
 for(const tree of trees){
  if(!['willow','maple','birch'].includes(tree.id)||roots.length>=170)continue;
  let nearest:{edge:ReturnType<typeof segment>;a:[number,number];b:[number,number]}|undefined;
  const candidates=grid.get(Math.floor(tree.x/cell)+','+Math.floor(tree.z/cell))||[];
  for(const {a,b} of candidates){
   const edge=segment(tree.x,tree.z,a,b);
   if(edge.d<=pad&&(!nearest||edge.d<nearest.edge.d))nearest={edge,a,b};
  }
  if(!nearest||nearest.edge.d<1.3||nearest.edge.d>13)continue;
  if(beach.some(a=>inside(tree.x,tree.z,a.points)))continue;
  const dx=nearest.b[0]-nearest.a[0],dz=nearest.b[1]-nearest.a[1],len=Math.hypot(dx,dz);
  const px=nearest.a[0]+dx*nearest.edge.t,pz=nearest.a[1]+dz*nearest.edge.t;
  const vx=px-tree.x,vz=pz-tree.z,angle=Math.atan2(vx,vz),rootLen=Math.min(4.5,Math.max(1.2,nearest.edge.d*.67));
  for(const shift of [-.44,.30]){
   const a=angle+shift,tipX=tree.x+Math.sin(a)*rootLen,tipZ=tree.z+Math.cos(a)*rootLen;
   if(occupied(tipX,tipZ,'',2.5)||!terrain.land(tipX,tipZ)||terrain.obstructed(tipX,tipZ,.08)||beach.some(b=>inside(tipX,tipZ,b.points)))continue;
   roots.push({x:tree.x,y:terrain.height(tree.x,tree.z)+.12,z:tree.z,angle:a,length:rootLen,thickness:.12+.10*tree.scale});
  }
 }
 return roots.slice(0,170);
}
export function addCanalRoots(scene:T.Scene,map:ParkMap,terrain:ParkTerrain,trees:readonly Plant[]){
 const roots=planCanalRoots(map,terrain,trees),geo=new T.CylinderGeometry(.34,.8,1,5,2);
 geo.rotateX(Math.PI/2);
 const mat=new T.MeshStandardMaterial({name:'Exposed Belle Isle canal tree roots',color:0x736453,roughness:.96,metalness:0});
 mat.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 rootLocal;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nrootLocal=position;');
  shader.fragmentShader='varying vec3 rootLocal;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float bark=.5+.25*sin(rootLocal.x*28.+rootLocal.z*6.)+.25*sin(rootLocal.z*19.-rootLocal.x*7.);
   diffuseColor.rgb*=.82+.22*bark;
  `);
 };mat.customProgramCacheKey=()=> 'canal-root-bark-v1';
 const mesh=new T.InstancedMesh(geo,mat,roots.length),dummy=new T.Object3D();
 mesh.name='Canal and riparian exposed root systems';mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.visible=false;mesh.count=0;
 scene.add(mesh);
 let quality:'smooth'|'automatic'|'high'='automatic',lastX=Infinity,lastZ=Infinity;
 const stats={total:roots.length,visible:0,maxDraws:1};
 return{stats,rootSites:roots,
 setQuality(q:string){quality=q==='smooth'||q==='high'?q:'automatic';lastX=Infinity;},
 update(x:number,z:number){
  if(Math.hypot(x-lastX,z-lastZ)<6)return;lastX=x;lastZ=z;
  const b=ROOT_LIMITS[quality],near=roots.filter(r=>Math.hypot(r.x-x,r.z-z)<b.range)
   .sort((a,c)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(c.x-x,c.z-z)).slice(0,b.count);
  mesh.count=near.length;mesh.visible=mesh.count>0;stats.visible=mesh.count;
  near.forEach((r,i)=>{
   dummy.position.set(r.x+Math.sin(r.angle)*r.length*.46,r.y-.07,r.z+Math.cos(r.angle)*r.length*.46);
   dummy.rotation.set(0,r.angle,0);dummy.scale.set(r.thickness,r.thickness,r.length);
   dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  });
  if(mesh.count)mesh.instanceMatrix.needsUpdate=true;
 }};
}
