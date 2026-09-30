import {DogCompanion,type CompanionRider} from './companion.ts';
import type {TerrainSampler} from '../simulation/world.ts';
import {createGroundSample} from '../simulation/world.ts';
export type DogCommand='follow'|'sit'|'down'|'stay'|'come'|'chase'|'bark';
export type DogTarget={id:string;kind:'goose'|'duck'|'person';x:number;z:number;radius:number;water?:boolean};
export function parseDogCommand(text:string):{command:DogCommand;target?:'birds'|'people'}|undefined{
  const words=text.toLowerCase().replace(/[^a-z ]/g,' ').split(/\s+/);
  if(words.includes('bark')||words.includes('speak'))return {command:'bark',target:words.some(w=>['people','person','walkers'].includes(w))?'people':undefined};
  if(words.includes('chase'))return {command:'chase',target:words.some(w=>['people','person','walkers'].includes(w))?'people':'birds'};
  if(words.includes('stay'))return {command:'stay'};
  if(words.includes('down')||words.includes('lie'))return {command:'down'};
  if(words.includes('sit'))return {command:'sit'};
  if(words.includes('come')||words.includes('follow'))return {command:'come'};
}
function sweptDistance(ax:number,az:number,bx:number,bz:number,p:DogTarget){const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((p.x-ax)*dx+(p.z-az)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(ax+t*dx-p.x,az+t*dz-p.z);}
export class ElmwoodCompanion extends DogCompanion {
  private stalled=0;private stopped=0;private chaseTime=0;private selected?:string;private lookTarget?:string;private map:TerrainSampler;private sample=createGroundSample();
  private waypoint?:{x:number;z:number};private routeClock=0;private routeAge=0;private trail:{x:number;z:number}[]=[];private holdDown=false;
  private idleTime=0;private wanderClock=0;private wanderStep=0;private wanderTarget?:{x:number;z:number};
  recoveries=0;sit=0;lie=0;excitement=0;barking=0;lookYaw=0;command:DogCommand='follow';chaseKind:'birds'|'people'='birds';note='Following';
  constructor(map:TerrainSampler){super(map);this.map=map;}
  override reset(r:CompanionRider){super.reset(r);this.stalled=this.stopped=this.sit=this.lie=this.idleTime=this.wanderClock=0;this.wanderTarget=undefined;this.speedLimit=Infinity;this.command='follow';this.selected=undefined;this.waypoint=undefined;this.trail=[];this.holdDown=false;this.note='Following';}
  order(command:DogCommand,targets:readonly DogTarget[]=[],kind=this.chaseKind){
    if(command==='bark'){this.barking=1.3;this.excitement=1;const target=targets.filter(t=>kind==='people'?t.kind==='person':t.kind!=='person').sort((a,b)=>Math.hypot(a.x-this.x,a.z-this.z)-Math.hypot(b.x-this.x,b.z-this.z))[0];this.lookTarget=target&&Math.hypot(target.x-this.x,target.z-this.z)<18?target.id:undefined;this.note='Barking'+(this.lookTarget?' at nearby '+(kind==='people'?'walker':'birds'):' on command');return;}
    this.holdDown=command==='down'||command==='stay'&&(this.command==='down'||this.holdDown);this.waypoint=undefined;this.idleTime=this.wanderClock=0;this.wanderTarget=undefined;
    this.command=command==='come'?'follow':command;this.stopped=this.stalled=this.chaseTime=0;this.chaseKind=kind;
    if(command==='sit'||command==='stay'||command==='down'){this.speed=0;this.note=(command==='down'?'Lying down':command==='sit'?'Sitting':'Staying')+' · say come to follow';}
    else if(command==='chase'){
      const t=targets.filter(t=>!t.water&&(kind==='people'?t.kind==='person':t.kind!=='person')).sort((a,b)=>Math.hypot(a.x-this.x,a.z-this.z)-Math.hypot(b.x-this.x,b.z-this.z))[0];
      if(t&&Math.hypot(t.x-this.x,t.z-this.z)<45){this.selected=t.id;this.note='Chasing '+(kind==='people'?'a walker':'birds');}
      else{this.command='follow';this.note='No nearby '+(kind==='people'?'walkers':'birds')+' on land';}
    }else this.note=command==='come'?'Coming back':'Following';
  }
  private clearTo(x:number,z:number){const dx=x-this.x,dz=z-this.z,len=Math.hypot(dx,dz);if(len<.01)return true;const hit=this.map.raycastObstacle?.({x:this.x,y:this.y+.48,z:this.z},{x:dx/len,y:0,z:dz/len},len+.3,.32);return hit==null||hit>len+.2;}
  private navigate(r:CompanionRider,dt:number){
    this.routeClock-=dt;if(this.waypoint){this.routeAge+=dt;if(Math.hypot(this.x-this.waypoint.x,this.z-this.waypoint.z)<.6||this.routeAge>2.5)this.waypoint=undefined;}
    if(this.clearTo(r.x,r.z)){this.waypoint=undefined;return r;}
    if(!this.waypoint&&this.routeClock<=0){
      this.routeClock=.45;let best=Infinity;const candidates=[...this.trail.slice(-24).reverse()];
      for(const radius of [2,4,6])for(let i=0;i<16;i++){const a=i*Math.PI/8;candidates.push({x:this.x+Math.sin(a)*radius,z:this.z+Math.cos(a)*radius});}
      for(const p of candidates){const travel=Math.hypot(p.x-this.x,p.z-this.z);if(travel<.8||travel>12||!this.clearTo(p.x,p.z))continue;const g=this.map.sampleGround(p.x,p.z,this.sample);
        if(g.offCourse||g.normal.y<.7||Math.abs(g.height-this.y)>.8)continue;
        const score=Math.hypot(p.x-r.x,p.z-r.z)+travel*.4;if(score<best){best=score;this.waypoint=p;}}
      this.routeAge=0;
    }
    if(this.waypoint){this.note='Finding a way around';return {x:this.waypoint.x-1.35*this.side,z:this.waypoint.z-.15,headingY:0,speed:Math.min(3,Math.abs(r.speed))};}
    return r;
  }
  override update(r:CompanionRider,dt:number,targets:readonly DogTarget[]=[]){
    dt=Math.min(Math.max(dt,0),.06);if(!dt)return;
    this.barking=Math.max(0,this.barking-dt);this.excitement+=((this.barking>0||this.command==='chase'||Math.abs(r.speed)>1?.9:.16)-this.excitement)*(1-Math.exp(-dt*3));
    const watch=targets.find(t=>t.id===this.lookTarget),headAngle=watch&&this.barking>0?Math.atan2(watch.x-this.x,watch.z-this.z)-this.heading:0;this.lookYaw+=(Math.max(-.65,Math.min(.65,Math.atan2(Math.sin(headAngle),Math.cos(headAngle))))-this.lookYaw)*(1-Math.exp(-dt*6));
    const last=this.trail.at(-1);if(!last||Math.hypot(r.x-last.x,r.z-last.z)>1.5){this.trail.push({x:r.x,z:r.z});if(this.trail.length>60)this.trail.shift();}
    const x=this.x,z=this.z;let goal=r;
    this.idleTime=this.command==='follow'&&Math.abs(r.speed)<.15?this.idleTime+dt:0;
    const wandering=this.idleTime>=11;this.speedLimit=wandering?1.05:Infinity;
    if(!wandering){this.wanderTarget=undefined;this.wanderClock=0;}
    else{
      this.wanderClock-=dt;
      if(this.wanderClock<=0){
        this.wanderClock=4;this.wanderTarget=undefined;
        for(let i=0;i<12;i++){
          const angle=++this.wanderStep*2.399963,radius=1.8+(this.wanderStep%3)*.45;
          const px=r.x+Math.sin(angle)*radius,pz=r.z+Math.cos(angle)*radius,g=this.map.sampleGround(px,pz,this.sample);
          if(g.offCourse||g.normal.y<.75||Math.abs(g.height-this.y)>.5||!this.clearTo(px,pz)||targets.some(t=>Math.hypot(t.x-px,t.z-pz)<1+t.radius))continue;
          this.wanderTarget={x:px,z:pz};break;
        }
      }
      if(this.wanderTarget)goal={x:this.wanderTarget.x-1.35*this.side,z:this.wanderTarget.z-.15,headingY:0,speed:0};
      this.note='Exploring nearby';
    }
    if(this.command==='chase'){
      this.chaseTime+=dt;const target=targets.find(t=>t.id===this.selected);
      if(!target||target.water||this.chaseTime>15||Math.hypot(this.x-r.x,this.z-r.z)>35){this.command='follow';this.note='Returning to rider';}
      else{const dx=target.x-this.x,dz=target.z-this.z,d=Math.hypot(dx,dz)||1;goal={x:target.x-dx/d*1.55-1.35*this.side,z:target.z-dz/d*1.55-.15,headingY:0,speed:2.8};}
    }
    if(this.command==='sit'||this.command==='stay'||this.command==='down')this.speed=0;else super.update(this.navigate(goal,dt),dt);
    // Swept contacts prevent crossing through birds or walkers on a long frame.
    for(const target of targets){const radius=.50+target.radius,old=Math.hypot(x-target.x,z-target.z),next=Math.hypot(this.x-target.x,this.z-target.z);
      if(sweptDistance(x,z,this.x,this.z,target)<radius&&next<old){this.x=x;this.z=z;this.speed=0;}
      const d=Math.hypot(this.x-target.x,this.z-target.z);
      if(d<radius){const nx=(this.x-target.x)/(d||1),nz=(this.z-target.z)/(d||1),px=target.x+(d?nx:1)*radius,pz=target.z+nz*radius,g=this.map.sampleGround(px,pz,this.sample);
        if(!g.offCourse&&Math.abs(g.height-this.y)<.4){this.x=px;this.z=pz;this.y=g.height;}}
    }
    const distance=Math.hypot(this.x-r.x,this.z-r.z);
    this.stopped=Math.abs(r.speed)<.15&&this.speed<.18?this.stopped+dt:0;
    const seated=this.command==='sit'||this.command==='stay'&&!this.holdDown||this.command==='follow'&&!wandering&&this.stopped>=1;
    this.sit+=(Number(seated)-this.sit)*(1-Math.exp(-dt*7));this.lie+=(Number(this.command==='down'||this.command==='stay'&&this.holdDown)-this.lie)*(1-Math.exp(-dt*7));
    if(this.command==='follow'&&!wandering&&this.stopped>=1)this.note='Sitting beside rider';else if(this.command==='follow'&&Math.abs(r.speed)>.3)this.note='Following';
    this.stalled=this.command==='follow'&&distance>3&&Math.hypot(this.x-x,this.z-z)<.012?this.stalled+dt:Math.max(0,this.stalled-dt*2);
    if(this.command==='follow'&&(this.stalled>.85||distance>24)){super.reset(r);this.stalled=0;this.waypoint=undefined;this.recoveries++;this.note='Regrouped beside rider';}
  }
}
