// A continuous out-and-back loop: two lanes joined by slow rounded turns.
// The old triangular travel wave changed heading by 180 degrees in one frame.
const STRAIGHT=50,RADIUS=1.5,ARC=Math.PI*RADIUS,PERIMETER=2*(STRAIGHT+ARC),STEPS=800;
function shape(distance:number){
  const s=((distance%PERIMETER)+PERIMETER)%PERIMETER;
  if(s<STRAIGHT)return{travel:s,offset:-RADIUS,turnDistance:Math.min(s,STRAIGHT-s)};
  if(s<STRAIGHT+ARC){const a=(s-STRAIGHT)/RADIUS;return{travel:STRAIGHT+RADIUS*Math.sin(a),offset:-RADIUS*Math.cos(a),turnDistance:0};}
  if(s<2*STRAIGHT+ARC){const d=s-STRAIGHT-ARC;return{travel:STRAIGHT-d,offset:RADIUS,turnDistance:Math.min(d,STRAIGHT-d)};}
  const a=(s-2*STRAIGHT-ARC)/RADIUS;return{travel:-RADIUS*Math.sin(a),offset:RADIUS*Math.cos(a),turnDistance:0};
}
function speedAt(s:number){const t=Math.min(1,shape(s).turnDistance/6);return 1.4+2*t*t*(3-2*t);}
const times=[0],step=PERIMETER/STEPS;
for(let i=1;i<=STEPS;i++)times.push(times[i-1]+step*.5*(1/speedAt((i-1)*step)+1/speedAt(i*step)));
export const CYCLIST_LOOP_SECONDS=times.at(-1)!;
export function cyclistLoop(time:number){
  const t=((time%CYCLIST_LOOP_SECONDS)+CYCLIST_LOOP_SECONDS)%CYCLIST_LOOP_SECONDS;let lo=1,hi=STEPS;
  while(lo<hi){const mid=(lo+hi)>>1;if(times[mid]<t)lo=mid+1;else hi=mid;}
  const s=(lo-1+(t-times[lo-1])/(times[lo]-times[lo-1]))*step;
  return{...shape(s),speed:speedAt(s)};
}
