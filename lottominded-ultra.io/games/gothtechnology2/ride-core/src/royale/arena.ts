import {ENGINE_ID,engineReady} from '../engine/runtime.ts';
import {COMBAT_HASH} from './combatIdentity.ts';
import {WHEEL_CATALOG_REVISION} from './wheelProfiles.ts';
import type {BattleTerrain} from './battleTerrain.ts';
import R from '@dimforge/rapier3d-compat';
import type {GroundSample,Vec3,ObstacleHit} from '../terrain.ts';
export type Block={id:string;x:number;z:number;w:number;d:number;h:number;kind:'building'|'cover'|'boundary'};
export const ARENA_ID='detroit-static-district';
export const BLOCKS:Block[]=[];
for(const x of [-150,-75,75,150])for(const z of [-150,-75,75,150]){
 BLOCKS.push({id:'block-'+x+'-'+z,x,z,w:44,d:44,h:18+((Math.abs(x)+Math.abs(z))%35),kind:'building'});
}
for(const [x,z]of [[-28,-24],[28,24],[-28,24],[28,-24],[-110,0],[110,0],[0,110],[0,-110]]){
 BLOCKS.push({id:'cover-'+x+'-'+z,x,z,w:9,d:5,h:1.8,kind:'cover'});
}
for(const [x,z,w,d]of [[-226,0,2,454],[226,0,2,454],[0,-226,454,2],[0,226,454,2]])BLOCKS.push({id:'edge-'+x+'-'+z,x,z,w,d,h:4,kind:'boundary'});
// Original compressed district. Two slopes connect a short parking deck, open at both ends.
export const RAMPS=[{x:-10,z:130,w:20,d:30,h:3,rise:1},{x:-10,z:160,w:20,d:30,h:3,rise:0},{x:-10,z:190,w:20,d:30,h:3,rise:-1}];
export const SPAWNS=[{x:-200,z:-115},{x:0,z:-200},{x:200,z:-115},{x:200,z:115},{x:0,z:210},{x:-200,z:115}].map(p=>({position:{...p,y:0},headingY:Math.atan2(-p.x,-p.z)}));
export const ZONE_CANDIDATES=[{x:0,z:0},{x:-12,z:0},{x:12,z:0},{x:0,z:-12},{x:0,z:12}];
function hash(text:string){let n=2166136261;for(let i=0;i<text.length;i++)n=Math.imul(n^text.charCodeAt(i),16777619);return(n>>>0).toString(16).padStart(8,'0');}
export const COLLISION_HASH=hash(JSON.stringify({blocks:BLOCKS,ramps:RAMPS,spawns:SPAWNS,zone:ZONE_CANDIDATES}));
export const HANDSHAKE=Object.freeze({map:ARENA_ID,arena:'1',rules:'static-royale-1',protocol:1,physics:'ridecore-1.2.0-battle-1',collision:COLLISION_HASH});
export function currentHandshake(base:BattleTerrain['arenaIdentity']=HANDSHAKE){return engineReady()?{...base,...ENGINE_ID,rules:'static-royale-cpp-2',protocol:3,combat:COMBAT_HASH,wheels:WHEEL_CATALOG_REVISION,physics:'ridecore-mounted-2'}:base;}
export function compatible(value:unknown,base:BattleTerrain['arenaIdentity']=HANDSHAKE){const expected=currentHandshake(base);return !!value&&Object.keys(value as object).length===Object.keys(expected).length&&Object.entries(expected).every(([k,v])=>(value as Record<string,unknown>)[k]===v);}
export function ground(x:number,z:number){
 for(const r of RAMPS)if(Math.abs(x-r.x)<=r.w/2&&Math.abs(z-r.z)<=r.d/2){
  const t=(z-r.z+r.d/2)/r.d;return {height:r.rise===0?r.h:r.h*(r.rise>0?t:1-t),slope:r.rise*r.h/r.d};
 }return {height:0,slope:0};
}
export function clearGround(x:number,z:number,pad=2){return Math.abs(x)<220-pad&&Math.abs(z)<220-pad&&!BLOCKS.some(b=>Math.abs(x-b.x)<b.w/2+pad&&Math.abs(z-b.z)<b.d/2+pad);}
let ready:Promise<void>|undefined;
export class ArenaTerrain implements BattleTerrain{
 readonly spawns=SPAWNS;readonly zones=ZONE_CANDIDATES;readonly arenaIdentity=HANDSHAKE;
 ground=ground;clear=clearGround;route(from:Vec3,to:Vec3){return route(from,to,this);}
 private constructor(readonly physics:R.World){}
 static async create(){
  await(ready??=R.init());const world=new R.World({x:0,y:-9.81,z:0});
  world.createCollider(R.ColliderDesc.cuboid(225,.2,225).setTranslation(0,-.2,0).setCollisionGroups(0x00010001));
  for(const b of BLOCKS)world.createCollider(R.ColliderDesc.cuboid(b.w/2,b.h/2,b.d/2).setTranslation(b.x,b.h/2,b.z).setCollisionGroups(0x00020002));
  for(const r of RAMPS){
   const z0=r.z-r.d/2,z1=r.z+r.d/2,x0=r.x-r.w/2,x1=r.x+r.w/2,a=r.rise>=0?(r.rise?r.h:3):r.h,b=r.rise<=0?(r.rise?0:3):r.h;
   const h0=r.rise===1?0:a,h1=b;
   const vertices=new Float32Array([x0,h0,z0,x1,h0,z0,x0,h1,z1,x1,h1,z1]);
   world.createCollider(R.ColliderDesc.trimesh(vertices,new Uint32Array([0,2,1,1,2,3])).setCollisionGroups(0x00010001));
  }
  world.step();return new ArenaTerrain(world);
 }
 sampleGround(x:number,z:number,out:GroundSample){const g=ground(x,z),n=Math.hypot(1,g.slope);out.height=g.height;out.normal={x:0,y:1/n,z:-g.slope/n};out.surface='pavement';out.offCourse=!clearGround(x,z,.3);return out;}
 sweep(origin:Vec3,delta:Vec3,radius=.01){const length=Math.hypot(delta.x,delta.y,delta.z);if(length<1e-9)return null;const v={x:delta.x/length,y:delta.y/length,z:delta.z/length};
  const hit=this.physics.castShape(origin,{x:0,y:0,z:0,w:1},v,new R.Ball(Math.max(.01,radius)),0,length,true,undefined,0x00020002);
  return hit?hit.time_of_impact/length:null;
 }
 raycastObstacle(o:Vec3,d:Vec3,max:number,w=0,_l?:Vec3,out?:ObstacleHit){const n=Math.hypot(d.x,d.y,d.z)||1,t=this.sweep(o,{x:d.x/n*max,y:d.y/n*max,z:d.z/n*max},w);if(t===null)return null;const distance=t*max;if(out)Object.assign(out,{distance,halfExtentX:1,halfExtentZ:1});return distance;}
 raycast(o:Vec3,d:Vec3,max:number){const n=Math.hypot(d.x,d.y,d.z)||1;const hit=this.physics.castRay(new R.Ray(o,{x:d.x/n,y:d.y/n,z:d.z/n}),max,true);return hit?.timeOfImpact??null;}
 line(a:Vec3,b:Vec3,radius=.1){return this.sweep(a,{x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},radius)===null;}
 dispose(){this.physics.free();}
}
export const NAV:Vec3[]=[];for(let x=-210;x<=210;x+=15)for(let z=-210;z<=210;z+=15)if(clearGround(x,z,3))NAV.push({x,y:ground(x,z).height,z});
const navIndex=new Map(NAV.map((p,i)=>[p.x+','+p.z,i]));
const edges=NAV.map(p=>[[15,0],[-15,0],[0,15],[0,-15]].map(([x,z])=>navIndex.get((p.x+x)+','+(p.z+z))).filter((v):v is number=>v!==undefined));
const safeEdges=new WeakMap<ArenaTerrain,number[][]>();
export function route(from:Vec3,to:Vec3,terrain:ArenaTerrain):Vec3[]{
 const nearest=(p:Vec3)=>NAV.reduce((best,v,i)=>Math.hypot(v.x-p.x,v.z-p.z)<Math.hypot(NAV[best].x-p.x,NAV[best].z-p.z)?i:best,0);
 const start=nearest(from),end=nearest(to),queue=[start],parents=new Map<number,number>([[start,-1]]);
 let graph=safeEdges.get(terrain);if(!graph){graph=edges.map((list,at)=>list.filter(next=>terrain.line({...NAV[at],y:NAV[at].y+.7},{...NAV[next],y:NAV[next].y+.7},.6)));safeEdges.set(terrain,graph);}
 for(let k=0;k<queue.length;k++){const at=queue[k];if(at===end)break;for(const next of graph[at])if(!parents.has(next)){parents.set(next,at);queue.push(next);}}
 if(!parents.has(end))return [];
 const result:Vec3[]=[];for(let at=end;at!==start;at=parents.get(at)!)result.unshift(NAV[at]);result.unshift(NAV[start]);return result;
}
