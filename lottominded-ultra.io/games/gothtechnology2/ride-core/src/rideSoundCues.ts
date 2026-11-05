/** Speed-driven feedback shared by all three games. */
export function wheelCue(p:{speed:number;footMode?:number;airHeight:number;crashBlend:number},alive:boolean,active:boolean){
 const speed=Math.min(28,Math.abs(p.speed));
 return {hz:55+speed*7,gain:active&&alive&&!p.footMode&&p.crashBlend<.3?Math.min(.035,speed*.0018)*(p.airHeight>.15?.3:1):0};
}
export function brakingCue(p:{speed:number;brakeAmount:number;footMode?:number;airHeight:number;crashBlend:number},active:boolean){
 return active&&!p.footMode&&p.crashBlend<.3&&p.airHeight<.15?Math.min(1,Math.max(0,p.brakeAmount))*Math.min(1,Math.abs(p.speed)/6)*.016:0;
}
