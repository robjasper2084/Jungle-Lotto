import type {Vec3} from '../terrain.ts';
import type {BattleTerrain} from './battleTerrain.ts';
export type BotGoal='rotate'|'cover'|'resupply'|'engage'|'search'|'patrol';
const gap=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
/** Only the caller's visible enemy / last seen memory is considered. */
export function tacticalDestination(terrain:BattleTerrain,p:Vec3,field:{x:number;z:number;radius:number},enemy:Vec3|undefined,memory:Vec3|undefined,defend:boolean,supplies:readonly Vec3[],index:number,tick:number):{point:Vec3;mode:BotGoal}{
 const safe=Math.max(5,field.radius-25),inside=(q:Vec3)=>gap(q,field)<safe;
 if(!inside(p))return {point:{x:field.x,y:terrain.ground(field.x,field.z).height,z:field.z},mode:'rotate'};
 if(enemy&&defend){
  const away=Math.atan2(p.x-enemy.x,p.z-enemy.z),options=[];
  for(const d of [6,11])for(const turn of [-1,-.5,0,.5,1,2,-2]){
   const a=away+turn,q={x:p.x+Math.sin(a)*d,y:p.y,z:p.z+Math.cos(a)*d};q.y=terrain.ground(q.x,q.z,p.y).height;
   if(!inside(q)||!terrain.clear(q.x,q.z,.7,p.y)||!terrain.line({...p,y:p.y+.7},{...q,y:q.y+.7},.7))continue;
   const covered=!terrain.line({...enemy,y:enemy.y+1.3},{...q,y:q.y+1.3});
   options.push({point:q,score:(covered?100:0)+gap(q,enemy)-d*.5});
  }
  options.sort((a,b)=>b.score-a.score);if(options.length)return {point:options[0].point,mode:'cover'};
 }
 if(!enemy&&supplies.length){const nearby=supplies.filter(q=>inside(q)&&gap(q,p)<60&&terrain.clear(q.x,q.z,.7,p.y)).sort((a,b)=>gap(a,p)-gap(b,p));if(nearby.length)return {point:nearby[0],mode:'resupply'};}
 if(enemy){
  // Keep spacing instead of driving directly into the opponent.
  const d=gap(p,enemy),a=Math.atan2(p.x-enemy.x,p.z-enemy.z)+(index%2?1:-1)*.4;
  const q={x:enemy.x+Math.sin(a)*18,y:enemy.y,z:enemy.z+Math.cos(a)*18};
  return {point:d<35&&inside(q)&&terrain.clear(q.x,q.z,.7,p.y)?q:enemy,mode:'engage'};
 }
 if(memory)return {point:memory,mode:'search'};
 const phase=tick/1200+index*2.399,r=Math.min(100,field.radius*.55),x=field.x+Math.sin(phase)*r,z=field.z+Math.cos(phase)*r;
 return {point:{x,y:terrain.ground(x,z).height,z},mode:'patrol'};
}
/** Lead game projectiles; add drop compensation without removing aim error. */
export function leadTarget(from:Vec3,target:Vec3,velocity:{x:number;z:number},speed:number,gravity:number){
 const flight=Math.min(.9,gap(from,target)/speed);
 return {x:target.x+velocity.x*flight,y:target.y+gravity*flight*flight*.5,z:target.z+velocity.z*flight};
}
