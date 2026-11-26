/** Original arcade cruiser physics. Metres, seconds and radians; forward is local +Z. */
export type CarGear = 'P' | 'R' | 'N' | 'D';
export interface CarGround {
  height(x:number,z:number,referenceY?:number):number;
  land(x:number,z:number,referenceY?:number):boolean;
  obstructed(x:number,z:number,margin?:number):unknown;
  bridge(x:number,z:number):{active:boolean;t:number;side:number};
  raycastObstacle(o:{x:number;y:number;z:number},d:{x:number;y:number;z:number},max:number,half?:number):number|null;
}
export interface CarInput {gas:number;brake:number;steer:number;handbrake:boolean;lockSteering?:boolean;lockAttitude?:boolean}
export interface CarPose {x:number;y:number;z:number;heading:number;speed:number;steering:number;pitch:number;roll:number;distance:number}
/** Ground-root-local bounds, after suspension and access-panel transforms.
 * Y is relative to pose.y; forward is +Z. Wheels belong in this envelope. */
export type CarCollisionEnvelopeBounds={minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number};
/** Keep access panels separate: unioning an open side door with the chassis
 * invents a wide front bumper, blocking legitimate openings/reverse escapes. */
export type CarCollisionEnvelope=CarCollisionEnvelopeBounds&{parts?:CarCollisionEnvelopeBounds[]};
type CollisionSamples={
  bounds:CarCollisionEnvelopeBounds;parts:CarCollisionEnvelopeBounds[];footprint:{x:number;z:number}[];
  cells:{x:number;z:number;radius:number;orbit:number;minY:number;maxY:number}[];
};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const approach=(v:number,target:number,amount:number)=>v<target?Math.min(target,v+amount):Math.max(target,v-amount);
export const CAR={halfWidth:1.05,halfLength:2.95,wheelbase:3.3,topSpeed:28,reverseSpeed:7} as const;
const stockFootprint=[-2.95,-1.5,0,1.5,2.95].flatMap(z=>[-1.05,0,1.05].map(x=>({x,z})));
const orderedValues=(minX:number,maxX:number,minY:number,maxY:number,minZ:number,maxZ:number)=>Number.isFinite(minX)&&Number.isFinite(maxX)&&Number.isFinite(minY)&&Number.isFinite(maxY)&&Number.isFinite(minZ)&&Number.isFinite(maxZ)&&minX<=maxX&&minY<=maxY&&minZ<=maxZ&&Number.isFinite(maxX-minX)&&Number.isFinite(maxY-minY)&&Number.isFinite(maxZ-minZ)&&Number.isFinite(Math.hypot(minX,minZ))&&Number.isFinite(Math.hypot(maxX,maxZ));
const orderedBounds=(b:CarCollisionEnvelopeBounds)=>!!b&&orderedValues(b.minX,b.maxX,b.minY,b.maxY,b.minZ,b.maxZ);
const sameFootprint=(a:CarCollisionEnvelopeBounds,b:CarCollisionEnvelopeBounds)=>a.minX===b.minX&&a.maxX===b.maxX&&a.minZ===b.minZ&&a.maxZ===b.maxZ;
const sameBounds=(a:CarCollisionEnvelopeBounds,b:CarCollisionEnvelopeBounds)=>sameFootprint(a,b)&&a.minY===b.minY&&a.maxY===b.maxY;
const copyBounds=(target:CarCollisionEnvelopeBounds,source:CarCollisionEnvelopeBounds)=>{target.minX=source.minX;target.maxX=source.maxX;target.minY=source.minY;target.maxY=source.maxY;target.minZ=source.minZ;target.maxZ=source.maxZ;};
function writePoint(points:CollisionSamples['footprint'],index:number,x:number,z:number){
  const point=points[index];if(point){point.x=x;point.z=z;}else points[index]={x,z};
}
function writeCells(cells:CollisionSamples['cells'],start:number,part:CarCollisionEnvelopeBounds,zCount:number){
  const w=part.maxX-part.minX,l=part.maxZ-part.minZ,radius=Math.hypot(w/4,l/(zCount*2));
  let index=start;
  for(let iz=0;iz<zCount;iz++)for(let ix=0;ix<2;ix++){
    const x=part.minX+w*(ix+.5)/2,z=part.minZ+l*(iz+.5)/zCount,orbit=Math.hypot(x,z),cell=cells[index];
    if(cell){cell.x=x;cell.z=z;cell.radius=radius;cell.orbit=orbit;cell.minY=part.minY;cell.maxY=part.maxY;}
    else cells[index]={x,z,radius,orbit,minY:part.minY,maxY:part.maxY};
    index++;
  }
}

