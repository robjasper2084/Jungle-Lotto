import type {TerrainSampler,Vec3} from '@digital-static/ridecore';
import type {ElmwoodRun} from './elmwood-gameplay.ts';
/** Recovery returns to the last earned gate, never to an unearned later lane. */
export function elmwoodRaceRecovery(run:ElmwoodRun,terrain:TerrainSampler,side=0):{position:Vec3;heading:number}|undefined{
 if(run.mode!=='sprint'||run.finished)return;
 const at=run.gates[Math.max(0,run.gate-1)],next=run.gates[Math.min(run.gate,run.gates.length-1)];if(!at||!next)return;
 const heading=Math.atan2(next.x-at.x,next.z-at.z),s=Math.sin(heading),c=Math.cos(heading);
 for(const back of [.6,1.5,2.5,0])for(const across of [side,side+.6,side-.6]){
  const x=at.x-s*back+c*across,z=at.z-c*back-s*across;
  const g=terrain.sampleGround(x,z,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});
  if(g.offCourse||g.normal.y<.6||terrain.raycastObstacle({x,y:g.height+.7,z},{x:0,y:1,z:0},1,.55)!==null)continue;
  if(terrain.navigationObstacles?.(x,z,2).some(a=>Math.hypot(a.x-x,a.z-z)<a.radius+.65&&Math.abs(a.y-g.height)<2))continue;
  return {position:{x,y:g.height,z},heading};
 }
}
