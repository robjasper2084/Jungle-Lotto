export const CONFIG={step:1/120,width:6.1,length:250,maxSpeed:8,acceleration:3,brake:7,lateralSpeed:2.8,radius:.32,dodgeDistance:1.15,dodgeDuration:.32,dodgeCooldown:.85};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function circleSweep(px,pz,dx,dz,r){const c=px*px+pz*pz-r*r;if(c<=0)return 0;const a=dx*dx+dz*dz;if(a<1e-12)return null;const b=2*(px*dx+pz*dz),d=b*b-4*a*c;if(d<0)return null;const t=(-b-Math.sqrt(d))/(2*a);return t>=0&&t<=1?t:null;}
export function boxSweep(px,pz,dx,dz,hx,hz){let lo=0,hi=1;for(const [p,d,h] of [[px,dx,hx],[pz,dz,hz]]){if(Math.abs(d)<1e-9){if(Math.abs(p)>h)return null;continue;}let a=(-h-p)/d,b=(h-p)/d;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return null;}return lo;}
export function encounters(){return [
 {kind:'pedestrian',x:-1.25,z:-20,vx:0,vz:.6,r:.31},
 {kind:'cone',x:.3,z:-31,r:.23},
 {kind:'cyclist',x:1.75,z:-51,vx:0,vz:2.2,r:.48},
 {kind:'pedestrian',x:2,z:-65,vx:-.4,vz:.1,r:.31},
 {kind:'barrier',x:-1.85,z:-75,hx:.8,hz:.3},
 {kind:'rubble',x:.4,z:-92,r:.55},
 {kind:'cyclist',x:-1.65,z:-113,vx:0,vz:2.0,r:.48},
 {kind:'pedestrian',x:.1,z:-121,vx:.22,vz:.3,r:.31},
 {kind:'cone',x:2,z:-138,r:.23},
 {kind:'barrier',x:1.85,z:-151,hx:.8,hz:.3},
 {kind:'pedestrian',x:-1.8,z:-169,vx:.32,vz:.2,r:.31},
 {kind:'rubble',x:-.5,z:-186,r:.55},
 {kind:'cyclist',x:1.45,z:-216,vx:0,vz:2.3,r:.48},
 {kind:'pedestrian',x:-1.6,z:-239,vx:.1,vz:.3,r:.31},
 {kind:'cone',x:.65,z:-243,r:.23}
].map((o,i)=>({...o,id:i,startX:o.x,startZ:o.z,vx:o.vx||0,vz:o.vz||0,passed:false}));}
export class RideSimulation{
 constructor(){this.reset();}
 reset(){Object.assign(this,{x:0,z:0,speed:0,health:3,time:0,travel:0,started:false,paused:false,finished:false,hitTimer:0,cooldown:0,dodgeTime:0,dodgeSign:1,lastEvent:'Ready',eventTimer:0,passes:0,steering:0,obstacles:encounters()});}
 start(){this.started=true;this.paused=false;}
 dodge(direction){if(!this.started||this.paused||this.finished||this.health<=0||this.cooldown>0)return false;this.dodgeSign=direction||1;this.dodgeTime=CONFIG.dodgeDuration;this.cooldown=CONFIG.dodgeCooldown;return true;}
 step(dt,input={}){
  if(!this.started||this.paused||this.finished||this.health<=0)return;
  dt=clamp(dt,0,CONFIG.step);this.time+=dt;this.hitTimer=Math.max(0,this.hitTimer-dt);this.cooldown=Math.max(0,this.cooldown-dt);this.eventTimer=Math.max(0,this.eventTimer-dt);
  const target=input.brake?0:CONFIG.maxSpeed;this.speed+=clamp(target-this.speed,-CONFIG.brake*dt,CONFIG.acceleration*dt);
  this.steering=clamp(input.steer||0,-1,1);let vx=this.steering*CONFIG.lateralSpeed;
  if(this.dodgeTime>0){vx+=this.dodgeSign*CONFIG.dodgeDistance/CONFIG.dodgeDuration;this.dodgeTime=Math.max(0,this.dodgeTime-dt);}
  const nx=clamp(this.x+vx*dt,-CONFIG.width/2+CONFIG.radius,CONFIG.width/2-CONFIG.radius),nz=this.z-this.speed*dt;
  const dx=nx-this.x,dz=nz-this.z;let first=null;
  for(const o of this.obstacles){
   const ox=o.x,oz=o.z;o.x+=o.vx*dt;o.z+=o.vz*dt;
   if(Math.abs(o.x)>2.45){o.x=clamp(o.x,-2.45,2.45);o.vx*=-1;}
   const rx=this.x-ox,rz=this.z-oz,rdx=dx-(o.x-ox),rdz=dz-(o.z-oz);
   const hit=o.kind==='barrier'?boxSweep(rx,rz,rdx,rdz,o.hx+CONFIG.radius,o.hz+CONFIG.radius):circleSweep(rx,rz,rdx,rdz,o.r+CONFIG.radius);
   if(hit!==null&&(!first||hit<first.t))first={o,t:hit};
   if(!o.passed&&o.z>this.z+1){o.passed=true;this.passes++;}
  }
  if(first&&this.hitTimer<=0){this.health--;this.speed=0;this.hitTimer=1.5;this.lastEvent=first.o.kind==='pedestrian'||first.o.kind==='cyclist'?'Give other path users room':'Watch the path';this.eventTimer=2;this.x=clamp(this.x+(this.x>=first.o.x?.42:-.42),-2.7,2.7);this.z+=.2;}
  else {this.x=nx;this.z=nz;this.travel+=Math.abs(dz);}
  if(-this.z>=CONFIG.length){this.finished=true;this.speed=0;this.lastEvent='The Cut is clear';}
 }
 warning(){let best=null;const vx=this.steering*CONFIG.lateralSpeed,vz=-this.speed;for(const o of this.obstacles){const px=o.x-this.x,pz=o.z-this.z,dx=o.vx-vx,dz=o.vz-vz,a=dx*dx+dz*dz;if(a<1e-6||pz>1)continue;const t=clamp(-(px*dx+pz*dz)/a,0,2);const d=Math.hypot(px+dx*t,pz+dz*t);if(d<(o.r||o.hx)+CONFIG.radius+.3&&t<2&&(!best||t<best.t))best={kind:o.kind,t,side:px>=0?'left':'right'};}return best;}
}
