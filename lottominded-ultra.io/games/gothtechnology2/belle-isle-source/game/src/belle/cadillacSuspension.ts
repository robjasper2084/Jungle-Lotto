/** Bounded kinematic hydraulics. Metres/seconds/radians; +X is left, +Z forward.
 * Collision acceptance belongs to CadillacRide before a command is committed.
 * No door, trunk, steering, wheel-spin, or scene-node transform is owned here. */
export const CADILLAC_CORNERS=['FL','FR','RL','RR'] as const;
export type CadillacCorner=typeof CADILLAC_CORNERS[number];
export type CadillacCornerHeights=Record<CadillacCorner,number>;
export type CadillacHop='all'|'front'|'rear';
export type CadillacStance='low'|'cruise'|'raised'|'level';
export type CadillacSuspensionAnchors=Readonly<Record<CadillacCorner,Readonly<{x:number;y:number;z:number}>>>;
export type CadillacSuspensionPose={heave:number;pitch:number;roll:number;wheelLifts:CadillacCornerHeights};
export type CadillacSuspensionSnapshot={
  targets:CadillacCornerHeights;current:CadillacCornerHeights;pose:CadillacSuspensionPose;
  hop:CadillacHop|null;hopProgress:number;cooldown:number;settled:boolean;readyForDrive:boolean;
};

export const CADILLAC_SUSPENSION_LIMITS={
  // Factory height is the minimum: lowering below it intrudes on the original
  // front fenders, especially on the dedicated hydraulic Cadillac model.
  min:0,max:.24,low:0,cruise:0,raised:.14,
  actuatorMetresPerSecond:.35,hopSeconds:.9,hopCooldownSeconds:.45,
  hopWheelLift:.12,hopExtension:.08,maxTiltRadians:Math.PI/10,maxFrameSeconds:.12,
} as const;
export const SILVER_CADILLAC_SUSPENSION_ANCHORS:CadillacSuspensionAnchors={
  FL:{x:.824,y:.346,z:1.8585},FR:{x:-.824,y:.346,z:1.8585},
  RL:{x:.824,y:.346,z:-1.3545},RR:{x:-.824,y:.346,z:-1.3545},
};
const EPS=1e-8;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const values=(value=0):CadillacCornerHeights=>({FL:value,FR:value,RL:value,RR:value});
const copy=(source:CadillacCornerHeights):CadillacCornerHeights=>({...source});
const emptyPose=():CadillacSuspensionPose=>({heave:0,pitch:0,roll:0,wheelLifts:values()});
const validHop=(mode:CadillacHop)=>mode==='all'||mode==='front'||mode==='rear';
const hopCorner=(mode:CadillacHop,corner:CadillacCorner)=>mode==='all'||(corner.startsWith('F')?mode==='front':mode==='rear');
const clean=(value:number)=>Math.abs(value)<EPS?0:value;

export class CadillacSuspension {
  private readonly wanted=values();
  private readonly travel=values();
  private readonly from=values();
  private readonly effective=values();
  private readonly air=values();
  private readonly result=emptyPose();
  private readonly anchors:CadillacSuspensionAnchors;
  private readonly inverse:number[];
  private readonly centre:{x:number;y:number;z:number};
  private movementSeconds=0;
  private movementDuration=0;
  private hopMode:CadillacHop|null=null;
  private hopSeconds=0;
  private remainingCooldown=0;
  private levelAfterHop=false;

