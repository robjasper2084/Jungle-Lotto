import R from '@dimforge/rapier3d-compat';
import type {BattleTerrain} from './battleTerrain.ts';
import type {Vec3,GroundSample,ObstacleHit} from '../terrain.ts';
export type CombatBlockBox={x:number;y:number;z:number;w:number;h:number;d:number;kind:'brick'|'concrete'|'car'|'roof'};
export const COMBAT_BLOCK_BOXES:CombatBlockBox[]=[];
const box=(x:number,y:number,z:number,w:number,h:number,d:number,kind:CombatBlockBox['kind']='brick')=>COMBAT_BLOCK_BOXES.push({x,y,z,w,h,d,kind});
// Two walk-through shops, with 3 m doors at both ends and a central alley.
for(const [x,z] of [[-12,1],[12,13]]){
 // Real side-window openings: matching render/collision, clear indoor floor,
 // a low sill and enough headroom to vault without entering solid scenery.
 for(const side of [-1,1]){
  for(const end of [-1,1])box(x+side*6,1.7,z+end*4.05,.35,3.4,5.9);
  box(x+side*6,.39,z,.35,.78,2.2);box(x+side*6,3.26,z,.35,.28,2.2);
 }
 for(const edge of [-7,7]){box(x-3.75,1.7,z+edge,4.5,3.4,.35);box(x+3.75,1.7,z+edge,4.5,3.4,.35);box(x,2.95,z+edge,3, .9,.35);}
 box(x,3.55,z,12.6,.3,14.6,'roof');
}
for(const [x,z]of [[-6,-17],[7,-8],[-7,24],[17,-21]]){box(x,.65,z,2.1,.8,4.6,'car');box(x,1.25,z,1.85,.65,2.15,'car');}
for(const [x,z,w,d]of [[0,2,2.5,1],[-23,11,1,7],[22,29,7,1],[0,-25,3,1]])box(x,.65,z,w,1.3,d,'concrete');
// Low metal service fence; the cap/posts are also physical, not just scenery.
box(-7,.45,-25,4,.9,.14,'roof');for(const x of [-9,-5])box(x,.53,-25,.14,1.06,.2,'roof');
for(const [x,z,w,d]of [[-29,0,.5,76],[29,0,.5,76],[0,-38,58,.5],[0,38,58,.5]])box(x,2,z,w,4,d,'concrete');
/** Isolated local training geometry. Render meshes and collision share these boxes. */
export class CombatBlockTerrain implements BattleTerrain {
 readonly training=true;
 readonly arenaIdentity={map:'detroit-combat-block',arena:'training-2',rules:'local-training',protocol:1,physics:'rapier',collision:'block-2'};
 readonly spawns=[{x:0,z:-32},{x:-21,z:29},{x:21,z:30},{x:-23,z:-17},{x:21,z:0},{x:0,z:30}].map(p=>({position:{...p,y:0},headingY:Math.atan2(-p.x,-p.z)}));
 readonly zones=Array.from({length:5},()=>({x:0,z:0}));readonly fieldRadii=[150,140,130,120,110,0];
 readonly supplies=Array.from({length:14},(_,i)=>({x:-9+(i%7)*3,y:0,z:i<7?-29:31}));
 readonly optics=[{p:{x:4,y:0,z:-31},kind:'scope2' as const}];
 private nodes:Vec3[]=[];private edges:number[][]=[];
 private constructor(readonly physics:R.World){
  const ids=new Map<string,number>();for(let x=-26;x<=26;x+=2)for(let z=-34;z<=34;z+=2)if(this.clear(x,z,.4)){ids.set(x+','+z,this.nodes.length);this.nodes.push({x,y:0,z});}
  this.edges=this.nodes.map(p=>[[2,0],[-2,0],[0,2],[0,-2]].map(([x,z])=>ids.get((p.x+x)+','+(p.z+z))).filter((i):i is number=>i!==undefined).filter(i=>this.line({...p,y:1},{...this.nodes[i],y:1},.35)));
 }
 static async create(){await R.init();const world=new R.World({x:0,y:-9.81,z:0});world.createCollider(R.ColliderDesc.cuboid(29,.2,38).setTranslation(0,-.2,0).setCollisionGroups(0x00010001));
  for(const b of COMBAT_BLOCK_BOXES)world.createCollider(R.ColliderDesc.cuboid(b.w/2,b.h/2,b.d/2).setTranslation(b.x,b.y,b.z).setCollisionGroups(0x00020002));world.step();return new CombatBlockTerrain(world);}
 ground(x:number,z:number){return {height:0,offCourse:!this.clear(x,z,.27)};}
 clear(x:number,z:number,r=.3){return Math.abs(x)<28-r&&Math.abs(z)<37-r&&!COMBAT_BLOCK_BOXES.some(b=>b.y-b.h/2<1.8&&Math.abs(x-b.x)<b.w/2+r&&Math.abs(z-b.z)<b.d/2+r);}
 sampleGround(x:number,z:number,out:GroundSample){const indoors=Math.abs(x+12)<5.8&&Math.abs(z-1)<6.8||Math.abs(x-12)<5.8&&Math.abs(z-13)<6.8;return Object.assign(out,{...this.ground(x,z),normal:{x:0,y:1,z:0},surface:indoors?'wood':'pavement'});}
 sweep(o:Vec3,delta:Vec3,r=.01){const length=Math.hypot(delta.x,delta.y,delta.z);if(length<1e-9)return null;const hit=this.physics.castShape(o,{x:0,y:0,z:0,w:1},{x:delta.x/length,y:delta.y/length,z:delta.z/length},new R.Ball(Math.max(.01,r)),0,length,true,undefined,0x00020002);return hit?hit.time_of_impact/length:null;}
 raycastObstacle(o:Vec3,d:Vec3,max:number,r=0,_l?:Vec3,out?:ObstacleHit){const n=Math.hypot(d.x,d.y,d.z)||1,t=this.sweep(o,{x:d.x/n*max,y:d.y/n*max,z:d.z/n*max},r);if(t===null)return null;const distance=t*max;if(out)Object.assign(out,{distance,halfExtentX:1,halfExtentZ:1});return distance;}
 surfaceHit(o:Vec3,d:Vec3,max:number){const n=Math.hypot(d.x,d.y,d.z)||1,hit=this.physics.castRayAndGetNormal(new R.Ray(o,{x:d.x/n,y:d.y/n,z:d.z/n}),max,false);return hit?{distance:hit.timeOfImpact,normal:{...hit.normal}}:null;}
 raycast(o:Vec3,d:Vec3,max:number){const n=Math.hypot(d.x,d.y,d.z)||1;return this.physics.castRay(new R.Ray(o,{x:d.x/n,y:d.y/n,z:d.z/n}),max,true)?.timeOfImpact??null;}
 line(a:Vec3,b:Vec3,r=.1){return this.sweep(a,{x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},r)===null;}
 route(from:Vec3,to:Vec3){
  const nearest=(p:Vec3)=>this.nodes.reduce((best,n,i)=>Math.hypot(n.x-p.x,n.z-p.z)<Math.hypot(this.nodes[best].x-p.x,this.nodes[best].z-p.z)?i:best,0),start=nearest(from),end=nearest(to),q=[start],parent=new Map([[start,-1]]);
  for(let i=0;i<q.length;i++){const at=q[i];if(at===end)break;for(const next of this.edges[at])if(!parent.has(next)){parent.set(next,at);q.push(next);}}
  if(!parent.has(end))return [];const path:Vec3[]=[];for(let at=end;at!==start;at=parent.get(at)!)path.unshift(this.nodes[at]);path.unshift(this.nodes[start]);return path;
 }
 dispose(){this.physics.free();}
}
