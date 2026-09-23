import {createGroundSample,type TerrainSampler,type Vec3,type NavigationObstacle} from './terrain.ts';
import {brakingLookahead} from './encounterWarning.ts';
/** Conservative staging check only. It never moves or steers the player. */
export function encounterOptions(terrain:TerrainSampler,p:Vec3,heading:number,speed:number,actors:NavigationObstacle[]){
 const v=Math.abs(speed),s=Math.sin(heading)*(speed<0?-1:1),c=Math.cos(heading)*(speed<0?-1:1);
 const ahead=actors.filter(o=>Math.abs(o.y-p.y)<2&&(o.x-p.x)*s+(o.z-p.z)*c>-.5);
 const range=brakingLookahead(v),horizon=Math.max(1.5,range/Math.max(1,v));
 const clear=(x:number,z:number,time:number)=>{const g=terrain.sampleGround(x,z,createGroundSample(),p.y);return !g.offCourse&&g.normal.y>.91&&Math.abs(g.height-p.y)<.5&&!ahead.some(o=>Math.hypot(x-o.x-o.vx*time,z-o.z-o.vz*time)<o.radius+.6);};
 const braking=ahead.every(o=>{const along=(o.x-p.x)*s+(o.z-p.z)*c,side=Math.abs((o.x-p.x)*c-(o.z-p.z)*s);return side>o.radius+.6||along>range+Math.max(0,-o.vx*s-o.vz*c)*horizon+o.radius;});
 const sides=[-1,1].filter(side=>{
  // Reaction first, then a bounded 2 m lateral move over at least 1.4 s.
  const duration=Math.max(1.4,Math.sqrt(Math.PI*Math.PI/(Math.max(1,v)*.62)));
  let previous={x:p.x,y:p.y+.65,z:p.z};
  for(let t=0;t<=horizon;t+=.12){const u=Math.max(0,Math.min(1,(t-.8)/duration)),lateral=side*(1-Math.cos(u*Math.PI)),forward=v*t,x=p.x+s*forward+c*lateral,z=p.z+c*forward-s*lateral;
   if(!clear(x,z,t))return false;
   const delta={x:x-previous.x,y:0,z:z-previous.z},length=Math.hypot(delta.x,delta.z);
   if(length>.001&&terrain.raycastObstacle(previous,{x:delta.x/length,y:0,z:delta.z/length},length,.5)!==null)return false;
   previous={x,y:p.y+.65,z};
  }return true;
 });
 return {brake:braking,left:sides.includes(-1),right:sides.includes(1),feasible:braking||sides.length>0};
}