  constructor(anchors:CadillacSuspensionAnchors=SILVER_CADILLAC_SUSPENSION_ANCHORS){
    const points=CADILLAC_CORNERS.map(corner=>anchors[corner]);
    if(points.some(point=>!point||![point.x,point.y,point.z].every(Number.isFinite)))throw new Error('Cadillac suspension requires four finite hub anchors.');
    const centre=points.reduce((sum,point)=>({x:sum.x+point.x/4,y:sum.y+point.y/4,z:sum.z+point.z/4}),{x:0,y:0,z:0});
    if(points.some(point=>Math.abs(point.y-centre.y)>1e-5))throw new Error('Cadillac suspension hub anchors must share the same rest height.');
    this.anchors=Object.fromEntries(CADILLAC_CORNERS.map(corner=>[corner,{...anchors[corner]}])) as Record<CadillacCorner,{x:number;y:number;z:number}>;
    this.centre=centre;
    // Inverse of the fixed least-squares system [1,x,z] for this actual rig.
    // The original Fleetwood axle midpoint is z=.252; the other Cadillac has
    // unequal left hub offsets. Neither rig is replaced by a symmetric guess.
    const a=4,b=points.reduce((sum,p)=>sum+p.x,0),c=points.reduce((sum,p)=>sum+p.z,0);
    const d=points.reduce((sum,p)=>sum+p.x*p.x,0),e=points.reduce((sum,p)=>sum+p.x*p.z,0),f=points.reduce((sum,p)=>sum+p.z*p.z,0);
    const determinant=a*(d*f-e*e)-b*(b*f-c*e)+c*(b*e-c*d);
    if(!Number.isFinite(determinant)||Math.abs(determinant)<1e-6)throw new Error('Cadillac suspension hub anchors do not define a chassis plane.');
    this.inverse=[d*f-e*e,c*e-b*f,b*e-c*d,c*e-b*f,a*f-c*c,b*c-a*e,b*e-c*d,b*c-a*e,a*d-b*b].map(value=>value/determinant);
  }

  get targets():Readonly<CadillacCornerHeights>{return copy(this.wanted);}
  get pose():Readonly<CadillacSuspensionPose>{return this.result;}
  get settled(){return this.hopMode===null&&!this.levelAfterHop&&CADILLAC_CORNERS.every(corner=>Math.abs(this.travel[corner]-this.wanted[corner])<EPS);}
  get readyForDrive(){return this.settled&&CADILLAC_CORNERS.every(corner=>Math.abs(this.wanted[corner]-this.wanted.FL)<EPS&&this.result.wheelLifts[corner]<EPS);}

  private normalized(targets:Partial<CadillacCornerHeights>){
    if(Object.keys(targets).some(key=>!CADILLAC_CORNERS.includes(key as CadillacCorner)))return null;
    const next=copy(this.wanted);
    for(const corner of CADILLAC_CORNERS)if(targets[corner]!==undefined){
      const value=targets[corner]!;if(!Number.isFinite(value))return null;
      next[corner]=clamp(value,CADILLAC_SUSPENSION_LIMITS.min,CADILLAC_SUSPENSION_LIMITS.max);
    }
    return next;
  }
  private commitTargets(next:CadillacCornerHeights,immediate:boolean){
    this.levelAfterHop=false;
    const changed=CADILLAC_CORNERS.some(corner=>this.wanted[corner]!==next[corner]);
    if(changed){
      this.movementSeconds=0;this.movementDuration=0;
      for(const corner of CADILLAC_CORNERS){
        this.from[corner]=this.travel[corner];this.wanted[corner]=next[corner];
        this.movementDuration=Math.max(this.movementDuration,Math.abs(next[corner]-this.travel[corner])/CADILLAC_SUSPENSION_LIMITS.actuatorMetresPerSecond);
      }
    }
    if(immediate){for(const corner of CADILLAC_CORNERS)this.travel[corner]=this.from[corner]=this.wanted[corner];this.movementSeconds=this.movementDuration=0;this.compose();}
  }
  setTargets(targets:Partial<CadillacCornerHeights>,immediate=false){
    const next=this.normalized(targets);if(!next||this.hopMode!==null)return false;
    this.commitTargets(next,immediate);return true;
  }
  setCorner(corner:CadillacCorner,metres:number,immediate=false){
    if(!CADILLAC_CORNERS.includes(corner))return false;
    return this.setTargets({[corner]:metres},immediate);
  }
  stance(value:CadillacStance,immediate=false){
    if(!['low','cruise','raised','level'].includes(value))return false;
    const height=value==='level'?CADILLAC_CORNERS.reduce((sum,corner)=>sum+this.wanted[corner]/4,0):CADILLAC_SUSPENSION_LIMITS[value];
    return this.setTargets(values(height),immediate);
  }
  /** Finish a hop before equalizing the chassis for driving; no midair snap. */
  settle(){if(this.hopMode!==null)this.levelAfterHop=true;else this.stance('level');}
  hop(mode:CadillacHop,reducedMotion=false){
    if(!validHop(mode)||reducedMotion||!this.settled||this.remainingCooldown>EPS)return false;
    this.hopMode=mode;this.hopSeconds=0;return true;
  }
  reset(){
    for(const corner of CADILLAC_CORNERS)this.wanted[corner]=this.travel[corner]=this.from[corner]=this.effective[corner]=this.air[corner]=0;
    this.movementSeconds=this.movementDuration=this.hopSeconds=this.remainingCooldown=0;
    this.hopMode=null;this.levelAfterHop=false;this.compose();
  }

