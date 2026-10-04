import {RideController,NEUTRAL_ACTIONS,createPose,copyPose,lerpPose,type RideActions,type RidePose} from './controller.ts';
import type {TerrainSampler,Vec3} from './terrain.ts';
import {HUMAN_PROFILE,type RiderProfile} from './profiles.ts';

export const RIDECORE=Object.freeze({name:'Digital Static RideCore',version:'1.2.0',fixedHz:120,sourceMotion:'Digital Static Motion 4.1 + responsive upper body'});
export type RideSpawn={position:Vec3;headingY:number};
export type RideEvent={type:'trick';message:string;points:number}|{type:'landing';impact:number;quality:string}|{type:'crash';reason:string};
const STEP=1/RIDECORE.fixedHz;

/** Host-independent frame adapter. Only the TerrainSampler knows the game world. */
export class RideCore {
  readonly controller:RideController;
  readonly current:RidePose=createPose();readonly previous:RidePose=createPose();readonly renderPose:RidePose=createPose();
  profile:RiderProfile;
  private accumulator=0;
  private pending={hop:false,reset:false,trick:0};
  private down={hop:false,reset:false,trick:0};
  constructor(terrain:TerrainSampler,options:{profile?:RiderProfile;spawn?:RideSpawn}={}){
    this.profile=options.profile??HUMAN_PROFILE;
    this.controller=new RideController(terrain,options.spawn?{spawn:options.spawn}:undefined);
    this.setProfile(this.profile);this.capture();copyPose(this.current,this.previous);copyPose(this.current,this.renderPose);
  }
  setProfile(profile:RiderProfile){
    for(const value of [profile.wheelScale,profile.motionScale,profile.pedalHeight,profile.pedalHalfSpacing])if(!Number.isFinite(value)||value<=0)throw new RangeError('Rider fit values must be positive and finite');
    this.profile=profile;this.controller.wheelScale=profile.wheelScale;
    this.capture();copyPose(this.current,this.previous);copyPose(this.current,this.renderPose);
  }
  private capture(){this.controller.writePose(this.current);if(!this.profile.footDownStop)this.current.stopFoot=0;}
  reset(spawn?:RideSpawn){
    this.controller.reset(spawn);this.accumulator=0;this.pending={hop:false,reset:false,trick:0};this.down={hop:false,reset:false,trick:0};
    this.capture();copyPose(this.current,this.previous);copyPose(this.current,this.renderPose);
  }
  /** Seconds since last frame; call with held inputs. Edge actions survive sub-step frames. */
  advance(seconds:number,input:Partial<RideActions>={}){
    if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('Frame time must be finite and non-negative');
    const actions={...NEUTRAL_ACTIONS,...input};
    if(actions.hop&&!this.down.hop)this.pending.hop=true;
    if(actions.reset&&!this.down.reset)this.pending.reset=true;
    if(actions.trick&&actions.trick!==this.down.trick)this.pending.trick=actions.trick;
    this.down={hop:actions.hop,reset:actions.reset,trick:actions.trick};
    const droppedSeconds=Math.max(0,seconds-.25);this.accumulator+=Math.min(seconds,.25);
    const events:RideEvent[]=[];let steps=0;
    while(this.accumulator+1e-10>=STEP&&steps<30){
      copyPose(this.current,this.previous);const crashed=this.controller.crashed;
      this.controller.step(STEP,{...actions,...this.pending});
      this.pending={hop:false,reset:false,trick:0};this.capture();
      if(this.controller.tricks.event||this.controller.tricks.award)events.push({type:'trick',message:this.controller.tricks.event,points:this.controller.tricks.award});
      if(this.controller.touchedDown)events.push({type:'landing',impact:this.controller.lastLandingImpact,quality:this.controller.lastLandingQuality});
      if(!crashed&&this.controller.crashed)events.push({type:'crash',reason:this.controller.crashCause});
      this.accumulator=Math.max(0,this.accumulator-STEP);steps++;
    }
    lerpPose(this.previous,this.current,this.accumulator/STEP,this.renderPose);
    return {pose:this.renderPose,events,steps,droppedSeconds};
  }
  snapshot(){const state=this.controller.snapshot();return {...state,oneFootStop:this.profile.footDownStop?state.oneFootStop:0,rideCore:RIDECORE.version,profile:this.profile.id};}
}
