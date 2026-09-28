import type {TerrainSampler} from '../simulation/world.ts';
import {createGroundSample} from '../simulation/world.ts';

export type CompanionRider={x:number;z:number;headingY:number;speed:number};
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const angle=(x:number)=>Math.atan2(Math.sin(x),Math.cos(x));
export class DogCompanion {
  x=0;y=0;z=0;heading=0;speed=0;groundPitch=0;groundRoll=0;
  side=1;
  private ready=false;
  private ground=createGroundSample();
  private targetGround=createGroundSample();
  private terrain:TerrainSampler;
  constructor(terrain:TerrainSampler){this.terrain=terrain;}
  private clear(ax:number,az:number,bx:number,bz:number,y:number){
    const distance=Math.hypot(bx-ax,bz-az);if(distance<.001)return true;
    const direction={x:(bx-ax)/distance,y:0,z:(bz-az)/distance};
    const hit=this.terrain.raycastObstacle?.({x:ax,y:y+.48,z:az},direction,distance+.28,.24);
    return hit===null||hit===undefined||hit>distance+.22;
  }
  private goal(r:CompanionRider){
    const heading=r.headingY+(r.speed<-.15?Math.PI:0),sx=Math.cos(r.headingY),sz=-Math.sin(r.headingY),fx=Math.sin(heading),fz=Math.cos(heading);
    const floor=this.terrain.sampleGround(r.x,r.z,this.ground).height;
    // Prefer the rider's left, including in reverse. Yield around obstacles.
    for(const [side,ahead] of [[1.35,.15],[1.05,-.8],[-1.35,-.4],[0,-1.8]]){
      const x=r.x+sx*side*this.side+fx*ahead,z=r.z+sz*side*this.side+fz*ahead,g=this.terrain.sampleGround(x,z,this.targetGround);
      if(!g.offCourse&&g.normal.y>.65&&Math.abs(g.height-floor)<1.1&&this.clear(r.x,r.z,x,z,floor))return{x,y:g.height,z,heading};
    }
    return{x:r.x-fx*1.4,y:floor,z:r.z-fz*1.4,heading};
  }
  reset(r:CompanionRider){const g=this.goal(r);Object.assign(this,{x:g.x,y:g.y,z:g.z,heading:g.heading,speed:0});this.ready=true;this.orientToGround();}
  update(r:CompanionRider,seconds:number){
    if(!this.ready){this.reset(r);return;}
    const dt=clamp(seconds,0,.06);if(!dt)return;
    if(Math.hypot(this.x-r.x,this.z-r.z)>45){this.reset(r);return;}
    const target=this.goal(r),dx=target.x-this.x,dz=target.z-this.z,distance=Math.hypot(dx,dz);
    const desired=Math.min(Math.max(7,Math.abs(r.speed)*1.25),Math.max(0,distance-.055)*7);
    this.speed+=(desired-this.speed)*(1-Math.exp(-dt*10));
    if(distance<.065){this.speed=0;this.heading+=angle(target.heading-this.heading)*(1-Math.exp(-dt*3));this.orientToGround();return;}
    const direction=Math.atan2(dx,dz),step=Math.min(distance,this.speed*dt);
    let moved=false;
    for(const turn of [0,.6,-.6,1.1,-1.1]){
      const heading=direction+turn,x=this.x+Math.sin(heading)*step,z=this.z+Math.cos(heading)*step;
      const g=this.terrain.sampleGround(x,z,this.targetGround);
      if(g.offCourse||g.normal.y<.6||Math.abs(g.height-this.y)>.35||!this.clear(this.x,this.z,x,z,this.y))continue;
      this.x=x;this.z=z;this.y=g.height;this.heading+=angle(heading-this.heading)*(1-Math.exp(-dt*12));moved=true;break;
    }
    if(!moved)this.speed=0;
    this.orientToGround();
  }
  private orientToGround(){
    const g=this.terrain.sampleGround(this.x,this.z,this.ground);this.y=g.height;
    const s=Math.sin(this.heading),c=Math.cos(this.heading),nx=g.normal.x*c-g.normal.z*s,nz=g.normal.x*s+g.normal.z*c;
    this.groundPitch=Math.atan2(nz,g.normal.y);this.groundRoll=-Math.atan2(nx,g.normal.y);
  }
}
