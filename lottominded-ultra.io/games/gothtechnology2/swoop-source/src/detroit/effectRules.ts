import type {RidePose} from './controller.ts';
import type {SurfaceId,GroundSample} from './terrain.ts';
export type PatchKind='dirt'|'gravel'|'wet'|'leaves';
// Authored decorative patches, in existing Cut station / lateral metres.
export const EFFECT_PATCHES=[
 {id:'gratiot-dirt',d:1772,u:-2.8,rx:.65,rz:3,kind:'dirt'},
 {id:'adelaide-gravel',d:1825,u:2.9,rx:.8,rz:3.2,kind:'gravel'},
 {id:'gratiot-puddle',d:1783,u:1.05,rx:.75,rz:1.3,kind:'wet'},
 {id:'freight-puddle',d:2076,u:-1.2,rx:.65,rz:1.1,kind:'wet'},
 {id:'gratiot-leaves',d:1793,u:-3.2,rx:1.1,rz:5,kind:'leaves'},
 {id:'adelaide-leaves',d:1837,u:3.2,rx:1.1,rz:5,kind:'leaves'}
] as const;
export interface EffectPatch {id:string;kind:PatchKind;x:number;z:number;rx:number;rz:number;heading:number}
export function containsPatch(p:EffectPatch,x:number,z:number){const dx=x-p.x,dz=z-p.z,c=Math.cos(p.heading),s=Math.sin(p.heading);return ((dx*c-dz*s)/p.rx)**2+((dx*s+dz*c)/p.rz)**2<=1;}
export function effectSurface(patches:readonly EffectPatch[],x:number,z:number,surface:SurfaceId){const patch=patches.find(q=>containsPatch(q,x,z));return {wet:patch?.kind==='wet',leaves:patch?.kind==='leaves',surface:patch?.kind==='dirt'||patch?.kind==='gravel'?patch.kind:surface};}
export function landingResponse(impact:number,surface:SurfaceId,wet:boolean){const strength=Math.max(0,Math.min(1,(impact-.8)/5));return {strength,kind:wet?'spray':surface==='dirt'||surface==='gravel'||surface==='sand'?'dust':surface==='grass'?'leaf':'dust',count:strength===0?0:Math.ceil(strength*(wet?12:surface==='grass'?3:['dirt','gravel','sand'].includes(surface)?14:3)),opacity:wet?.4:['dirt','gravel','sand'].includes(surface)?.3:.09};}
export interface Particle {x:number;y:number;z:number;vx:number;vy:number;vz:number;age:number;life:number;size:number;alpha:number;kind:string}
/** Fixed-capacity cosmetic simulation. No render or movement authority. */
export class SurfaceParticles {
 readonly particles:Particle[]=Array.from({length:96},()=>({x:0,y:-10000,z:0,vx:0,vy:0,vz:0,age:0,life:1,size:0,alpha:0,kind:'dust'}));
 readonly rings=Array.from({length:6},()=>({x:0,y:0,z:0,age:0}));
 emitted={dust:0,spray:0,leaf:0,landings:0};private next=0;private ring=0;private cooldown=0;private last?:{x:number;z:number};
 reset(){this.particles.forEach(p=>p.age=0);this.rings.forEach(p=>p.age=0);this.cooldown=0;this.last=undefined;}
 private burst(p:RidePose,y:number,kind:string,count:number,strength=1,opacity=.28){
  for(let n=0;n<count;n++){const i=this.next++%96,q=this.particles[i],a=n*2.399+i*.7,j=(i*17%31)/31;Object.assign(q,{x:p.x+Math.sin(a)*.07,y:y+.035,z:p.z+Math.cos(a)*.07,vx:Math.sin(a)*(.3+strength*.4)-p.velocityX*.06,vy:(kind==='spray'?.8:.2)+j*.35*strength,vz:Math.cos(a)*(.3+strength*.4)-p.velocityZ*.06,age:kind==='spray'?.38:kind==='leaf'?.65:.42,life:kind==='spray'?.38:kind==='leaf'?.65:.42,size:kind==='spray'?.025:kind==='leaf'?.065:.10,alpha:opacity,kind});this.emitted[kind as 'dust'|'spray'|'leaf']++;}
 }
 private ripple(p:RidePose,y:number){Object.assign(this.rings[this.ring++%6],{x:p.x,y:y+.037,z:p.z,age:.65});}
 land(p:RidePose,g:GroundSample,wet:boolean,impact:number,reduced=false){if(reduced||p.crashBlend>0||p.crashMotion>0||g.offCourse||Math.abs(p.y-g.height)>.1)return;const r=landingResponse(impact,g.surface,wet);if(!r.count)return;this.emitted.landings++;this.burst(p,g.height,r.kind,r.count,r.strength,r.opacity);if(wet)this.ripple(p,g.height);}
 step(dt:number,p:RidePose,g:GroundSample,grounded:boolean,wet:boolean,leaves:boolean,reduced=false){
  if(dt<=0)return;if(reduced){this.reset();this.last={x:p.x,z:p.z};return;}
  for(const q of this.particles)if(q.age>0){q.age=Math.max(0,q.age-dt);q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;q.vy-=(q.kind==='spray'?4:q.kind==='leaf'?1:.4)*dt;}
  this.rings.forEach(q=>q.age=Math.max(0,q.age-dt));this.cooldown=Math.max(0,this.cooldown-dt);
  const travel=this.last?Math.hypot(p.x-this.last.x,p.z-this.last.z):0;this.last={x:p.x,z:p.z};
  if(!grounded||p.crashBlend>0||p.crashMotion>0||g.offCourse||Math.abs(p.y-g.height)>.1||Math.abs(p.speed)<1.5||travel<.001||travel>2||this.cooldown>0)return;
  if(wet){this.burst(p,g.height,'spray',4,Math.min(1,Math.abs(p.speed)/10),.5);this.ripple(p,g.height);this.cooldown=.19;}
  else if(g.surface==='dirt'||g.surface==='gravel'||g.surface==='sand'){this.burst(p,g.height,'dust',4,.45,.28);this.cooldown=.22;}
  else if(leaves){this.burst(p,g.height,'leaf',2,.4,.7);this.cooldown=.55;}
 }
 get state(){return {live:this.particles.filter(p=>p.age>0).length,ripples:this.rings.filter(p=>p.age>0).length,emitted:{...this.emitted}};}
}
export class ConfirmationState {
 text='';kind='';remaining=0;private token='';
 show(kind:string,text:string,token:string){if(token===this.token)return false;this.token=token;this.kind=kind;this.text=text;this.remaining=1.8;return true;}
 step(dt:number){this.remaining=Math.max(0,this.remaining-dt);}
 reset(){this.text=this.kind=this.token='';this.remaining=0;}
}
