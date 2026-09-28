// Original Detroit geometry, with approximate metre-scale map references.
// Local -Z follows the east riverfront; +X points inland. Not survey geometry.
import {CITY,CUT_METRES,pointOnCut,nearestCut,roadAt,riverEdge,nearestRiverPoint,inCity} from './geography.ts';
import RAPIER from '@dimforge/rapier3d-compat';
import {GEO,profileLevel,cutWidth,nearestRamp} from './geo-profile.ts';
import {geospatialMeshes,buildingPartGeometry} from './geo-geometry.ts';
import {mappedSpline} from './mapped-spline.ts';
import {cyclistLoop} from './cyclist-route.ts';
import {CITY_DETAIL,cityElevation,landAt,inMappedRiver,RIVER_Y} from './city-spatial.ts';
import type { TerrainSampler, GroundSample, Vec3, ObstacleHit, SurfaceId } from '../simulation/world.ts';
export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export const hash=(v:number)=>Math.abs(Math.sin(v*127.1+311.7)*43758.5453)%1;
export const CUT_LENGTH=CUT_METRES;
export const CUT_START=pointOnCut(0);
export const CUT_DIR={x:.8660254038,z:-.5};
export const CUT_HEADING=Math.atan2(CUT_DIR.x,CUT_DIR.z);
export const LENGTH=4050;
export const ACCESS=[174.63,239.21,...GEO.ramps.map(r=>r.at),CUT_METRES-20];
export const BRIDGES=GEO.bridges.map(c=>c.at);
export const CUT_STATIONS=[
  {name:'Atwater / Dequindre Cut entrance',at:0},...GEO.bridges,
  {name:'Mack Avenue',at:CUT_METRES}
].sort((a,b)=>a.at-b.at);
export function cutPoint(d:number,u=0){return pointOnCut(d,u);}
export function cutCoords(x:number,z:number){return nearestCut(x,z);}
function streetSpawn(name:string){const road=CITY.roads.find(r=>r.name===name&&r.points.length>3)!;const p=road.points[Math.floor(road.points.length/2)];return{x:p[0],z:p[1],heading:Math.PI};}
export const SPOTS=[
  {name:'GM Renaissance Center',...nearestRiverPoint(10),heading:Math.PI},
  {name:'Hart Plaza',...nearestRiverPoint(360),heading:Math.PI},
  {name:'Cullen Plaza / carousel',...nearestRiverPoint(-670),heading:Math.PI},
  {name:'Milliken State Park / lighthouse',...nearestRiverPoint(CITY_DETAIL.landmarks.find(l=>l.asset==='DS_Milliken_Lighthouse')!.point[1]),heading:0},
  {name:'Dequindre Cut entrance',...cutPoint(80),heading:pointOnCut(80).heading},
  {name:'Campbell Terrace',...cutPoint(1030),heading:pointOnCut(1030).heading},
  {name:'Eastern Market / Freight Yard',...cutPoint(2050),heading:pointOnCut(2050).heading},
  {name:'Mack Avenue',...cutPoint(CUT_METRES-20),heading:pointOnCut(CUT_METRES-20).heading+Math.PI},
  {name:'East Jefferson Avenue / city streets',...streetSpawn('East Jefferson Avenue')},
  {name:'Gratiot Avenue / downtown blocks',...streetSpawn('Gratiot Avenue')},
  {name:'Gratiot overpass / Cut origin',...cutPoint(GEO.bridges.find(b=>b.name==='Gratiot Avenue')!.at),heading:pointOnCut(GEO.bridges.find(b=>b.name==='Gratiot Avenue')!.at).heading},
];
export const CHECKPOINTS=[
  {name:'Hart Plaza',...nearestRiverPoint(350)},{name:'GM Plaza',...nearestRiverPoint(10)},
  {name:'Cullen Plaza',...nearestRiverPoint(-670)},{name:'Cut entrance',...cutPoint(70)},
  {name:'Lafayette',...cutPoint(CITY.crossings.find(c=>c.name==='East Lafayette Street')!.at)},{name:'Gratiot',...cutPoint(CITY.crossings.find(c=>c.name==='Gratiot Avenue')!.at)},
  {name:'Freight Yard',...cutPoint(2050)},{name:'Mack Avenue',...cutPoint(CUT_METRES-20)},
];
export function locationAt(x:number,z:number){
  const c=cutCoords(x,z);
  if(c.d>30&&Math.abs(c.u)<100)return [...CUT_STATIONS].reverse().find(s=>c.d>=s.at)?.name??'Dequindre Cut';
  const street=roadAt(x,z);if(street?.name&&x>160)return street.name;
  if(z>170)return 'Hart Plaza';
  if(z> -260)return x>55?'Renaissance Center':'GM Plaza / Riverwalk';
  if(z> -650)return 'Atwater Street / Riverwalk';
  if(z> -1100)return 'Cullen Plaza';
  return 'Milliken State Park';
}
export function isAccess(x:number,z:number){
  const c=cutCoords(x,z),r=nearestRamp(x,z);return r.distance<r.width/2+2||c.d<280||c.d>CUT_LENGTH-45;
}
export function heightAt(x:number,z:number){
  if(inMappedRiver(x,z))return RIVER_Y-.6;
  const base=cityElevation(x,z);
  const c=cutCoords(x,z);
  if(c.d<0||c.d>CUT_LENGTH+45)return base;
  const floor=profileLevel(c.d,'floor'),street=profileLevel(c.d,'street');
  const shoulder=cutWidth(c.d)/2+2;
  let h=floor+(street-floor)*clamp((Math.abs(c.u)-shoulder)/22,0,1);
  const blendCity=clamp((Math.abs(c.u)-40)/35,0,1);
  h=h*(1-blendCity)+base*blendCity;
  const ramp=nearestRamp(x,z),blend=1-clamp((ramp.distance-ramp.width/2)/3,0,1);
  return h*(1-blend)+ramp.height*blend;
}
export function surfaceAt(x:number,z:number):SurfaceId{
  const mapped=roadAt(x,z);if(mapped)return ['footway','pedestrian','path'].includes(mapped.kind)?'brick':'pavement';
  const c=cutCoords(x,z);
  if(c.d>0&&c.d<CUT_LENGTH+40&&Math.abs(c.u)<110){
    if(Math.abs(c.u)<4||isAccess(x,z))return 'pavement';
    if(c.d>2570&&c.d<2730&&c.u>5&&c.u<45)return 'brick';
    return 'grass';
  }
  const land=landAt(x,z);
  if(land?.kind==='green')return 'grass';
  if(land?.kind==='plaza')return 'brick';
  return 'pavement';
}
export interface TerrainChunk{x:number;z:number;vertices:Float32Array;indices:Uint32Array;surfaces:SurfaceId[]}
export function terrainChunks():TerrainChunk[]{
  const chunks:TerrainChunk[]=[];
  for(let x0=-900;x0<4250;x0+=100)for(let z0=-4200;z0<1100;z0+=100){
    const cx=x0+50,cz=z0+50,c=cutCoords(cx,cz);
    if(!inCity(cx,cz))continue;
    const vertices:number[]=[],indices:number[]=[],surfaces:SurfaceId[]=[];
    // Fine collision triangles keep the narrow access ramps at their mapped grade.
    const step=nearestRamp(cx,cz).distance<85?1:Math.abs(c.u)<100&&c.d> -80&&c.d<CUT_LENGTH+80?2:Math.abs(cx-riverEdge(cz))<110?2:20,n=100/step;
    for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const x=x0+i*step,z=z0+j*step;vertices.push(x,heightAt(x,z),z);}
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){
      const a=j*(n+1)+i,b=a+1,c=a+n+1,d=c+1;indices.push(a,c,b,b,c,d);
      const s=surfaceAt(x0+(i+.5)*step,z0+(j+.5)*step);surfaces.push(s,s);
    }
    chunks.push({x:cx,z:cz,vertices:new Float32Array(vertices),indices:new Uint32Array(indices),surfaces});
  }
  return chunks;
}
export interface Solid{x:number;y:number;z:number;hx:number;hy:number;hz:number;kind:string;yaw?:number}
export function worldSolids():Solid[]{
  const s:Solid[]=[];
  // Hart Plaza fountain and Transcending sculpture bases.
  const fountain=CITY_DETAIL.landmarks.find(l=>l.asset==='DS_Hart_Dodge_Fountain')!.point;
  const sculpture=CITY_DETAIL.landmarks.find(l=>l.asset==='DS_Hart_Transcending')!.point;
  s.push({x:fountain[0],y:heightAt(...fountain as [number,number])+1.8,z:fountain[1],hx:14,hy:1.8,hz:14,kind:'fountain'});
  s.push({x:sculpture[0],y:heightAt(...sculpture as [number,number])+.4,z:sculpture[1],hx:4,hy:.4,hz:4,kind:'sculpture'});
  return s;
}
export interface TrafficState{id:number;kind:'pedestrian'|'cyclist'|'cone'|'barrier';x:number;y:number;z:number;heading:number;speed:number}
export const CUT_TRAFFIC=mappedSpline(CITY.cut);
export const RIVER_TRAFFIC=mappedSpline(CITY.roads.find(r=>r.id==='69706033')!.points);
const riverDistances=[0];for(let i=1;i<RIVER_TRAFFIC.samples.length;i++)riverDistances.push(riverDistances[i-1]+RIVER_TRAFFIC.samples[i].distanceTo(RIVER_TRAFFIC.samples[i-1]));
const riverTrafficStarts=Array.from({length:26},(_,id)=>{
  const z=400-id*67+25;let nearest=0;
  for(let i=1;i<RIVER_TRAFFIC.samples.length;i++)if(Math.abs(RIVER_TRAFFIC.samples[i].z-z)<Math.abs(RIVER_TRAFFIC.samples[nearest].z-z))nearest=i;
  return clamp(riverDistances[nearest]-25,2,RIVER_TRAFFIC.length-52);
});
export function trafficAt(id:number,time:number):TrafficState{
  const kind=id%11===0?'barrier':id%7===0?'cone':id%3===0?'cyclist':'pedestrian';
  if(kind==='cyclist'){
    const sample=(t:number)=>{
      const lane=cyclistLoop(t+id*2.3);
      if(id>=26)return{...CUT_TRAFFIC.sample(160+(id-26)*66+lane.travel,lane.offset),speed:lane.speed};
      return{...RIVER_TRAFFIC.sample(riverTrafficStarts[id]+lane.travel,lane.offset),speed:lane.speed};
    };
    const p=sample(time),before=sample(time-.06),after=sample(time+.06);
    return{id,kind,x:p.x,y:heightAt(p.x,p.z),z:p.z,heading:Math.atan2(after.x-before.x,after.z-before.z),speed:p.speed};
  }
  const speed=kind==='pedestrian'?1.1:0;
  const phase=(time*speed+id*7)%100,travel=phase<50?phase:100-phase;
  const dir=phase<50?1:-1;
  let z=400-id*67+travel;const rp=nearestRiverPoint(z);let x=rp.x+(id%2?1:-1)*2.4,heading=dir>0?0:Math.PI;
  if(id>=26){const d=160+(id-26)*66+travel,offset=speed?(id%2?1:-1)*1.65:cutWidth(d)/2+1.2,p=CUT_TRAFFIC.sample(d,offset);x=p.x;z=p.z;heading=p.heading+(dir<0?Math.PI:0);}
  return{id,kind,x,y:heightAt(x,z),z,heading,speed};
}
export class DetroitWorld implements TerrainSampler{
  physics!:RAPIER.World;
  chunks=terrainChunks();solids=worldSolids();
  geoMeshes=geospatialMeshes(heightAt);
  metadata=new Map<number,{hx:number;hz:number}>();
  trafficBodies=new Map<number,RAPIER.Collider>();traffic:TrafficState[]=[];
  async init(){
    await RAPIER.init();this.physics=new RAPIER.World({x:0,y:-9.81,z:0});
    for(const c of this.chunks)this.physics.createCollider(RAPIER.ColliderDesc.trimesh(c.vertices,c.indices).setCollisionGroups(0x0001ffff));
    for(const s of this.solids)this.addBox(s);
    for(const m of this.geoMeshes){const p=m.geometry.attributes.position,index=m.geometry.index;this.addMesh(new Float32Array(p.array),index?new Uint32Array(index.array):Uint32Array.from({length:p.count},(_,i)=>i));}
    for(const p of CITY_DETAIL.buildingParts.filter(p=>p.rencen)){
      const g=buildingPartGeometry(p,heightAt),v=g.attributes.position;
      this.addMesh(new Float32Array(v.array),g.index?new Uint32Array(g.index.array):Uint32Array.from({length:v.count},(_,i)=>i));g.dispose();
    }
    this.updateTraffic(0,0,0);this.step();return this;
  }
  addBox(s:Solid){const desc=RAPIER.ColliderDesc.cuboid(s.hx,s.hy,s.hz).setTranslation(s.x,s.y,s.z).setCollisionGroups(0x0002ffff);if(s.yaw)desc.setRotation({x:0,y:Math.sin(s.yaw/2),z:0,w:Math.cos(s.yaw/2)});const c=this.physics.createCollider(desc);this.metadata.set(c.handle,{hx:s.hx,hz:s.hz});return c;}
  addMesh(vertices:Float32Array,indices:Uint32Array){
    return this.physics.createCollider(RAPIER.ColliderDesc.trimesh(vertices,indices).setCollisionGroups(0x0002ffff));
  }
  sampleGround(x:number,z:number,out:GroundSample){
    const hit=this.physics.castRayAndGetNormal(new RAPIER.Ray({x,y:60,z},{x:0,y:-1,z:0}),100,true,undefined,0xffff0001);
    out.height=hit?60-hit.timeOfImpact:heightAt(x,z);Object.assign(out.normal,hit?.normal??{x:0,y:1,z:0});
    out.surface=surfaceAt(x,z);out.offCourse=!hit||inMappedRiver(x,z);return out;
  }
  raycast(origin:Vec3,direction:Vec3,maxDistance:number){
    const n=Math.hypot(direction.x,direction.y,direction.z);if(n<1e-8)return null;
    return this.physics.castRay(new RAPIER.Ray(origin,{x:direction.x/n,y:direction.y/n,z:direction.z/n}),maxDistance,true)?.timeOfImpact??null;
  }
  raycastObstacle(origin:Vec3,direction:Vec3,maxDistance:number,sweepHalfWidth=0,sweepLateral?:Vec3,out?:ObstacleHit){
    const n=Math.hypot(direction.x,direction.y,direction.z);if(n<1e-8)return null;
    const dir={x:direction.x/n,y:direction.y/n,z:direction.z/n},lat=sweepLateral??{x:dir.z,y:0,z:-dir.x};
    let best:ReturnType<RAPIER.World['castRay']>=null;
    for(const t of sweepHalfWidth?[-1,-.5,0,.5,1]:[0]){
      const o={x:origin.x+lat.x*t*sweepHalfWidth,y:origin.y+lat.y*t*sweepHalfWidth,z:origin.z+lat.z*t*sweepHalfWidth};
      const h=this.physics.castRay(new RAPIER.Ray(o,dir),maxDistance,true,undefined,0xffff0002);
      if(h&&(!best||h.timeOfImpact<best.timeOfImpact))best=h;
    }
    if(best&&out){const m=this.metadata.get(best.collider.handle);out.distance=best.timeOfImpact;out.halfExtentX=m?.hx??.35;out.halfExtentZ=m?.hz??.35;}
    return best?.timeOfImpact??null;
  }
  updateTraffic(time:number,px:number,pz:number){
    this.traffic=[];const active=new Set<number>();
    for(let id=0;id<62;id++){
      const t=trafficAt(id,time);if(Math.hypot(t.x-px,t.z-pz)>115)continue;
      this.traffic.push(t);active.add(id);let c=this.trafficBodies.get(id);
      const hy=t.kind==='cone'?.35:t.kind==='barrier'?.48:.84;
      if(!c){c=this.physics.createCollider(RAPIER.ColliderDesc.cuboid(t.kind==='barrier'?.6:.28,hy,t.kind==='cyclist'?.85:.3).setCollisionGroups(0x0002ffff));this.trafficBodies.set(id,c);this.metadata.set(c.handle,{hx:.35,hz:.35});}
      c.setTranslation({x:t.x,y:t.y+hy,z:t.z});c.setRotation({x:0,y:Math.sin(t.heading/2),z:0,w:Math.cos(t.heading/2)});
    }
    for(const[id,c]of this.trafficBodies)if(!active.has(id)){this.metadata.delete(c.handle);this.physics.removeCollider(c,true);this.trafficBodies.delete(id);}
  }
  step(){this.physics.timestep=1/120;this.physics.step();}
}
export const RENCEN_TOWERS=[
  {x:61,z:-48,r:22,h:221},{x:9,z:1,r:19,h:159},{x:9,z:-97,r:19,h:159},
  {x:114,z:1,r:19,h:159},{x:114,z:-97,r:19,h:159},
  {x:114,z:-180,r:18,h:103},{x:114,z:-235,r:18,h:103},
];