export class CarController {
  pose:CarPose;
  gear:CarGear='P';
  engine=false;
  cruise=0;
  braking=false;
  collided=false;
  private reverseHold=0;
  private autoReverse=false;
  private collisionSamples:CollisionSamples|null=null;
  constructor(readonly terrain:CarGround,spawn:{x:number;z:number;heading:number}) {
    this.pose={...spawn,y:terrain.height(spawn.x,spawn.z),speed:0,steering:0,pitch:0,roll:0,distance:0};
  }
  /** Install a copied numerical envelope, never mesh-scan during physics.
   * An invalid request preserves the last valid envelope. Undefined restores
   * the original controller's queries and handling exactly. */
  setCollisionEnvelope(envelope?:CarCollisionEnvelope):boolean {
    if(envelope===undefined){this.collisionSamples=null;return true;}
    if(!orderedBounds(envelope))return false;
    const parts=envelope.parts;
    if(parts!==undefined&&(!Array.isArray(parts)||parts.length>4))return false;
    const partCount=parts?.length??0;
    // Validate the complete request before mutating any cached number. Indexed
    // access also rejects sparse arrays without allocating Array.from(parts).
    for(let i=0;i<partCount;i++)if(!orderedBounds(parts![i]))return false;
    const minX=Math.min(-CAR.halfWidth,envelope.minX),maxX=Math.max(CAR.halfWidth,envelope.maxX),minY=envelope.minY,maxY=envelope.maxY,minZ=Math.min(-CAR.halfLength,envelope.minZ),maxZ=Math.max(CAR.halfLength,envelope.maxZ);
    if(!orderedValues(minX,maxX,minY,maxY,minZ,maxZ))return false;
    let cache=this.collisionSamples,shapeSame=!!cache&&partCount===cache.parts.length;
    if(shapeSame){const prior=cache!.bounds;shapeSame=prior.minX===minX&&prior.maxX===maxX&&prior.minZ===minZ&&prior.maxZ===maxZ;}
    let unchanged=shapeSame&&cache!.bounds.minY===minY&&cache!.bounds.maxY===maxY;
    for(let i=0;cache&&i<partCount;i++){
      const prior=cache.parts[i];
      if(!prior||!sameFootprint(parts![i],prior))shapeSame=false;
      if(!prior||!sameBounds(parts![i],prior))unchanged=false;
    }
    if(unchanged)return true;
    if(!cache){cache={bounds:{minX,maxX,minY,maxY,minZ,maxZ},parts:[],footprint:[...stockFootprint],cells:[]};this.collisionSamples=cache;}
    const bounds=cache.bounds;
    bounds.minX=minX;bounds.maxX=maxX;bounds.minY=minY;bounds.maxY=maxY;bounds.minZ=minZ;bounds.maxZ=maxZ;
    for(let i=0;i<partCount;i++){
      const part=cache.parts[i]??={minX:0,maxX:0,minY:0,maxY:0,minZ:0,maxZ:0};copyBounds(part,parts![i]);
    }
    cache.parts.length=partCount;
    // Inertial pitch usually changes only the clamped box's top. Keep the X/Z
    // sample grid and all cell identities in that common twice-per-frame path.
    if(shapeSame){
      for(let i=0;i<cache.cells.length;i++){
        const source=i<8?bounds:cache.parts[Math.floor((i-8)/4)],cell=cache.cells[i];cell.minY=source.minY;cell.maxY=source.maxY;
      }
      return true;
    }
    const width=maxX-minX,length=maxZ-minZ;
    // Retain every legacy ground sample. An asymmetric open door must not move
    // an interior shore/obstacle check away from the original body footprint.
    const footprint=cache.footprint;let pointIndex=stockFootprint.length;
    for(let iz=0;iz<5;iz++)for(let ix=0;ix<3;ix++){
      const x=ix===0?minX:ix===2?maxX:minX+width/2,z=iz===0?minZ:iz===4?maxZ:minZ+length*(iz/4);
      if(Math.abs(x)>CAR.halfWidth||Math.abs(z)>CAR.halfLength)writePoint(footprint,pointIndex++,x,z);
    }
    // Eight cell-covering discs bound the entire footprint. Unlike horizontal
    // height slices, vertical rays also catch a very thin overhead collider.
    const cells=cache.cells;writeCells(cells,0,bounds,4);
    for(let i=0;i<partCount;i++){
      const part=cache.parts[i];
      const w=part.maxX-part.minX,l=part.maxZ-part.minZ;
      for(let iz=0;iz<3;iz++)for(let ix=0;ix<3;ix++)writePoint(footprint,pointIndex++,part.minX+w*ix/2,part.minZ+l*iz/2);
      writeCells(cells,8+i*4,part,2);
    }
    footprint.length=pointIndex;cells.length=8+partCount*4;return true;
  }
  /** A bounded grid catches corners, small obstacles, and shore edges. */
  private validFootprint(x:number,z:number,heading:number,referenceY:number):boolean {
    const s=Math.sin(heading),c=Math.cos(heading);
    for(const {x:localX,z:localZ}of this.collisionSamples?.footprint??stockFootprint){
      const px=x+c*localX+s*localZ,pz=z-s*localX+c*localZ;
      if(!this.terrain.land(px,pz,referenceY)||this.terrain.obstructed(px,pz,.23))return false;
      const b=this.terrain.bridge(px,pz);
      if(b.active&&referenceY>=4&&Math.abs(b.side)>11.4)return false;
      if(Math.abs(this.terrain.height(px,pz,referenceY)-referenceY)>1.3)return false;
    }
    return true;
  }
  /** Cover the complete vertical range of the current/candidate swept bounds.
   * The 12cm support skin skips contact with the road/deck itself (the bridge
   * collider rises 8cm above its driving surface). Suspension preflight owns
   * body-to-ground clearance; these probes own above-road obstacle clearance. */
  private clearEnvelope(x:number,z:number,heading:number,referenceY:number,from?:CarPose):boolean {
    const samples=this.collisionSamples;if(!samples)return true;
    const turn=from?heading-from.heading:0,mid=heading-turn/2;
    const mx=from?(x+from.x)/2:x,mz=from?(z+from.z)/2:z;
    const halfTravel=from?Math.hypot(x-from.x,z-from.z)/2:0;
    const nextY=from?this.terrain.height(x,z,referenceY):referenceY;
    const lowGround=Math.min(referenceY,nextY),highGround=Math.max(referenceY,nextY);
    const s=Math.sin(mid),c=Math.cos(mid);
    for(const cell of samples.cells){
      const px=mx+c*cell.x+s*cell.z,pz=mz-s*cell.x+c*cell.z;
      // The mid-pose disc includes each cell's diagonal, translation, and its
      // rotation arc. The min guards wraparound angles outside normal stepping.
      const radius=cell.radius+halfTravel+2*cell.orbit*Math.sin(Math.min(Math.PI*2,Math.abs(turn))/4);
      const base=Math.max(lowGround+cell.minY,this.terrain.height(px,pz,referenceY)+.12),top=highGround+cell.maxY;
      if(base>top)continue;
      const distance=top-base,hit=this.terrain.raycastObstacle({x:px,y:base,z:pz},{x:0,y:1,z:0},distance,radius);
      if(hit!==null&&hit<=distance)return false;
    }
    return true;
  }
  valid(x:number,z:number,heading:number,referenceY=this.pose.y):boolean {
    return this.validFootprint(x,z,heading,referenceY)&&this.clearEnvelope(x,z,heading,referenceY);
  }
  reset(x:number,z:number,heading:number) {
    const y=this.terrain.height(x,z);
    if(!this.valid(x,z,heading,y))return false;
    this.pose={x,y,z,heading,speed:0,steering:0,pitch:0,roll:0,distance:this.pose.distance};
    this.gear='P';this.cruise=0;this.autoReverse=false;this.reverseHold=0;return true;
  }
  selectGear(gear:CarGear) {
    if(Math.abs(this.pose.speed)>.5)return false;
    this.pose.speed=0;this.gear=gear;this.cruise=0;this.autoReverse=false;this.reverseHold=0;return true;
  }
  toggleEngine(){this.engine=!this.engine;this.cruise=0;}
  toggleCruise(){
    if(this.cruise){this.cruise=0;return false;}
    if(this.engine&&this.gear==='D'&&this.pose.speed>2){this.cruise=this.pose.speed;return true;}
    return false;
  }
  cancelCruise(){this.cruise=0;this.reverseHold=0;}
  /** Fixed-size substeps prevent tunnelling and make braking independent of display FPS. */
  advance(seconds:number,input:CarInput) {
    const elapsed=clamp(Number.isFinite(seconds)?seconds:0,0,.12);
    const steps=Math.max(1,Math.ceil(elapsed/(1/120))),dt=elapsed/steps;
    this.collided=false;
    if(input.brake>.02||input.handbrake||Math.abs(input.steer)>.8)this.cruise=0;
    for(let i=0;i<steps;i++)this.step(dt,input);
    return this.pose;
  }
  private step(dt:number,input:CarInput) {
    const p=this.pose;
    let gas=clamp(input.gas,0,1),brake=clamp(input.brake,0,1);
    if(this.autoReverse){
      if(gas>.02){
        if(p.speed<-.25){brake=Math.max(brake,gas);gas=0;}
        else{this.gear='D';this.autoReverse=false;}
      }else if(brake>.02){gas=brake;brake=0;}
    }else if(this.gear==='D'&&brake>.02&&!gas&&Math.abs(p.speed)<.25&&!input.handbrake){
      this.reverseHold+=dt;
      if(this.reverseHold>.45){this.gear='R';this.autoReverse=true;gas=brake;brake=0;}
    }else this.reverseHold=0;
    if(!this.engine||this.gear==='N'||this.gear==='P')gas=0;
    if(this.cruise&&this.engine&&this.gear==='D')gas=Math.max(gas,clamp((this.cruise-p.speed)*.8+.07,0,1));
    if(this.gear==='P')brake=1;
    this.braking=brake>.02||input.handbrake||this.gear==='P';
    const steeringLimit=.52/(1+Math.abs(p.speed)*.035);
    if(!input.lockSteering)p.steering=approach(p.steering,-clamp(input.steer,-1,1)*steeringLimit,dt*1.5);
    const sign=this.gear==='R'?-1:1,top=sign<0?CAR.reverseSpeed:CAR.topSpeed;
    let next=p.speed+sign*gas*3.9*Math.max(.15,1-Math.abs(p.speed)/top)*dt;
    const resistance=.16+Math.abs(p.speed)*.025+p.speed*p.speed*.0014;
    next=approach(next,0,(resistance+brake*8.5+(input.handbrake?13:0))*dt);
    next=clamp(next,-CAR.reverseSpeed,CAR.topSpeed);
    if(Math.abs(next)<.025&&!gas)next=0;
    const yawRate=next/CAR.wheelbase*Math.tan(p.steering);
    const heading=p.heading+yawRate*dt;
    const mid=p.heading+yawRate*dt*.5;
    const nx=p.x+Math.sin(mid)*next*dt,nz=p.z+Math.cos(mid)*next*dt;
    if(!this.validFootprint(nx,nz,heading,p.y)||!this.clearEnvelope(nx,nz,heading,p.y,p)){
      p.speed=0;this.cruise=0;this.collided=true;return;
    }
    if(Math.abs(next)>.01){
      const dir={x:Math.sin(mid)*Math.sign(next),y:0,z:Math.cos(mid)*Math.sign(next)};
      const hit=this.terrain.raycastObstacle({x:p.x,y:p.y+.65,z:p.z},dir,CAR.halfLength+Math.abs(next*dt)+.15,CAR.halfWidth);
      if(hit!==null&&hit<=CAR.halfLength+Math.abs(next*dt)+.08){p.speed=0;this.cruise=0;this.collided=true;return;}
    }
    p.x=nx;p.z=nz;p.heading=heading;p.speed=next;p.distance+=Math.abs(next*dt);
    p.y=this.terrain.height(nx,nz,p.y);
    if(!input.lockAttitude){
      const s=Math.sin(heading),c=Math.cos(heading);
      const front=this.terrain.height(nx+s*1.65,nz+c*1.65,p.y),back=this.terrain.height(nx-s*1.65,nz-c*1.65,p.y);
      const left=this.terrain.height(nx+c*.85,nz-s*.85,p.y),right=this.terrain.height(nx-c*.85,nz+s*.85,p.y);
      p.pitch=approach(p.pitch,-Math.atan2(front-back,3.3),dt*.5);
      p.roll=approach(p.roll,Math.atan2(left-right,1.7)+clamp(yawRate*next*.0015,-.035,.035),dt*.35);
    }
  }
  exitPoint(){
    if(Math.abs(this.pose.speed)>.5)return null;
    const p=this.pose,c=Math.cos(p.heading),s=Math.sin(p.heading);
    for(const [lx,lz]of [[1.8,-.35],[-1.8,-.35],[0,-3.8],[0,3.8]]){
      const x=p.x+c*lx+s*lz,z=p.z-s*lx+c*lz;
      if(this.terrain.land(x,z,p.y)&&!this.terrain.obstructed(x,z,.5)&&Math.abs(this.terrain.height(x,z,p.y)-p.y)<.6){
        const b=this.terrain.bridge(x,z);if(b.active&&p.y>=4&&Math.abs(b.side)>11.2)continue;
        return{x,y:this.terrain.height(x,z,p.y),z,heading:p.heading};
      }
    }
    return null;
  }
}
