/** Original bounded ripple model. World metres / seconds; independent of physics. */
export const WATER_GRID=64, WATER_SPAN=24, WATER_EVENTS=8, WATER_LIFE=3.5;
export type WaterImpulse={x:number;z:number;time:number;strength:number};
export function rippleGradient(x:number,z:number,time:number,events:readonly WaterImpulse[]){
 let dx=0,dz=0,foam=0;
 for(const e of events){
  const age=time-e.time;if(age<0||age>WATER_LIFE)continue;
  const vx=x-e.x,vz=z-e.z,r=Math.hypot(vx,vz),d=r-age*2.2;
  const envelope=Math.exp(-d*d*2.4-age*.95)*e.strength;
  const slope=envelope*(Math.cos(d*8)*8-Math.sin(d*8)*d*4.8)*.028;
  dx+=slope*vx/Math.max(.1,r);dz+=slope*vz/Math.max(.1,r);foam+=envelope*.16;
 }
 return [dx,dz,Math.min(1,foam)];
}
export function fillRippleField(out:Uint8Array,cx:number,cz:number,time:number,events:readonly WaterImpulse[]){
 for(let y=0;y<WATER_GRID;y++)for(let x=0;x<WATER_GRID;x++){
  const [dx,dz,foam]=rippleGradient(cx+((x+.5)/WATER_GRID-.5)*WATER_SPAN,cz+((y+.5)/WATER_GRID-.5)*WATER_SPAN,time,events),i=(y*WATER_GRID+x)*4;
  out[i]=Math.round(Math.max(0,Math.min(255,128+dx*127)));out[i+1]=Math.round(Math.max(0,Math.min(255,128+dz*127)));out[i+2]=Math.round(foam*255);out[i+3]=255;
 }
}