  /** Samples follow the exact linear corner path used by update(), including
   * retargets during travel. The caller must sweep the real body and panels. */
  preview(targets:Partial<CadillacCornerHeights>=this.wanted){
    const next=this.normalized(targets);if(!next)throw new Error('Invalid Cadillac suspension target.');
    return this.solve(next,values());
  }
  previewPath(targets:Partial<CadillacCornerHeights>,steps=16){
    const next=this.normalized(targets);if(!next)throw new Error('Invalid Cadillac suspension target.');
    const count=clamp(Number.isFinite(steps)?Math.floor(steps):16,1,128),path:CadillacSuspensionPose[]=[];
    for(let i=0;i<=count;i++){
      const sample=values();for(const corner of CADILLAC_CORNERS)sample[corner]=this.travel[corner]+(next[corner]-this.travel[corner])*i/count;
      path.push(this.solve(sample,values()));
    }
    return path;
  }
  previewHop(mode:CadillacHop,steps=32){
    if(!validHop(mode))throw new Error('Invalid Cadillac hop mode.');
    const count=clamp(Number.isFinite(steps)?Math.floor(steps):32,2,128),path:CadillacSuspensionPose[]=[];
    for(let i=0;i<=count;i++){
      const stroke=copy(this.travel),air=values();this.hopOffsets(mode,i/count,stroke,air);
      path.push(this.solve(stroke,air));
    }
    return path;
  }

  /** All motion already committed, in the order update() will present it. A
   * panel opening mid-hop must clear both the remaining hop and any queued
   * leveling after landing. Past hop peaks are deliberately excluded. */
  previewPendingMotion(steps=24){
    if(this.hopMode===null)return this.previewPath(this.wanted,steps);
    const count=clamp(Number.isFinite(steps)?Math.floor(steps):24,2,128);
    const start=this.hopSeconds/CADILLAC_SUSPENSION_LIMITS.hopSeconds;
    const progress=Array.from({length:count+1},(_,index)=>start+(1-start)*index/count);
    // Include the future peak even when the remaining time grid straddles it.
    if(start<.5&&!progress.some(value=>Math.abs(value-.5)<EPS))progress.push(.5);
    progress.sort((a,b)=>a-b);
    const path=progress.map(value=>{
      const stroke=copy(this.travel),air=values();this.hopOffsets(this.hopMode!,value,stroke,air);
      return this.solve(stroke,air);
    });
    if(this.levelAfterHop){
      const height=CADILLAC_CORNERS.reduce((sum,corner)=>sum+this.wanted[corner]/4,0);
      path.push(...this.previewPath(values(height),count).slice(1));
    }
    return path;
  }

  update(seconds:number,reducedMotion=false):CadillacSuspensionPose{
    const dt=clamp(Number.isFinite(seconds)?seconds:0,0,CADILLAC_SUSPENSION_LIMITS.maxFrameSeconds);
    let movementDt=dt,changed=false;
    if(reducedMotion){
      changed=this.hopMode!==null||!this.settled;
      this.hopMode=null;this.hopSeconds=this.remainingCooldown=0;
      if(this.levelAfterHop)this.stance('level');
      for(const corner of CADILLAC_CORNERS)this.travel[corner]=this.from[corner]=this.wanted[corner];
      this.movementSeconds=this.movementDuration=0;
    }else if(this.hopMode!==null){
      const remaining=CADILLAC_SUSPENSION_LIMITS.hopSeconds-this.hopSeconds;
      this.hopSeconds=Math.min(CADILLAC_SUSPENSION_LIMITS.hopSeconds,this.hopSeconds+dt);changed=dt>0;
      movementDt=0;
      if(this.hopSeconds>=CADILLAC_SUSPENSION_LIMITS.hopSeconds-EPS){
        movementDt=Math.max(0,dt-remaining);this.hopMode=null;this.hopSeconds=0;
        this.remainingCooldown=Math.max(0,CADILLAC_SUSPENSION_LIMITS.hopCooldownSeconds-movementDt);
        if(this.levelAfterHop)this.stance('level');
      }
    }else this.remainingCooldown=Math.max(0,this.remainingCooldown-dt);
    if(!reducedMotion&&this.movementDuration>0&&movementDt>0){
      this.movementSeconds=Math.min(this.movementDuration,this.movementSeconds+movementDt);
      const progress=this.movementSeconds/this.movementDuration;
      for(const corner of CADILLAC_CORNERS)this.travel[corner]=progress>=1-EPS?this.wanted[corner]:this.from[corner]+(this.wanted[corner]-this.from[corner])*progress;
      if(progress>=1-EPS)this.movementDuration=this.movementSeconds=0;changed=true;
    }
    if(changed)this.compose();
    return this.result;
  }

