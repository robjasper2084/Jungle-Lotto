import {RideCore} from '../../../runtime/ride-core/src/ridecore.ts';
import type {RidePose} from '../../../runtime/ride-core/src/controller.ts';
import {HUMAN_PROFILE,MASCOT_PROFILE,type RiderProfile} from '../../../runtime/ride-core/src/profiles.ts';
import type {TerrainSampler,Vec3,ObstacleHit,NavigationObstacle} from '../../../runtime/ride-core/src/terrain.ts';
import {eucProfile,eucHandling} from '../../../../../swoop-source/src/detroit/electricVehicles.ts';
import {findPairSpawns,type PlayerManifest,type InputFrame,type Spawn,type Ground} from './coop.ts';

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
 readonly actors:readonly [RideCore,RideCore];
 readonly manifests:readonly [PlayerManifest,PlayerManifest];
 readonly initial:readonly [Spawn,Spawn];
 readonly terrain:CoopTerrainSource;
 private snapshots:Vec3[]=[];
 private accumulator=0;
 private pending=[neutral(),neutral()];
 private readonly grounds:[TerrainSampler,TerrainSampler];
 constructor(terrain:CoopTerrainSource,manifests:readonly [PlayerManifest,PlayerManifest],anchor:Spawn){
  this.terrain=terrain;this.manifests=manifests;
  const ground:Ground=(x,z)=>({height:terrain.height(x,z),land:terrain.land(x,z),blocked:terrain.obstructed(x,z,COOP_RADIUS)});
  this.initial=findPairSpawns(anchor,ground,[COOP_RADIUS,COOP_RADIUS]);
  this.snapshots=this.initial.map(p=>({x:p.x,y:p.y,z:p.z}));
  this.grounds=[this.playerTerrain(0),this.playerTerrain(1)];
  this.actors=manifests.map((m,i)=>{
   const s=this.initial[i],core=new RideCore(this.grounds[i],{profile:riderProfile(m.riderId),spawn:{position:{x:s.x,y:s.y,z:s.z},headingY:s.heading}});
   const handling=eucProfile(m.vehicleId);if(handling)core.controller.setHandling(eucHandling(handling));
   // Recreate the balance springs after installing the selected handling coefficients.
   core.reset({position:{x:s.x,y:s.y,z:s.z},headingY:s.heading});return core;
  }) as [RideCore,RideCore];
 }
 private playerTerrain(seat:number):TerrainSampler{
  const base=this.terrain;
  return {
   sampleGround:(x,z,out,referenceY)=>base.sampleGround(x,z,out,referenceY),
   raycast:(origin,direction,max)=>base.raycast(origin,direction,max),
   navigationObstacles:(x,z,radius)=>{
    const items=[...(base.navigationObstacles?.(x,z,radius)??[])],p=this.snapshots[1-seat];
    if(p&&Math.hypot(x-p.x,z-p.z)<=radius+COOP_RADIUS)items.push({id:'coop-p'+(2-seat),...p,radius:COOP_RADIUS,height:2,kind:'coop-rider',vx:0,vz:0,raycastSolid:true} satisfies NavigationObstacle);
    return items;
   },
   raycastObstacle:(origin,direction,max,width=0,lateral,out)=>{
    const hit=base.raycastObstacle(origin,direction,max,width,lateral,out);
    const other=this.snapshots[1-seat];if(!other)return hit;
    const peer=peerRay(origin,direction,max,other,COOP_RADIUS*2+.15+Math.max(0,width));
    if(peer!==null&&(hit===null||peer<hit)){
     if(out)Object.assign(out,{distance:peer,halfExtentX:COOP_RADIUS,halfExtentZ:COOP_RADIUS} satisfies ObstacleHit);
     return peer;
    }
    return hit;
   }
  };
 }
 clear(){this.accumulator=0;this.pending=[neutral(),neutral()];for(const core of this.actors)core.clearPendingActions();}
 recover(seat:0|1,near?:Spawn){
  const core=this.actors[seat],peer=this.actors[1-seat].current,own=core.current;
  const anchor=near??{x:own.x,y:own.y,z:own.z,heading:own.headingY};
  const ground:Ground=(x,z)=>({height:this.terrain.height(x,z),land:this.terrain.land(x,z),blocked:this.terrain.obstructed(x,z,COOP_RADIUS)||Math.hypot(x-peer.x,z-peer.z)<COOP_RADIUS*2+.8});
  let safe:Spawn;
  try{safe=findPairSpawns(anchor,ground,[COOP_RADIUS,COOP_RADIUS])[0];}
  catch{safe=findPairSpawns(this.initial[seat],ground,[COOP_RADIUS,COOP_RADIUS])[0];}
  core.reset({position:{x:safe.x,y:safe.y,z:safe.z},headingY:safe.heading});
  this.snapshots[seat]={x:safe.x,y:safe.y,z:safe.z};this.pending[seat]=neutral();return safe;
 }
 /** One fixed schedule updates both actors from the same previous-tick contact data. */
 advance(seconds:number,inputs:readonly [InputFrame,InputFrame],paused=false){
  if(!Number.isFinite(seconds)||seconds<0)throw new Error('Invalid co-op frame time.');
  if(paused){this.clear();return this.actors.map(a=>a.renderPose) as [RidePose,RidePose];}
  for(const seat of [0,1] as const){
   const next=inputs[seat];this.pending[seat]={...next,throttle:clamp(next.throttle),steer:clamp(next.steer),hop:!!next.hop||this.pending[seat].hop,recover:!!next.recover||this.pending[seat].recover,interact:!!next.interact||this.pending[seat].interact,brake:!!next.brake};
  }
  this.accumulator+=Math.min(seconds,.25);
  let steps=0;
  while(this.accumulator+1e-10>=STEP&&steps++<30){
   this.snapshots=this.actors.map(c=>({x:c.current.x,y:c.current.y,z:c.current.z}));
   for(const seat of [0,1] as const){
    const input=this.pending[seat],core=this.actors[seat];
    if(input.recover)this.recover(seat);
    const braking=input.brake?(Math.abs(core.current.speed)>.15?-Math.sign(core.current.speed):0):input.throttle;
    core.advance(STEP,{throttle:braking,steer:input.steer,hop:input.hop,hopHeld:input.hop,dismount:input.interact});
    input.hop=input.recover=input.interact=false;
   }
   this.accumulator=Math.max(0,this.accumulator-STEP);
  }
  return this.actors.map(c=>c.renderPose) as [RidePose,RidePose];
 }
}
