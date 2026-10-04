import type {TagFixture,TagTerrain} from './fixture.ts';
/** Start together on actual clear ground; the full map stays open after launch. */
export function tagSpawnCluster(f:TagFixture,terrain:TagTerrain){
 for(const anchor of f.spawns){const p=anchor.position,s=Math.sin(anchor.headingY),c=Math.cos(anchor.headingY),slots=[];
  // First opponent is ahead within heart range. Other seats have independent
  // steering room, with no coincident positions or unvalidated teleport sites.
  for(const [forward,side]of [[0,0],[3,0],[6,0],[9,0],[0,-2],[0,2],[3,-2],[3,2],[6,-2],[6,2],[9,-2],[9,2],[-3,-2],[-3,2]]){
   const x=p.x+s*forward+c*side,z=p.z+c*forward-s*side,g=terrain.sampleGround(x,z,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false}),position={x,y:g.height,z};
   if(!terrain.legal(position)||Math.abs(position.y-p.y)>1.5||terrain.raycastObstacle({...position,y:position.y+.65},{x:0,y:1,z:0},1,.6)!==null)continue;
   const d={x:x-p.x,y:g.height-p.y,z:z-p.z},length=Math.hypot(d.x,d.y,d.z);
   if(length>.1&&terrain.raycastObstacle({...p,y:p.y+1.05},d,length,.14)!==null)continue;
   slots.push({position,headingY:anchor.headingY});if(slots.length===8)return slots;
  }
 }
 throw Error('No clear eight-rider launch cluster on the actual map');
}
