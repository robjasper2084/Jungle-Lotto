import layout from './giantSlideLayout.json' with {type:'json'};
export {layout as GIANT_SLIDE};
export type SlidePoint={x:number;y:number;z:number};
export const slideWorld=(u:number,v:number,h:number):SlidePoint=>({x:layout.origin[0]+layout.axisX[0]*u+layout.axisRun[0]*v,y:layout.origin[1]+h,z:layout.origin[2]+layout.axisX[2]*u+layout.axisRun[2]*v});
export function slideLocal(x:number,z:number){const dx=x-layout.origin[0],dz=z-layout.origin[2],a=layout.axisX,b=layout.axisRun,det=a[0]*b[2]-a[2]*b[0];return {u:(dx*b[2]-dz*b[0])/det,v:(a[0]*dz-a[2]*dx)/det};}
export const SLIDE_ENTRY=slideWorld(layout.stairsX,21.7,0);
export const SLIDE_HEADING=Math.atan2(layout.axisRun[0],layout.axisRun[2]);
export const slideHeight=(v:number)=>{const t=Math.max(0,Math.min(1,(v+18)/36));return v>=18?.34:.3+11.7*(1-t)+.34*Math.sin(t*Math.PI*10)+.016;};
export function stairHeight(v:number){
 for(let flight=2;flight>=0;flight--){const y=-18+flight*12.6,z=12-flight*3.9;if(v>=y-.275){if(v>=y+10.725)return z-3.9+.065;return z-Math.max(0,Math.min(19,Math.round((v-y)/.55)))*.195+.05;}}
 return 12.07;
}
const distance=(a:SlidePoint,b:SlidePoint)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const mix=(a:SlidePoint,b:SlidePoint,t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
/** A constrained attraction route: no controller teleports or building collision bypasses. */
export class GiantSlideMotion {
 stage:'idle'|'climb'|'ready'|'sit'|'slide'|'stand'|'done'='idle';
 position:SlidePoint={...SLIDE_ENTRY};heading=SLIDE_HEADING+Math.PI;speed=0;seat=0;time=0;travel=0;
 private path:SlidePoint[]=[];private segment=0;private along=0;private age=0;private v=-18;
 start(from:SlidePoint){if(this.stage!=='idle'&&this.stage!=='done')return false;if(distance(from,SLIDE_ENTRY)>6)return false;
  this.position={...from};this.stage='climb';this.time=this.travel=this.seat=this.speed=this.age=this.segment=this.along=0;
  this.path=[from,SLIDE_ENTRY,slideWorld(layout.stairsX,18.75,.365)];
  for(let flight=2;flight>=0;flight--){const y=-18+flight*12.6,z=12-flight*3.9;this.path.push(slideWorld(layout.stairsX,y+11.55,z-3.9+.065));for(let step=19;step>=0;step--)this.path.push(slideWorld(layout.stairsX,y+step*.55,z-step*.195+.05));}
  this.path.push(slideWorld(layout.stairsX,-19.8,12.07),slideWorld(-1.8,-19.8,12.07),slideWorld(-1.8,-18.2,12.07));return true;
 }
 descend(){if(this.stage!=='ready')return false;this.stage='sit';this.age=0;return true;}
 cancel(){this.stage='idle';this.speed=this.seat=0;}
 update(seconds:number){const dt=Math.max(0,Math.min(.05,Number.isFinite(seconds)?seconds:0));this.time+=dt;
  if(this.stage==='climb'){
   this.speed+=(1.25-this.speed)*Math.min(1,dt*5);let left=this.speed*dt;this.travel+=left;
   while(left>0&&this.segment<this.path.length-1){const a=this.path[this.segment],b=this.path[this.segment+1],len=distance(a,b),advance=Math.min(left,len-this.along);this.along+=advance;left-=advance;this.position=mix(a,b,len?this.along/len:1);const facing=Math.atan2(b.x-a.x,b.z-a.z);this.heading+=Math.atan2(Math.sin(facing-this.heading),Math.cos(facing-this.heading))*Math.min(1,dt*10);if(this.along>=len-1e-6){this.segment++;this.along=0;}}
   if(this.segment===this.path.length-1){this.stage='ready';this.heading=SLIDE_HEADING;this.speed=0;}
  }else if(this.stage==='sit'){
   this.age+=dt;const t=Math.min(1,this.age/1.1);this.seat=t*t*(3-2*t);this.position=slideWorld(-1.8,-18.2+.2*this.seat,12.07+(slideHeight(-18)-12.07)*this.seat);
   if(t===1){this.stage='slide';this.v=-18;this.speed=.6;}
  }else if(this.stage==='slide'){
   const slope=(slideHeight(this.v+.03)-slideHeight(this.v-.03))/.06;
   this.speed=Math.max(.8,Math.min(7.5,this.speed+(-slope*9.81-.13*this.speed)*dt));
   if(this.v>18)this.speed=Math.max(1.15,this.speed-2.1*dt);
   const dv=this.speed*dt/Math.hypot(layout.axisRun[0],layout.axisRun[2],slope);this.v=Math.min(23.3,this.v+dv);this.travel+=this.speed*dt;this.position=slideWorld(-1.8,this.v,slideHeight(this.v));
   if(this.v===23.3){this.stage='stand';this.age=0;this.speed=0;}
  }else if(this.stage==='stand'){
   this.age+=dt;const t=Math.min(1,this.age/1.3);this.seat=1-t*t*(3-2*t);this.position=slideWorld(-1.8,23.3+2.4*(1-this.seat),.34*this.seat);
   if(t===1)this.stage='done';
  }
 }
}
