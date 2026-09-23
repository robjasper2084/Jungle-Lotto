import {parkContains} from './freestylePark.ts';
import {courseFeatures,featureContact,rampLift,type CourseFeature} from './courseFeatures.ts';
import {routeHazards} from './routeHazards.ts';
import {advanceCrowd,type CrowdAgent} from './crowdFlow.ts';
import {TrafficFall} from './trafficFall.ts';
import type {ActorImpact} from './terrain.ts';
import type {RidePose} from './controller.ts';
import {encounterOptions} from './encounterSafety.ts';
import {actorBlocksMountedSpace,RECOVERY_SPACE_SECONDS} from './recovery.ts';
// Original Detroit geometry, with approximate metre-scale map references.
// Local -Z follows the east riverfront; +X points inland. Not survey geometry.
import {CITY,CUT_METRES,pointOnCut,nearestCut,roadAt,riverEdge,nearestRiverPoint,inCity} from './geography.ts';
import RAPIER from '@dimforge/rapier3d-compat';
import {GEO,profileLevel,cutWidth,nearestRamp} from './geo-profile.ts';
import {geospatialMeshes,buildingEnvelope} from './geo-geometry.ts';
import {mappedSpline} from './mapped-spline.ts';
import type { TerrainSampler, GroundSample, Vec3, ObstacleHit, SurfaceId, NavigationObstacle } from './terrain.ts';
export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export const hash=(v:number)=>Math.abs(Math.sin(v*127.1+311.7)*43758.5453)%1;
export const CUT_LENGTH=CUT_METRES;
export const CUT_START=pointOnCut(0);
export const CUT_DIR={x:.8660254038,z:-.5};
export const CUT_HEADING=Math.atan2(CUT_DIR.x,CUT_DIR.z);
export const LENGTH=CUT_METRES;
// Preserve the mapped Mack tie-in, then blend the authored surrounding terrain
// back to the city datum at a gentle grade. Render and physics share this surface.
export const MACK_LANDING=80,MACK_TRANSITION_END=220;
const smoothStep=(t:number)=>{const v=clamp(t,0,1);return v*v*(3-2*v);};
export const ACCESS=[174.63,239.21,...GEO.ramps.map(r=>r.at),CUT_METRES-20];
export const BRIDGES=GEO.bridges.map(c=>c.at);
export const CUT_STATIONS=[
  {name:'Atwater / Dequindre Cut entrance',at:0},...GEO.bridges,
  {name:'Mack Avenue',at:CUT_METRES}
].sort((a,b)=>a.at-b.at);
export function cutPoint(d:number,u=0){return pointOnCut(d,u);}
export function cutCoords(x:number,z:number){return nearestCut(x,z);}
export const SPOTS=[
 {name:'Riverwalk / Cut entrance',...cutPoint(30),heading:pointOnCut(30).heading},
 {name:'Gratiot / geographic origin',...cutPoint(GEO.bridges.find(b=>b.name==='Gratiot Avenue')!.at),heading:pointOnCut(GEO.bridges.find(b=>b.name==='Gratiot Avenue')!.at).heading},
 {name:'Lafayette ramp',...cutPoint(GEO.ramps[0].at-15),heading:pointOnCut(GEO.ramps[0].at-15).heading},
 {name:'Chestnut overpass',...cutPoint(1438-20),heading:pointOnCut(1418).heading},
 {name:'Eastern Market / Freight Yard',...cutPoint(2050),heading:pointOnCut(2050).heading},
 {name:'Wilkins ramp',...cutPoint(GEO.ramps[2].at-15),heading:pointOnCut(GEO.ramps[2].at-15).heading},
 {name:'Mack Avenue',...cutPoint(CUT_METRES-20),heading:pointOnCut(CUT_METRES-20).heading+Math.PI},
 {name:'Division Street overpass',...cutPoint(GEO.bridges.find(b=>b.name==='Division Street')!.at),heading:pointOnCut(GEO.bridges.find(b=>b.name==='Division Street')!.at).heading},
 {name:'Campbell Terrace / flower garden',...cutPoint(950),heading:pointOnCut(950).heading},
 {name:'Flower banks',...cutPoint(1050),heading:pointOnCut(1050).heading},
 {name:'Woodbridge / Fit Park',...cutPoint(265),heading:pointOnCut(265).heading},
 {name:'MoGo / bike repair',...cutPoint(2130),heading:pointOnCut(2130).heading},
 {name:'Detroit heart / field sign',...cutPoint(1600),heading:pointOnCut(1600).heading+Math.PI/2},
 {name:'Adelaide / Detroit mural',...cutPoint(1864),heading:pointOnCut(1864).heading-Math.PI/2},
];
export const STATIONS=CUT_STATIONS;
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
  if(x<riverEdge(z)-3)return -1.1;
  const c=cutCoords(x,z);
  if(c.d<0)return 0;
  const floor=profileLevel(c.d,'floor'),street=profileLevel(c.d,'street');
  const shoulder=cutWidth(c.d)/2+2;
  let h=floor+(street-floor)*clamp((Math.abs(c.u)-shoulder)/22,0,1);
  h*=1-clamp((Math.abs(c.u)-90)/70,0,1);
  h*=1-smoothStep((c.d-CUT_LENGTH-MACK_LANDING)/(MACK_TRANSITION_END-MACK_LANDING));
  // Campbell Terrace opens onto the path instead of sitting on the generic bank.
  if(c.u>3&&c.u<17&&Math.abs(c.d-930.563)<14){const f=(1-clamp((Math.abs(c.d-930.563)-9)/5,0,1))*(1-clamp((c.u-14)/3,0,1));h=h*(1-f)+floor*f;}
  const ramp=nearestRamp(x,z),blend=1-clamp((ramp.distance-ramp.width/2)/3,0,1);
  return h*(1-blend)+ramp.height*blend;
}
export function surfaceAt(x:number,z:number):SurfaceId{
  if(parkContains(x,z))return 'pavement';
  const c=cutCoords(x,z);
  // Elevated streets must not paint brick/asphalt stripes onto the trail floor.
  const mapped=roadAt(x,z);
  if(mapped&&(c.distance>35||c.d<280||isAccess(x,z)))return 'pavement';
  if(c.d>0&&c.d<CUT_LENGTH+MACK_TRANSITION_END&&Math.abs(c.u)<110){
    if(Math.abs(c.u)<4||c.d<CUT_LENGTH&&isAccess(x,z))return 'pavement';
    if(c.d>2570&&c.d<2730&&c.u>5&&c.u<45)return 'brick';
    return 'grass';
  }
  if(x<28)return z>180||z< -740&&z> -1010?'brick':'pavement';
  if(Math.abs(x-52)<9||Math.abs(x-300)<14||[180,-235,-520,-760,-1060].some(s=>Math.abs(z-s)<8))return 'pavement';
  if(x<250&&z> -230&&z<170||z>220&&x<130)return 'brick';
  return 'grass';
}
export interface TerrainChunk{x:number;z:number;vertices:Float32Array;indices:Uint32Array;surfaces:SurfaceId[]}
export function terrainChunks():TerrainChunk[]{
  const chunks:TerrainChunk[]=[];
  for(let x0=-900;x0<4250;x0+=100)for(let z0=-4200;z0<1100;z0+=100){
    const cx=x0+50,cz=z0+50,c=cutCoords(cx,cz);
    if(!inCity(cx,cz)||c.distance>260)continue;
    const vertices:number[]=[],indices:number[]=[],surfaces:SurfaceId[]=[];
    // Fine collision triangles keep the narrow access ramps at their mapped grade.
    const step=nearestRamp(cx,cz).distance<85?1:Math.abs(c.u)<100&&c.d> -80&&c.d<CUT_LENGTH+MACK_TRANSITION_END+70?2:20,n=100/step;
    for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const x=x0+i*step,z=z0+j*step;vertices.push(x,heightAt(x,z),z);}
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){
      const a=j*(n+1)+i,b=a+1,c=a+n+1,d=c+1;indices.push(a,c,b,b,c,d);
      const s=surfaceAt(x0+i*step+2,z0+j*step+2);surfaces.push(s,s);
    }
    chunks.push({x:cx,z:cz,vertices:new Float32Array(vertices),indices:new Uint32Array(indices),surfaces});
  }
  return chunks;
}
export interface Solid{x:number;y:number;z:number;hx:number;hy:number;hz:number;kind:string;yaw?:number}
export function worldSolids():Solid[]{
  const s:Solid[]=[];
  // Hart Plaza fountain and Transcending sculpture bases.
  s.push({x:80,y:1.8,z:388,hx:14,hy:1.8,hz:14,kind:'fountain'});
  s.push({x:80,y:.4,z:465,hx:4,hy:.4,hz:4,kind:'sculpture'});
  for(const [d,side,kind] of [[510,1,'bench'],[925,-1,'rock'],[1720,1,'bench'],[2350,-1,'rock']] as const){
    const p=cutPoint(d,side*4.5),hy=kind==='bench'?.32:.22;
    s.push({x:p.x,y:heightAt(p.x,p.z)+hy,z:p.z,hx:kind==='bench'?.85:.42,hy,hz:kind==='bench'?.28:.38,kind,yaw:p.heading});
  }
  return s;
}
export interface TrafficState{id:number;kind:'pedestrian'|'jogger'|'cyclist'|'segway'|'skater'|'scooter'|'cone'|'barrier';x:number;y:number;z:number;heading:number;speed:number;routeDistance?:number;direction?:number;fall?:RidePose;fallPhase?:string}
export function trafficBounds(kind:TrafficState['kind']){
  return kind==='scooter'?{hx:.35,hy:1.01,hz:.69}:kind==='segway'?{hx:.46,hy:1.02,hz:.45}:kind==='skater'?{hx:.48,hy:.92,hz:.48}:kind==='cyclist'?{hx:.32,hy:.84,hz:.85}:kind==='barrier'?{hx:.6,hy:.48,hz:.3}:kind==='cone'?{hx:.28,hy:.35,hz:.3}:{hx:.28,hy:.84,hz:.3};
}
export const CUT_TRAFFIC=mappedSpline(CITY.cut);
export const TRAFFIC_RUNOUT=180;
function trafficPoint(distance:number,offset:number){
  const clamped=clamp(distance,0,CUT_TRAFFIC.length),p=CUT_TRAFFIC.sample(clamped,offset);
  const ahead=CUT_TRAFFIC.sample(clamp(clamped+8,0,CUT_TRAFFIC.length)),behind=CUT_TRAFFIC.sample(clamp(clamped-8,0,CUT_TRAFFIC.length));
  const heading=Math.atan2(ahead.x-behind.x,ahead.z-behind.z);
  return{x:p.x+Math.sin(heading)*(distance-clamped),z:p.z+Math.cos(heading)*(distance-clamped),heading};
}
export function trafficAt(id:number,time:number):TrafficState{
  const moving:TrafficState['kind'][]=['skater','segway','pedestrian','cyclist','jogger','scooter','jogger','pedestrian','scooter','pedestrian'];
  const kind=id%11===0?'barrier':id%7===0?'cone':moving[id%moving.length];
  const speed=kind==='scooter'?4.2:kind==='cyclist'?3.4:kind==='segway'?2.6:kind==='skater'?2.9:kind==='jogger'?(id%3===0?3.8:2.65):kind==='pedestrian'?1.1:0;
  const dir=id%2?1:-1,home=110+id*(CUT_TRAFFIC.length-220)/61;
  // One persistent direction per person. Complete the route, exit beyond its visible
  // end, then enter at the opposite end; never ping-pong inside a short patrol patch.
  const span=CUT_TRAFFIC.length+TRAFFIC_RUNOUT*2;
  const d=speed?((home+dir*Math.max(0,time)*speed+TRAFFIC_RUNOUT)%span+span)%span-TRAFFIC_RUNOUT:home;
  const width=cutWidth(clamp(d,0,CUT_METRES));
  const offset=speed?dir*Math.min(1.65,width/2-.65):width/2+1.2;
  const p=trafficPoint(d,offset),x=p.x,z=p.z,heading=p.heading+(dir<0?Math.PI:0);
  return{id,kind,x,y:heightAt(x,z),z,heading,speed,routeDistance:d,direction:speed?dir:0};
}
function trafficObstacle(t:TrafficState):NavigationObstacle{
  const b=trafficBounds(t.kind),p=t.fall,c=Math.cos(t.heading),s=Math.sin(t.heading);
  return {id:'traffic-'+t.id,x:t.x+(p?c*p.crashLateral+s*p.crashForward:0),y:t.y,z:t.z+(p?-s*p.crashLateral+c*p.crashForward:0),radius:p?.85:Math.hypot(b.hx,b.hz),height:b.hy*2,kind:t.kind,vx:Math.sin(t.heading)*t.speed,vz:Math.cos(t.heading)*t.speed,fallen:!!p};
}
export class DetroitWorld implements TerrainSampler{
  physics!:RAPIER.World;
  chunks=terrainChunks();solids=worldSolids();
  geoMeshes=geospatialMeshes(heightAt);
  buildingMeshes=CITY.buildings.filter(b=>b.points.some(p=>this.chunks.some(c=>Math.abs(c.x-p[0])<50&&Math.abs(c.z-p[1])<50))).map(b=>({data:b,geometry:buildingEnvelope(b,heightAt)}));
  metadata=new Map<number,{hx:number;hz:number}>();
  rideIntent={speed:0,heading:0};rejectedEncounters=0;
  private recoverySpace:{position:Vec3;radius:number;height:number;remaining:number}|undefined;
  courseFeatures:CourseFeature[]=[];hazards:TrafficState[]=[];hazardSeed=0;crowdActors:()=>NavigationObstacle[]=()=>[];
  private crowd:CrowdAgent[]=[];private crowdTime=-1;
  protected trafficFalls=new Map<number,{fall:TrafficFall;entry:TrafficState;pace:number}>();
  protected fallClock=-1;
  receiveTrafficImpact(id:number,impact:ActorImpact){
    const entry=this.traffic.find(t=>t.id===id);if(!entry||entry.kind==='cone'||entry.kind==='barrier'||this.trafficFalls.has(id)||impact.speed<2.2)return;
    const agent=this.crowd[id];this.trafficFalls.set(id,{fall:new TrafficFall(entry,impact),entry:{...entry},pace:agent?.pace??entry.speed});
    if(agent){agent.incapacitated=true;agent.speed=agent.motionSpeed=0;}
  }
  protected advanceTrafficFalls(time:number,px:number,pz:number){
    if(time<this.fallClock){this.trafficFalls.clear();this.crowd.forEach(a=>a.incapacitated=false);}
    const elapsed=this.fallClock<0?0:Math.min(.2,Math.max(0,time-this.fallClock));this.fallClock=time;
    for(const [id,state] of this.trafficFalls){
      const f=state.fall,pos=f.position,canStand=Math.hypot(pos.x-px,pos.z-pz)>1.5&&!this.navigationObstacles(pos.x,pos.z,2).some(o=>o.id!=='traffic-'+id&&Math.hypot(o.x-pos.x,o.z-pos.z)<o.radius+.75);
      const terrain:TerrainSampler={sampleGround:(...a)=>this.sampleGround(...a),raycast:()=>null,raycastObstacle:(origin,direction,length)=>{
        const n=Math.hypot(direction.x,direction.y,direction.z)||1;
        // Exclude this person's old collider from its own fall sweep.
        return this.physics.castRay(new RAPIER.Ray(origin,{x:direction.x/n,y:direction.y/n,z:direction.z/n}),length,true,undefined,0xffff0006,this.trafficBodies.get(id))?.timeOfImpact??null;
      }};
      let remaining=elapsed;while(remaining>1e-8){const dt=Math.min(1/30,remaining);f.step(dt,terrain,canStand);remaining-=dt;}
      const a=this.crowd[id];if(a){const at=f.position;a.x=at.x;a.y=at.y;a.z=at.z;a.radius=.85;}
      if(f.done){
        if(a){const at=f.position,route=cutCoords(at.x,at.z);a.distance=route.d;a.lane=route.u;a.x=at.x;a.z=at.z;a.y=this.sampleGround(at.x,at.z,{height:at.y,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false},at.y).height;a.incapacitated=false;a.speed=a.motionSpeed=0;a.pace=state.pace;a.radius=Math.hypot(trafficBounds(state.entry.kind).hx,trafficBounds(state.entry.kind).hz);a.passing=undefined;}
        this.onTrafficRecovered(id,f.position);this.trafficFalls.delete(id);
      }
    }
  }
  protected onTrafficRecovered(_id:number,_position:Vec3){}
  protected applyTrafficFall(t:TrafficState){const f=this.trafficFalls.get(t.id);return f?{...f.entry,speed:0,fall:f.fall.pose,fallPhase:f.fall.phase}:t;}
  trafficBodies=new Map<number,RAPIER.Collider>();traffic:TrafficState[]=[];
  setHazards(seed:number,start:number,features=false){
    this.courseFeatures=features?courseFeatures(seed):[];
    this.hazardSeed=seed;
    for(const [id,c] of this.trafficBodies)if(id>=1000){this.metadata.delete(c.handle);this.physics.removeCollider(c,true);this.trafficBodies.delete(id);}
    this.hazards=routeHazards(seed,start).filter(h=>!this.courseFeatures.some(f=>Math.abs(f.station-h.station)<20)).map(h=>{const p=cutPoint(h.station,h.offset);return {id:h.id,kind:h.kind,x:p.x,y:heightAt(p.x,p.z),z:p.z,heading:p.heading,speed:0,routeDistance:h.station,direction:0};});
  }
  async init(){
    await RAPIER.init();this.physics=new RAPIER.World({x:0,y:-9.81,z:0});
    for(const c of this.chunks)this.physics.createCollider(RAPIER.ColliderDesc.trimesh(c.vertices,c.indices).setCollisionGroups(0x0001ffff));
    for(const s of this.solids)this.addBox(s);
    for(const m of [...this.geoMeshes.filter(m=>m.collision!==false),...this.buildingMeshes]){const p=m.geometry.attributes.position,index=m.geometry.index;this.addMesh(new Float32Array(p.array),index?new Uint32Array(index.array):Uint32Array.from({length:p.count},(_,i)=>i),'kind' in m&&(m.kind==='deck'||m.kind==='approach'));}
    this.updateTraffic(0,0,0);this.step();return this;
  }
  addBox(s:Solid){const desc=RAPIER.ColliderDesc.cuboid(s.hx,s.hy,s.hz).setTranslation(s.x,s.y,s.z).setCollisionGroups(0x0002ffff);if(s.yaw)desc.setRotation({x:0,y:Math.sin(s.yaw/2),z:0,w:Math.cos(s.yaw/2)});const c=this.physics.createCollider(desc);this.metadata.set(c.handle,{hx:s.hx,hz:s.hz});return c;}
  addMesh(vertices:Float32Array,indices:Uint32Array,rideable=false){
    const collider=this.physics.createCollider(RAPIER.ColliderDesc.trimesh(vertices,indices).setCollisionGroups(0x0002ffff));
    if(rideable){
      // Separate upward faces: Rapier ray normals face the ray even on a slab's
      // underside, so the closed obstacle mesh cannot safely double as ground.
      const tops:number[]=[];
      for(let i=0;i<indices.length;i+=3){
        const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
        const ux=vertices[b]-vertices[a],uy=vertices[b+1]-vertices[a+1],uz=vertices[b+2]-vertices[a+2];
        const vx=vertices[c]-vertices[a],vy=vertices[c+1]-vertices[a+1],vz=vertices[c+2]-vertices[a+2];
        const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
        if(ny>.5*Math.hypot(nx,ny,nz))tops.push(indices[i],indices[i+1],indices[i+2]);
      }
      if(tops.length)this.physics.createCollider(RAPIER.ColliderDesc.trimesh(vertices,new Uint32Array(tops)).setCollisionGroups(0x0004ffff));
    }
    return collider;
  }
  /** Register the same upward triangles used to render a draped street or sidewalk. */
  addRideSurface(vertices:Float32Array,solidFoundation=false){
    return this.physics.createCollider(RAPIER.ColliderDesc.trimesh(vertices,Uint32Array.from({length:vertices.length/3},(_,i)=>i)).setCollisionGroups(solidFoundation?0x0001ffff:0x0004ffff));
  }
  sampleGround(x:number,z:number,out:GroundSample,referenceY?:number){
    const hit=this.physics.castRayAndGetNormal(new RAPIER.Ray({x,y:60,z},{x:0,y:-1,z:0}),100,true,undefined,0xffff0001);
    out.height=hit?60-hit.timeOfImpact:heightAt(x,z);Object.assign(out.normal,hit?.normal??{x:0,y:1,z:0});
    out.surface=surfaceAt(x,z);out.offCourse=!hit;
    if(referenceY!==undefined&&Number.isFinite(referenceY)){
      // A short upward allowance joins slopes without selecting an overhead bridge.
      // Layer 4 contains only upper road faces, never soffits or building roofs.
      const start=referenceY+.4;
      const deck=this.physics.castRayAndGetNormal(new RAPIER.Ray({x,y:start,z},{x:0,y:-1,z:0}),100,false,undefined,0xffff0004);
      if(deck&&deck.normal.y>.5&&start-deck.timeOfImpact>=out.height-.03){
        out.height=start-deck.timeOfImpact;Object.assign(out.normal,deck.normal);out.surface='pavement';out.offCourse=false;
      }
    }
    if(this.courseFeatures.length){const route=cutCoords(x,z),feature=featureContact(this.courseFeatures,route.d,route.u);if(feature){if(feature.kind==='slippery')out.surface='ice';else{const lift=rampLift(feature,route.d);out.height+=lift;const p=cutPoint(route.d),slope=feature.height/feature.length,len=Math.hypot(1,slope);out.normal={x:-Math.sin(p.heading)*slope/len,y:1/len,z:-Math.cos(p.heading)*slope/len};out.surface='wood';}}}
    return out;
  }
  navigationObstacles(x:number,z:number,radius:number):NavigationObstacle[]{
    return [...this.traffic.map(t=>({...trafficObstacle(t),onImpact:(impact:ActorImpact)=>this.receiveTrafficImpact(t.id,impact)})),
      ...this.solids.map((s,i)=>({id:'solid-'+i,x:s.x,y:s.y-s.hy,z:s.z,radius:Math.hypot(s.hx,s.hz),height:s.hy*2,kind:s.kind,vx:0,vz:0}))]
      .filter(o=>Math.hypot(o.x-x,o.z-z)<radius+o.radius);
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
      // Rendered road/ramp faces must stop lateral entry as well as support feet.
      // Otherwise an unrideable rise is skipped by ground sampling and the actor
      // can continue beneath the elevated pavement. Layer 1 stays ground-only.
      const h=this.physics.castRay(new RAPIER.Ray(o,dir),maxDistance,true,undefined,0xffff0006);
      if(h&&(!best||h.timeOfImpact<best.timeOfImpact))best=h;
    }
    if(best&&out){const m=this.metadata.get(best.collider.handle);out.distance=best.timeOfImpact;out.halfExtentX=m?.hx??.35;out.halfExtentZ=m?.hz??.35;}
    return best?.timeOfImpact??null;
  }
  mountedClear(p:Vec3,heading:number,radius:number,height:number){
    // Cones/barriers remain solid even before their local traffic colliders stream in.
    for(const t of this.staticTraffic())if(actorBlocksMountedSpace(trafficObstacle(t),p,{radius,height},0))return false;
    return !this.physics.intersectionWithShape({x:p.x,y:p.y+.06+height/2,z:p.z},{x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)},new RAPIER.Cuboid(radius,height/2,radius),undefined,0xffff0006);
  }
  protected staticTraffic(){return Array.from({length:62},(_,id)=>trafficAt(id,0)).filter(t=>t.speed===0).concat(this.hazards);}
  reserveRecoverySpace(p:Vec3,radius:number,height:number){this.recoverySpace={position:{...p},radius,height,remaining:RECOVERY_SPACE_SECONDS};}
  clearRecoverySpace(){this.recoverySpace=undefined;}
  protected trafficMayActivate(t:TrafficState){
    const space=this.recoverySpace;
    // Never stop, turn, remove or grant immunity from an already visible actor.
    return this.trafficBodies.has(t.id)||t.speed===0||!space||!actorBlocksMountedSpace(trafficObstacle(t),space.position,space,space.remaining);
  }
  updateTraffic(time:number,px:number,pz:number){
    this.advanceTrafficFalls(time,px,pz);
    this.traffic=[];const active=new Set<number>();
    if(!this.crowd.length||time<this.crowdTime){this.crowd=Array.from({length:62},(_,id)=>{const t=trafficAt(id,time),b=trafficBounds(t.kind),width=cutWidth(clamp(t.routeDistance!,0,CUT_METRES));return {id:'traffic-'+id,distance:t.routeDistance!,lane:t.speed?t.direction!*Math.min(1.65,width/2-.65):width/2+1.2,direction:t.direction!,pace:t.speed,speed:t.speed,radius:Math.hypot(b.hx,b.hz),height:b.hy*2,x:t.x,y:t.y,z:t.z,heading:t.heading};});this.crowdTime=time;}
    let remaining=Math.max(0,Math.min(2,time-this.crowdTime));this.crowdTime=time;
    while(remaining>1e-8){const step=Math.min(1/30,remaining);remaining-=step;advanceCrowd(this.crowd,step,{length:CUT_TRAFFIC.length,runout:TRAFFIC_RUNOUT,offsetSign:-1,point:(d,u)=>{const p=trafficPoint(d,u);return {...p,y:heightAt(p.x,p.z)};},width:d=>cutWidth(clamp(d,0,CUT_METRES))+1.6,walkable:(x,y,z)=>Math.abs(heightAt(x+.2,z)-heightAt(x-.2,z))<.2&&Math.abs(heightAt(x,z+.2)-heightAt(x,z-.2))<.2&&Number.isFinite(y)},[{id:'player',x:px,y:heightAt(px,pz),z:pz,radius:.52,height:2.2,kind:'rider',vx:Math.sin(this.rideIntent.heading)*this.rideIntent.speed,vz:Math.cos(this.rideIntent.heading)*this.rideIntent.speed},...this.hazards.map(trafficObstacle),...this.crowdActors()]);}
    const candidates:TrafficState[]=this.crowd.map<TrafficState>((agent,id)=>this.applyTrafficFall({...trafficAt(id,time),x:agent.x,y:agent.y,z:agent.z,heading:agent.heading,speed:agent.motionSpeed??agent.speed,routeDistance:agent.distance})).concat(this.hazards);
    for(const t of candidates){const id=t.id;if(id<1000&&Math.hypot(t.x-px,t.z-pz)>115)continue;
      if(!this.trafficMayActivate(t))continue;
      if(!this.trafficBodies.has(id)&&Math.abs(this.rideIntent.speed)>1){
        const prospective=[...this.traffic,t].map(a=>{const b=trafficBounds(a.kind);return{id:'traffic-'+a.id,x:a.x,y:a.y,z:a.z,radius:Math.hypot(b.hx,b.hz),height:2*b.hy,kind:a.kind,vx:Math.sin(a.heading)*a.speed,vz:Math.cos(a.heading)*a.speed};});
        const p={x:px,y:heightAt(px,pz),z:pz};
        if(!encounterOptions(this,p,this.rideIntent.heading,this.rideIntent.speed,prospective).feasible){this.rejectedEncounters++;continue;}
      }
      this.traffic.push(t);active.add(id);let c=this.trafficBodies.get(id);
      const {hx,hy,hz}=t.fall?{hx:.65,hy:.38,hz:.9}:trafficBounds(t.kind);
      if(!c){c=this.physics.createCollider(RAPIER.ColliderDesc.cuboid(hx,hy,hz).setCollisionGroups(0x0002ffff));this.trafficBodies.set(id,c);this.metadata.set(c.handle,{hx,hz});}
      const size=c.halfExtents();if(size&&(Math.abs(size.x-hx)>.001||Math.abs(size.y-hy)>.001||Math.abs(size.z-hz)>.001))c.setShape(new RAPIER.Cuboid(hx,hy,hz));const contact=trafficObstacle(t);
      c.setTranslation({x:contact.x,y:t.y+hy,z:contact.z});c.setRotation({x:0,y:Math.sin(t.heading/2),z:0,w:Math.cos(t.heading/2)});
    }
    for(const[id,c]of this.trafficBodies)if(!active.has(id)){this.metadata.delete(c.handle);this.physics.removeCollider(c,true);this.trafficBodies.delete(id);}
  }
  step(){
    if(this.recoverySpace){this.recoverySpace.remaining-=1/120;if(this.recoverySpace.remaining<=0)this.clearRecoverySpace();}
    this.physics.timestep=1/120;this.physics.step();
  }
}
export const RENCEN_TOWERS=[
  {x:61,z:-48,r:22,h:221},{x:9,z:1,r:19,h:159},{x:9,z:-97,r:19,h:159},
  {x:114,z:1,r:19,h:159},{x:114,z:-97,r:19,h:159},
  {x:114,z:-180,r:18,h:103},{x:114,z:-235,r:18,h:103},
];
