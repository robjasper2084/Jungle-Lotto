import {DRIVE_GEARS} from '../hoverTransmission.ts';
import {HoverController} from '../hoverController.ts';
import type {ParkTerrain} from '../terrain.ts';
import {RideCore} from '../../../runtime/ride-core/src/ridecore.ts';
import type {RidePose} from '../../../runtime/ride-core/src/controller.ts';
import {HUMAN_PROFILE,MASCOT_PROFILE,type RiderProfile} from '../../../runtime/ride-core/src/profiles.ts';
import type {TerrainSampler,Vec3,ObstacleHit,NavigationObstacle} from '../../../runtime/ride-core/src/terrain.ts';
import {eucProfile,eucHandling} from '../../../../../swoop-source/src/detroit/electricVehicles.ts';
import {findPairSpawns,type PlayerManifest,type InputFrame,type Spawn,type Ground,type Seat} from './coop.ts';

export type CoopTerrainSource=TerrainSampler&{land(x:number,z:number):boolean;height(x:number,z:number,referenceY?:number):number;obstructed(x:number,z:number,radius:number):boolean};
export const COOP_RADIUS=.66;
const STEP=1/120;
const neutral=():InputFrame=>({throttle:0,steer:0,brake:false,hop:false,recover:false,interact:false});
const clamp=(v:number)=>Number.isFinite(v)?Math.max(-1,Math.min(1,v)):0;
export function riderProfile(id:string):RiderProfile{return {...(id.startsWith('DS_Mascot_')?MASCOT_PROFILE:HUMAN_PROFILE),id};}
/** A swept sphere is deliberately conservative around the other player's body.
 * Static world geometry is still queried by the existing terrain implementation. */
export function peerRay(origin:Vec3,direction:Vec3,maxDistance:number,peer:Vec3,radius:number):number|null{
 if(![origin.x,origin.y,origin.z,direction.x,direction.y,direction.z,maxDistance,peer.x,peer.y,peer.z,radius].every(Number.isFinite)||maxDistance<0||radius<=0)return null;
 // Do not collide with a rider on another floor or well above a flying/jumping player.
 if(origin.y<peer.y-.5||origin.y>peer.y+2.15)return null;
 const x=origin.x-peer.x,z=origin.z-peer.z,a=direction.x*direction.x+direction.z*direction.z;
 if(a<1e-10)return null;
 const b=x*direction.x+z*direction.z,c=x*x+z*z-radius*radius;
 if(c<=0)return b<0?0:null; // Allow escape from a pre-existing contact.
 const d=b*b-a*c;if(d<0)return null;
 const near=(-b-Math.sqrt(d))/a;
 return near>=0&&near<=maxDistance?near:null;
}

/** Preserve bounded simulation progress when rendering stalls, without pause catch-up.
 * The outer island loop caps its presentation dt at 50ms. Co-op uses a separately
 * bounded elapsed interval for its existing fixed-step schedule (at most 250ms).
 */
export function coopFrameSeconds(fallback:number,now:number,previous:number,paused=false){
 if(paused)return 0;
 const first=Number.isFinite(fallback)&&fallback>0?Math.min(.25,fallback):0;
 if(!Number.isFinite(now)||!Number.isFinite(previous)||previous<=0)return first;
 if(now<=previous)return 0;
 return Math.min(.25,(now-previous)/1000);
}

