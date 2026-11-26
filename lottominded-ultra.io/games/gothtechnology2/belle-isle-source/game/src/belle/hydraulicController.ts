export type HydraulicSmartPose='front-up'|'back-up'|'pancake';
export const HYDRAULIC_SMART_POSES=Object.freeze({
  'front-up':Object.freeze({FL:.22,FR:.22,RL:.14,RR:.14}),
  'back-up':Object.freeze({FL:.14,FR:.14,RL:.22,RR:.22}),
  pancake:Object.freeze({FL:0,FR:0,RL:0,RR:0}),
});

export type HydraulicControllerOptions={maxSpeed:number;maxFrameSeconds?:number};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

/** Synchronized, bounded actuator travel. Every channel follows the same
 * monotone scalar on the exact current-to-target segment. Cubic smoothstep
 * starts and finishes at rest; its maximum slope is 1.5, accounted for in the
 * duration so no channel exceeds maxSpeed. The spatial clearance path does
 * not change when its timing is eased.
 *
 * Retargeting captures the actual displayed positions, never the old target.
 * It deliberately starts a new ease at rest: this avoids overshoot when a
 * command reverses direction, or changes the direction of the multi-channel
 * segment. Callers must validate that new segment before committing it. */
export class HydraulicController<Channel extends string>{
  private readonly channels:readonly Channel[];
  private readonly initial:Record<Channel,number>;
  private readonly position:Record<Channel,number>;
  private readonly wanted:Record<Channel,number>;
  private readonly from:Record<Channel,number>;
  readonly maxSpeed:number;
  readonly maxFrameSeconds:number;
  private elapsed=0;
  private duration=0;

  constructor(channels:readonly Channel[],initial:Readonly<Record<Channel,number>>,options:HydraulicControllerOptions){
    if(!channels.length||new Set(channels).size!==channels.length||channels.some(channel=>typeof channel!=='string'||!channel))throw Error('Hydraulic channels must be unique nonempty names.');
    const maxFrame=options.maxFrameSeconds??.12;
    if(!Number.isFinite(options.maxSpeed)||options.maxSpeed<=0||!Number.isFinite(maxFrame)||maxFrame<=0)throw Error('Hydraulic speed and frame limits must be finite and positive.');
    if(!initial||channels.some(channel=>!Number.isFinite(initial[channel])))throw Error('Hydraulic starting positions must be finite.');
    this.channels=[...channels];this.maxSpeed=options.maxSpeed;this.maxFrameSeconds=maxFrame;
    this.initial=Object.fromEntries(channels.map(channel=>[channel,initial[channel]])) as Record<Channel,number>;
    this.position={...this.initial};this.wanted={...this.initial};this.from={...this.initial};
  }

  /** Stable read-only views; snapshots belong to the caller. */
  get current():Readonly<Record<Channel,number>>{return this.position;}
  get targets():Readonly<Record<Channel,number>>{return this.wanted;}
  get settled(){return this.duration===0;}
  get durationSeconds(){return this.duration;}
  get elapsedSeconds(){return this.elapsed;}

  setTargets(targets:Partial<Record<Channel,number>>,immediate=false){
    if(!targets||typeof targets!=='object'||Array.isArray(targets)||Object.keys(targets).some(key=>!this.channels.includes(key as Channel)))return false;
    const next={...this.wanted};let changed=false,distance=0;
    for(const channel of this.channels){
      if(targets[channel]!==undefined){
        const value=targets[channel]!;if(!Number.isFinite(value))return false;next[channel]=value;
      }
      changed||=next[channel]!==this.wanted[channel];
      distance=Math.max(distance,Math.abs(next[channel]-this.position[channel]));
    }
    const duration=1.5*distance/this.maxSpeed;
    if(!Number.isFinite(duration))return false;
    if(changed){
      for(const channel of this.channels){this.from[channel]=this.position[channel];this.wanted[channel]=next[channel];}
      this.elapsed=0;this.duration=duration;
    }
    // An unchanged request never restarts an in-flight transition. Immediate
    // application remains available for reduced motion and static previews.
    if(immediate)this.finish();
    return true;
  }

  private finish(){
    let changed=false;
    for(const channel of this.channels){changed||=this.position[channel]!==this.wanted[channel];this.position[channel]=this.from[channel]=this.wanted[channel];}
    this.elapsed=this.duration=0;return changed;
  }

  /** Advance only eligible time. Hidden/paused time and timer resets belong to
   * the caller; a delayed frame cannot jump over the bounded frame interval. */
  update(seconds:number,reducedMotion=false){
    if(reducedMotion)return this.finish();
    if(this.settled)return false;
    const dt=clamp(Number.isFinite(seconds)?seconds:0,0,this.maxFrameSeconds);
    if(dt===0)return false;
    this.elapsed=Math.min(this.duration,this.elapsed+dt);
    const progress=this.elapsed/this.duration;
    if(progress>=1-1e-12)return this.finish();
    const weight=progress*progress*(3-2*progress);
    for(const channel of this.channels)this.position[channel]=this.from[channel]+(this.wanted[channel]-this.from[channel])*weight;
    return true;
  }

  reset(values:Readonly<Record<Channel,number>>=this.initial){
    if(!values||this.channels.some(channel=>!Number.isFinite(values[channel])))return false;
    for(const channel of this.channels)this.position[channel]=this.from[channel]=this.wanted[channel]=values[channel];
    this.elapsed=this.duration=0;return true;
  }
}
