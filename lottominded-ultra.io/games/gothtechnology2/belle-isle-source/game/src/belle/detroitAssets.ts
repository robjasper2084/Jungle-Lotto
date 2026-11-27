import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {districts} from './detroitGround.ts';
import {planDetroitProps} from './detroitProps.ts';
import {warmLandmarkPrograms} from './landmarkPrograms.ts';
import {warmObjectTextures} from './startupWork.ts';
import {prepareJeffersonBuildingSkins,prepareJeffersonStreetKit,type JeffersonBuildingSelection} from './jeffersonAssetSkins.ts';
import {JEFFERSON_BUILDING_PLACEMENTS,JEFFERSON_PROP_PLACEMENTS} from './jeffersonPlacements.ts';
import models from './districtModelUrls.ts';
import type {ParkTerrain,Point} from './terrain.ts';

type Building=typeof districts.buildings[number];
const loader=new GLTFLoader();
const jeffersonSnapshots=new WeakMap<T.Scene,()=>unknown>();
/** Read-only review telemetry; no camera/player setters and no frame-loop work. */
export const jeffersonAssetSnapshot=(scene:T.Scene)=>jeffersonSnapshots.get(scene)?.()??null;
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
 const jeffersonEnabled=(import.meta as ImportMeta & {env?:Record<string,string|undefined>}).env?.VITE_JEFFERSON_ASSET_SKINS!=='0';
 const state={enabled:jeffersonEnabled,buildings:jeffersonEnabled?'waiting':'disabled',props:jeffersonEnabled?'waiting':'disabled',errors:[] as string[]};
 const jeffersonTiles:ReturnType<typeof instances>=[],propTiles:{object:T.Object3D;x:number;z:number}[]=[];
 const problem=(part:'buildings'|'props',error:unknown)=>{state[part]='fallback';state.errors.push(part+': '+String(error));if(state.errors.length>8)state.errors.shift();};
 jeffersonSnapshots.set(scene,()=>({...state,errors:[...state.errors],assignmentIds:JEFFERSON_BUILDING_PLACEMENTS.map(p=>p.buildingId),
  visibleBuildingBatches:jeffersonTiles.filter(t=>t.mesh.visible).length,
  fittedBuildings:JEFFERSON_BUILDING_PLACEMENTS.map(p=>{
   const fit=fits.find(f=>f.id===p.buildingId),building=districts.buildings.find(b=>b.id===p.buildingId);
   const proxy=fit?fallback.children.find(o=>{const c=o.userData.tile as Point;return c?.[0]===(Math.floor(fit.x/240)+.5)*240&&c?.[1]===(Math.floor(fit.z/240)+.5)*240;}):undefined;
   return {id:p.buildingId,prototype:p.prototype,fit:fit?{...fit}:undefined,baseY:building?terrain.height(...building.points[0]):null,proxyVisible:proxy?.visible??null};
  }),propsVisible:propTiles.filter(p=>p.object.visible).map(p=>p.object.name)}));
 const started=new Set<string>(),retry=new Map<string,number>();
 let preparation=Promise.resolve();
 let lastX=Infinity,lastZ=Infinity,streetsReady=false;
 // Keep the map proxies visible until an entire pack is prepared against the
 // active lights. Only register its tiles after upload and program reflection.
 type PublishPack=(()=>void)&{abort?:()=>void};
 type PreparePack=(pack:T.Group,stage:T.Group,camera:T.Camera)=>PublishPack|Promise<PublishPack>;
 function load(url:string,camera:T.Camera,prepare:PreparePack){
  if(started.has(url)||performance.now()<(retry.get(url)??0))return;
  retry.delete(url);
  started.add(url);
  void loader.loadAsync(url).then(({scene:pack})=>{
   const task=preparation.then(async()=>{
    const stage=new T.Group();
    const publish=await prepare(pack,stage,camera);
    try {
     await warmObjectTextures(renderer,stage);
     await warmLandmarkPrograms(renderer,stage,camera,scene);
    }catch(error){publish.abort?.();throw error;}
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
 async function prepareStreets(pack:T.Group,stage:T.Group):Promise<PublishPack>{
  const batches:ReturnType<typeof instances>=[];
  const selectedBatches:ReturnType<typeof instances>=[];
  if(jeffersonEnabled)state.buildings='preparing';
  let selection:JeffersonBuildingSelection|undefined;
  // Empty/disabled allowlists make no request. A failed skin pack leaves the
  // entire original street pack available; no partial ID selection is published.
  try{selection=await prepareJeffersonBuildingSkins(fits,loader,{enabled:jeffersonEnabled,assignments:JEFFERSON_BUILDING_PLACEMENTS,footprints:districts.buildings});}
  catch(error){problem('buildings',error);console.warn('Jefferson skin pack unavailable; keeping original street art',error);}
  try{
   for(let i=0;i<4;i++){
    const prototype=pack.getObjectByName('SunsetBlock'+(i+1));if(!prototype)throw Error('Missing Sunset block');
    // Keep the original index-to-variant mapping when removing selected IDs.
    const group=fits.filter((fit,n)=>n%4===i&&!selection?.byBuildingId.has(fit.id))
     .map(p=>matrix(p.x,terrain.height(p.x,p.z)-.05,p.z,p.yaw,p.w,p.h,p.d));
    batches.push(...instances(stage,prototype,group,'Street at Sunset · city blocks',405,true));
   }
   if(selection){
    for(const prototype of new Set(selection.byBuildingId.values())){
     const group=fits.filter(fit=>selection!.byBuildingId.get(fit.id)===prototype).map(p=>{
      const assignment=JEFFERSON_BUILDING_PLACEMENTS.find(a=>a.buildingId===p.id)!;
      const original=districts.buildings.find(b=>b.id===p.id)!;
      // Assigned geometry is anchored to the unchanged mapped collider base.
      return matrix(p.x,terrain.height(...original.points[0]),p.z,p.yaw+(assignment.yawOffset??0),p.w,p.h,p.d);
     });
     const added=instances(stage,prototype,group,'Jefferson · '+prototype.name,405,true);
     batches.push(...added);selectedBatches.push(...added);
    }
   }
  }catch(error){selection?.dispose();jeffersonTiles.length=0;throw error;}
  // The existing load() transaction warms every source first. Original map
  // proxies are hidden only when this combined original/new stage publishes.
  const publish:PublishPack=()=>{tiles.push(...batches);jeffersonTiles.push(...selectedBatches);streetsReady=true;if(selection)state.buildings='published';};
  publish.abort=()=>{selection?.dispose();jeffersonTiles.length=0;if(jeffersonEnabled)state.buildings='fallback';};
  return publish;
 }
 async function prepareProps(pack:T.Group,stage:T.Group,camera:T.Camera):Promise<PublishPack>{
  const batches:ReturnType<typeof instances>=[];
  for(const [name,items] of planDetroitProps(terrain)){
   const positions=items.map(p=>matrix(p.x,terrain.height(p.x,p.z),p.z,p.yaw,p.scale,p.scale,p.scale));
   const proto=pack.getObjectByName(name+'__LOD0');if(!proto)throw Error('Missing scenery '+name);
   batches.push(...instances(stage,proto,positions,name,name==='CityFacade'?650:140));
  }
  let streetKit:Awaited<ReturnType<typeof prepareJeffersonStreetKit>>;
  if(jeffersonEnabled)state.props='preparing';
  try{streetKit=await prepareJeffersonStreetKit({enabled:jeffersonEnabled,placements:JEFFERSON_PROP_PLACEMENTS,loader,scene,camera,ground:terrain,
   roads:[...terrain.map.roads,...districts.roads],warmTextures:group=>warmObjectTextures(renderer,group),
   warmPrograms:(group,view,world)=>warmLandmarkPrograms(renderer,group,view,world)});
  }catch(error){problem('props',error);console.warn('Jefferson street details unavailable; keeping original scenery',error);}
  const publish:PublishPack=()=>{
   tiles.push(...batches);
   if(streetKit){streetKit.publish();state.props='published';for(const object of streetKit.group.children)propTiles.push({object,x:object.position.x,z:object.position.z});}
  };
  publish.abort=()=>{streetKit?.dispose();if(jeffersonEnabled)state.props='fallback';};
  return publish;
 }
 return (x:number,z:number,camera:T.Camera)=>{
  if(Math.hypot(x-lastX,z-lastZ)<16&&Math.min(...retry.values())>performance.now())return;
  lastX=x;lastZ=z;
  // Begin on the bridge between the island landing and the mainland.
  if(x<520)load(models['street-at-sunset'],camera,prepareStreets);
  load(models['detroit-scenery'],camera,prepareProps);
  for(const p of districts.models)if(Math.hypot(p.point[0]-x,p.point[1]-z)<(p.asset==='elmwood-chapel'?270:350)){
   load(models[p.asset],camera,(object,stage)=>{
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
  for(const p of propTiles)p.object.visible=Math.hypot(x-p.x,z-p.z)<140;
 };
}
