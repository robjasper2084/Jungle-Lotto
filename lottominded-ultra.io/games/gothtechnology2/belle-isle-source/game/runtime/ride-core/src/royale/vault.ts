import {createGroundSample,type TerrainSampler,type Vec3} from '../terrain.ts';
export const VAULT_SECONDS=.85;
export type VaultPlan={from:Vec3;to:Vec3;lift:number};
/** Short, deliberate traversal. The complete raised path and landing must fit. */
export function findVault(t:TerrainSampler,p:Vec3&{headingY:number}):VaultPlan|null{
 const d={x:Math.sin(p.headingY),y:0,z:Math.cos(p.headingY)},g=createGroundSample();
 const hit=t.raycastObstacle({...p,y:p.y+.55},d,1.15,.18);
 if(hit===null)return null;
 // Find the top of the first continuous barrier. An overhead window lintel
 // must not be mistaken for a taller wall; the body-path check below still
 // rejects glass, bars, narrow openings and low ceilings.
 const blocked=(y:number)=>t.raycastObstacle({...p,y:p.y+y},d,1.3,.03)!==null;
 let top=.55;while(top<1.56&&blocked(top))top+=.1;
 if(top>=1.56)return null;
 let bottom=Math.max(.35,top-.1);for(let i=0;i<5;i++){const mid=(bottom+top)/2;if(blocked(mid))bottom=mid;else top=mid;}
 const height=top;
 if(height>1.48)return null;
 const lift=height+.16;
 if(t.raycastObstacle({...p,y:p.y+1.5},{x:0,y:1,z:0},lift+.2,.26)!==null)return null;
 for(let distance=Math.max(1.25,hit+.75);distance<=2.65;distance+=.15){
  const to={x:p.x+d.x*distance,y:p.y,z:p.z+d.z*distance};t.sampleGround(to.x,to.z,g,p.y);
  if(g.offCourse||Math.abs(g.height-p.y)>.55)continue;to.y=g.height;
  if(t.raycastObstacle({...to,y:to.y+.28},{x:0,y:1,z:0},1.42,.24)!==null)continue;
  if([.28,.75,1.22,1.7].some(y=>t.raycastObstacle({...p,y:p.y+lift+y},d,distance,.24)!==null))continue;
  const plan={from:{x:p.x,y:p.y,z:p.z},to,lift};
  // Check the rise and descent too, rather than only the raised crossing.
  const phases=[0,.125,.22,.25,.5,.75,.78,.875,1];let clear=true;
  for(let i=1;i<phases.length&&clear;i++){
   const a=vaultPosition(plan,phases[i-1]),b=vaultPosition(plan,phases[i]),delta={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},length=Math.hypot(delta.x,delta.y,delta.z);
   if(length<1e-6)continue;const direction={x:delta.x/length,y:delta.y/length,z:delta.z/length};
   clear=![.28,.75,1.22,1.7].some(y=>t.raycastObstacle({...a,y:a.y+y},direction,length,.24)!==null);
  }
  if(clear)return plan;
 }
 return null;
}
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function vaultPosition(v:VaultPlan,phase:number):Vec3{
 const travel=smooth((phase-.22)/.56),up=smooth(phase/.25)*(1-smooth((phase-.75)/.25));
 return{x:v.from.x+(v.to.x-v.from.x)*travel,y:v.from.y+(v.to.y-v.from.y)*travel+v.lift*up,z:v.from.z+(v.to.z-v.from.z)*travel};
}