export class PairSimulation{
 readonly actors:readonly RideCore[];
 readonly manifests:readonly PlayerManifest[];
 readonly initial:readonly Spawn[];
 readonly terrain:CoopTerrainSource;
 private snapshots:Vec3[]=[];
 private accumulator=0;
 private pending=[neutral(),neutral()];
 private readonly grounds:TerrainSampler[];
 readonly hovers:(HoverController|undefined)[];
 readonly mounted:boolean[];
 radius(seat:number){return this.manifests[seat].vehicleId==='hoverbike'?1.3:COOP_RADIUS;}
 constructor(terrain:CoopTerrainSource,manifests:readonly PlayerManifest[],anchor:Spawn){
  if(manifests.length<2||manifests.length>4||manifests.some((m,i)=>m.seat!==i))throw new Error('Use two to four ordered player manifests.');
  this.terrain=terrain;this.manifests=manifests;
  const ground:Ground=(x,z)=>({height:terrain.height(x,z),land:terrain.land(x,z),blocked:terrain.obstructed(x,z,Math.max(...manifests.map(m=>m.vehicleId==='hoverbike'?1.3:COOP_RADIUS)))});
  this.initial=findPairSpawns(anchor,ground,manifests.map((m)=>m.vehicleId==='hoverbike'?1.3:COOP_RADIUS));
  this.snapshots=this.initial.map(p=>({x:p.x,y:p.y,z:p.z}));
  this.grounds=manifests.map((_,i)=>this.playerTerrain(i));
  this.pending=manifests.map(()=>neutral());this.mounted=manifests.map(()=>true);
  this.hovers=manifests.map((m,i)=>m.vehicleId==='hoverbike'?new HoverController(terrain as ParkTerrain,this.initial[i],(o,d,max,half)=>{let best:number|null=null;this.snapshots.forEach((p,j)=>{if(j===i)return;const hit=peerRay(o,d,max,p,this.radius(j)+half);if(hit!==null&&(best===null||hit<best))best=hit;});return best;}):undefined);
  for(const hover of this.hovers)hover?.setMode('classic');
  this.actors=manifests.map((m,i)=>{
   const s=this.initial[i],core=new RideCore(this.grounds[i],{profile:riderProfile(m.riderId),spawn:{position:{x:s.x,y:s.y,z:s.z},headingY:s.heading}});
   const handling=eucProfile(m.vehicleId);if(handling)core.controller.setHandling(eucHandling(handling));
   // Recreate the balance springs after installing the selected handling coefficients.
   core.reset({position:{x:s.x,y:s.y,z:s.z},headingY:s.heading});return core;
  });
 }
 private playerTerrain(seat:number):TerrainSampler{
  const base=this.terrain;
  return {
   sampleGround:(x,z,out,referenceY)=>base.sampleGround(x,z,out,referenceY),
   raycast:(origin,direction,max)=>base.raycast(origin,direction,max),
   navigationObstacles:(x,z,radius)=>{
    const items=[...(base.navigationObstacles?.(x,z,radius)??[])];
    this.snapshots.forEach((p,i)=>{if(i!==seat&&Math.hypot(x-p.x,z-p.z)<=radius+this.radius(i))items.push({id:'coop-p'+(i+1),...p,radius:this.radius(i),height:2,kind:'coop-rider',vx:0,vz:0,raycastSolid:true} satisfies NavigationObstacle);});
    return items;
   },
   raycastObstacle:(origin,direction,max,width=0,lateral,out)=>{
    let hit=base.raycastObstacle(origin,direction,max,width,lateral,out);
    this.snapshots.forEach((other,i)=>{if(i===seat)return;const peer=peerRay(origin,direction,max,other,this.radius(i)+COOP_RADIUS+.15+Math.max(0,width));if(peer!==null&&(hit===null||peer<hit)){hit=peer;if(out)Object.assign(out,{distance:peer,halfExtentX:this.radius(i),halfExtentZ:this.radius(i)} satisfies ObstacleHit);}});
    return hit;
   }
  };
 }
 private canMountHover(seat:number){
  const hover=this.hovers[seat]!,p=this.actors[seat].current,b=hover.pose,dx=b.x-p.x,dz=b.z-p.z,d=Math.hypot(dx,dz);
  if(!hover.landed||d>3||Math.abs(p.y-b.y)>1)return false;
  return d<.05||this.terrain.raycastObstacle({x:p.x,y:p.y+1,z:p.z},{x:dx/d,y:0,z:dz/d},d,.22)===null;
 }
 clear(){this.accumulator=0;this.pending=this.actors.map(()=>neutral());for(const hover of this.hovers)hover?.stop();for(const core of this.actors)core.clearPendingActions();}
 recover(seat:Seat,near?:Spawn){
  const core=this.actors[seat],own=core.current;
  const anchor=near??{x:own.x,y:own.y,z:own.z,heading:own.headingY};
  const ground:Ground=(x,z)=>({height:this.terrain.height(x,z),land:this.terrain.land(x,z),blocked:this.terrain.obstructed(x,z,this.radius(seat))||this.actors.some((a,i)=>i!==seat&&Math.hypot(x-a.current.x,z-a.current.z)<this.radius(seat)+this.radius(i)+.8)});
  let safe:Spawn;
  try{safe=findPairSpawns(anchor,ground,[this.radius(seat)])[0];}
  catch{safe=findPairSpawns(this.initial[seat],ground,[this.radius(seat)])[0];}
  core.reset({position:{x:safe.x,y:safe.y,z:safe.z},headingY:safe.heading});
  this.hovers[seat]?.reset(safe.x,safe.z,safe.heading);this.mounted[seat]=true;
  this.snapshots[seat]={x:safe.x,y:safe.y,z:safe.z};this.pending[seat]=neutral();return safe;
 }
 /** One fixed schedule updates both actors from the same previous-tick contact data. */
 advance(seconds:number,inputs:readonly InputFrame[],paused=false){
  if(!Number.isFinite(seconds)||seconds<0)throw new Error('Invalid co-op frame time.');
  if(inputs.length!==this.actors.length)throw new Error('Each player requires an independent input frame.');
  if(paused){this.clear();return this.actors.map(a=>a.renderPose);}
  for(let seat=0;seat<this.actors.length;seat++){
   const next=inputs[seat];this.pending[seat]={...next,throttle:clamp(next.throttle),steer:clamp(next.steer),hop:!!next.hop||this.pending[seat].hop,recover:!!next.recover||this.pending[seat].recover,interact:!!next.interact||this.pending[seat].interact,brake:!!next.brake,shift:next.shift||this.pending[seat].shift};
  }
  this.accumulator+=Math.min(seconds,.25);
  let steps=0;
  while(this.accumulator+1e-10>=STEP&&steps++<30){
   this.snapshots=this.actors.map(c=>({x:c.current.x,y:c.current.y,z:c.current.z}));
   for(let seat=0;seat<this.actors.length;seat++){
    const input=this.pending[seat],core=this.actors[seat];
    if(input.recover){this.recover(seat as Seat);continue;}
    const hover=this.hovers[seat];
    if(hover&&this.mounted[seat]){
     hover.drive.clutch=Math.max(0,Math.min(1,input.clutch??0));
     if(input.shift){const i=DRIVE_GEARS.indexOf(hover.drive.gear);hover.drive.select(DRIVE_GEARS[Math.max(0,Math.min(DRIVE_GEARS.length-1,i+Math.sign(input.shift)))],hover.landed);input.shift=0;}
     if(input.hop){if(hover.flying)hover.land();else hover.launch();}
     if(input.interact){const exit=hover.exitPoint();if(exit){core.reset({position:{x:exit.x,y:exit.y,z:exit.z},headingY:exit.heading});core.advance(STEP,{dismount:true});this.mounted[seat]=false;}}
     if(this.mounted[seat]){hover.advance(STEP,{throttle:input.throttle,steer:input.steer,lift:clamp(input.lift??0),brake:input.brake,clutch:input.clutch,boost:false});const p=hover.pose;for(const pose of [core.current,core.previous,core.renderPose])Object.assign(pose,{x:p.x,y:p.y,z:p.z,headingY:p.heading,speed:p.speed,footBlend:0,footMode:0,crashBlend:0});}
     input.hop=input.recover=input.interact=false;continue;
    }
    input.shift=0; // Never queue an on-foot gear press for the next mount.
    if(hover&&input.interact&&this.canMountHover(seat)){this.mounted[seat]=true;core.reset({position:{x:hover.pose.x,y:hover.pose.y,z:hover.pose.z},headingY:hover.pose.heading});input.interact=false;continue;}
    const braking=input.brake?(Math.abs(core.current.speed)>.15?-Math.sign(core.current.speed):0):input.throttle;
    core.advance(STEP,{throttle:braking,steer:input.steer,hop:input.hop,hopHeld:input.hop,dismount:hover?false:input.interact});
    input.hop=input.recover=input.interact=false;
   }
   this.accumulator=Math.max(0,this.accumulator-STEP);
  }
  return this.actors.map(c=>c.renderPose);
 }
}