  private hopOffsets(mode:CadillacHop,progress:number,stroke:CadillacCornerHeights,air:CadillacCornerHeights){
    const pulse=Math.sin(Math.PI*clamp(progress,0,1))**2;
    for(const corner of CADILLAC_CORNERS)if(hopCorner(mode,corner)){
      stroke[corner]=Math.min(CADILLAC_SUSPENSION_LIMITS.max,stroke[corner]+CADILLAC_SUSPENSION_LIMITS.hopExtension*pulse);
      air[corner]=CADILLAC_SUSPENSION_LIMITS.hopWheelLift*pulse;
    }
  }
  private compose(){
    for(const corner of CADILLAC_CORNERS){this.effective[corner]=this.travel[corner];this.air[corner]=0;}
    if(this.hopMode!==null)this.hopOffsets(this.hopMode,this.hopSeconds/CADILLAC_SUSPENSION_LIMITS.hopSeconds,this.effective,this.air);
    this.solve(this.effective,this.air,this.result);
  }
  private solve(stroke:CadillacCornerHeights,air:CadillacCornerHeights,out=emptyPose()):CadillacSuspensionPose{
    let sum=0,sumX=0,sumZ=0;
    for(const corner of CADILLAC_CORNERS){const height=stroke[corner]+air[corner],point=this.anchors[corner];sum+=height;sumX+=height*point.x;sumZ+=height*point.z;}
    const m=this.inverse,limit=CADILLAC_SUSPENSION_LIMITS.maxTiltRadians;
    let x=m[3]*sum+m[4]*sumX+m[5]*sumZ,z=m[6]*sum+m[7]*sumX+m[8]*sumZ;
    // These are actual vertical rows of Three's XYZ Euler transform, not tan
    // slopes: transformed anchors reproduce the solved support heights exactly.
    z=clamp(z,-Math.sin(limit),Math.sin(limit));const pitch=-Math.asin(z),cosPitch=Math.cos(pitch);
    x=clamp(x,-cosPitch*Math.sin(limit),cosPitch*Math.sin(limit));const roll=Math.asin(x/cosPitch);
    let intercept=sum/4-x*this.centre.x-z*this.centre.z,clearance=0;
    for(const corner of CADILLAC_CORNERS){const point=this.anchors[corner];clearance=Math.max(clearance,stroke[corner]+air[corner]-(intercept+x*point.x+z*point.z));}
    intercept+=clearance;
    out.pitch=clean(pitch);out.roll=clean(roll);
    out.heave=clean(intercept+this.centre.y*(1-cosPitch*Math.cos(roll)));
    for(const corner of CADILLAC_CORNERS){const point=this.anchors[corner];out.wheelLifts[corner]=clean(Math.max(0,intercept+x*point.x+z*point.z-stroke[corner]));}
    return out;
  }
  snapshot():CadillacSuspensionSnapshot{return{targets:copy(this.wanted),current:copy(this.travel),pose:{...this.result,wheelLifts:copy(this.result.wheelLifts)},hop:this.hopMode,hopProgress:this.hopMode?this.hopSeconds/CADILLAC_SUSPENSION_LIMITS.hopSeconds:0,cooldown:this.remainingCooldown,settled:this.settled,readyForDrive:this.readyForDrive};}
}
