import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {districts} from './detroitGround.ts';
import {planDetroitProps} from './detroitProps.ts';
import {warmLandmarkPrograms} from './landmarkPrograms.ts';
import {warmObjectTextures} from './startupWork.ts';
import type {ParkTerrain,Point} from './terrain.ts';

type Building=typeof districts.buildings[number];
const loader=new GLTFLoader();
const streets=new URL('./districtModels/street-at-sunset.glb',import.meta.url).href;
const scenery=new URL('./districtModels/detroit-scenery.glb',import.meta.url).href;
const landmarks:Record<string,string>={
 'elmwood-gatehouse':new URL('./districtModels/elmwood-gatehouse.glb',import.meta.url).href,
 'elmwood-entrance-sign':new URL('./districtModels/elmwood-entrance-sign.glb',import.meta.url).href,
 'elmwood-chapel':new URL('./districtModels/elmwood-chapel.glb',import.meta.url).href,
};
type Fit={id:string;x:number;z:number;yaw:number;w:number;d:number;h:number};
export function fitStreetBuilding(b:Building):Fit|undefined {
 const ring=b.points;let longest=0,angle=0,area=0;
 for(let i=0;i<ring.length;i++){
  const a=ring[i],c=ring[(i+1)%ring.length],dx=c[0]-a[0],dz=c[1]-a[1],l=Math.hypot(dx,dz);
  area+=a[0]*c[1]-a[1]*c[0];if(l>longest){angle=Math.atan2(dz,dx);longest=l;}
 }
 const co=Math.cos(angle),si=Math.sin(angle);
 const us=ring.map(([x,z])=>x*co+z*si),vs=ring.map(([x,z])=>-x*si+z*co);
 const u0=Math.min(...us),u1=Math.max(...us),v0=Math.min(...vs),v1=Math.max(...vs);
 const w=u1-u0,d=v1-v0,u=(u0+u1)/2,v=(v0+v1)/2;
 if(Math.min(w,d)<4||Math.max(w,d)>110||Math.abs(area)/(2*w*d)<.89)return;
 return {id:b.id,x:u*co-v*si,z:u*si+v*co,yaw:-angle,w:w*.98,d:d*.98,h:b.height};
}
function matrix(x:number,y:number,z:number,yaw:number,w:number,h:number,d:number){
 const m=new T.Matrix4().makeRotationY(yaw);m.scale(new T.Vector3(w,h,d));m.setPosition(x,y,z);return m;
}
function instances(stage:T.Group,object:T.Object3D,locations:T.Matrix4[],name:string,maxDistance:number,street=false){
 const cells=new Map<string,T.Matrix4[]>();
 for(const m of locations){const key=Math.floor(m.elements[12]/240)+','+Math.floor(m.elements[14]/240);
  const group=cells.get(key)??[];group.push(m);cells.set(key,group);}
 const tiles:{mesh:T.InstancedMesh;cx:number;cz:number;range:number}[]=[];
 object.updateMatrixWorld(true);
 object.traverse(o=>{if(!(o instanceof T.Mesh))return;
  for(const [key,transforms] of cells){
   const batch=new T.InstancedMesh(o.geometry,o.material,transforms.length),combined=new T.Matrix4();
   transforms.forEach((m,i)=>batch.setMatrixAt(i,combined.multiplyMatrices(m,o.matrixWorld)));
   batch.computeBoundingSphere();batch.name=name;batch.receiveShadow=true;stage.add(batch);
   const bs=batch.boundingSphere!,cell=key.split(',').map(Number);tiles.push({mesh:batch,cx:street?(cell[0]+.5)*240:bs.center.x,cz:street?(cell[1]+.5)*240:bs.center.z,range:street?maxDistance:maxDistance+bs.radius});
  }
 });
 return tiles;
}
export function streamDetroitArt(scene:T.Scene,renderer:T.WebGLRenderer,terrain:ParkTerrain,fits:Fit[],fallback:T.Group,architecturalProxies:Map<string,T.Mesh>){
 const tiles:ReturnType<typeof instances>=[];
 const started=new Set<string>(),retry=new Map<string,number>();
 let preparation=Promise.resolve();
 let lastX=Infinity,lastZ=Infinity,streetsReady=false;
 // Keep the map proxies visible until an entire pack is prepared against the
 // active lights. Only register its tiles after upload and program reflection.
 type PreparePack=(pack:T.Group,stage:T.Group)=>()=>void;
 function load(url:string,camera:T.Camera,prepare:PreparePack){
  if(started.has(url)||performance.now()<(retry.get(url)??0))return;
  retry.delete(url);
  started.add(url);
  void loader.loadAsync(url).then(({scene:pack})=>{
   const task=preparation.then(async()=>{
    const stage=new T.Group();
    const publish=prepare(pack,stage);
    await warmObjectTextures(renderer,stage);
    await warmLandmarkPrograms(renderer,stage,camera,scene);
    // The current location may have changed while the driver was compiling.
    // The next world update chooses visible batches before Three draws them.
    ready.set(stage,publish);
    lastX=Infinity;
   });
   preparation=task.catch(()=>{});
   return task;
  }).catch(error=>{
   started.delete(url);
   retry.set(url,performance.now()+15000);
   console.warn('District art unavailable',url,error);
  });
 }
 const ready=new Map<T.Group,()=>void>();
 function prepareStreets(pack:T.Group,stage:T.Group){
  const batches:ReturnType<typeof instances>=[];
  for(let i=0;i<4;i++){
   const prototype=pack.getObjectByName('SunsetBlock'+(i+1));if(!prototype)throw Error('Missing Sunset block');
   const group=fits.filter((_,n)=>n%4===i).map(p=>matrix(p.x,terrain.height(p.x,p.z)-.05,p.z,p.yaw,p.w,p.h,p.d));
   batches.push(...instances(stage,prototype,group,'Street at Sunset · city blocks',405,true));
  }
  return ()=>{tiles.push(...batches);streetsReady=true;};
 }
 function prepareProps(pack:T.Group,stage:T.Group){
  const batches:ReturnType<typeof instances>=[];
  for(const [name,items] of planDetroitProps(terrain)){
   const positions=items.map(p=>matrix(p.x,terrain.height(p.x,p.z),p.z,p.yaw,p.scale,p.scale,p.scale));
   const proto=pack.getObjectByName(name+'__LOD0');if(!proto)throw Error('Missing scenery '+name);
   batches.push(...instances(stage,proto,positions,name,name==='CityFacade'?650:140));
  }
  return ()=>{tiles.push(...batches);};
 }
 return (x:number,z:number,camera:T.Camera)=>{
  if(Math.hypot(x-lastX,z-lastZ)<16&&Math.min(...retry.values())>performance.now())return;
  lastX=x;lastZ=z;
  // Begin on the bridge between the island landing and the mainland.
  if(x<520)load(streets,camera,prepareStreets);
  load(scenery,camera,prepareProps);
  for(const p of districts.models)if(Math.hypot(p.point[0]-x,p.point[1]-z)<(p.asset==='elmwood-chapel'?270:350)){
   load(landmarks[p.asset],camera,(object,stage)=>{
    object.position.set(p.point[0],terrain.height(...p.point),p.point[1]);
    object.rotation.y=p.yaw;object.scale.setScalar(p.scale);object.name=p.asset;
    stage.add(object);
    return ()=>{
     const proxy=architecturalProxies.get(p.asset);
     if(proxy)proxy.visible=false;
    };
   });
  }
  for(const [stage,publish] of ready){scene.add(stage);publish();}
  ready.clear();
  if(streetsReady)for(const proxy of fallback.children){const [cx,cz]=proxy.userData.tile as Point;proxy.visible=Math.hypot(x-cx,z-cz)>=405;}
  for(const t of tiles)t.mesh.visible=Math.hypot(x-t.cx,z-t.cz)<t.range;
 };
}
