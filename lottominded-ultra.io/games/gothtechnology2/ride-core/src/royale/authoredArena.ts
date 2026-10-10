import type {GroundSample,ObstacleHit,TerrainSampler,Vec3} from '../terrain.ts';
import {TagTerrain,type TagFixture} from '../tag/fixture.ts';
import {TagNavigation} from '../tag/navigation.ts';

/** Static Royale's map contract uses the existing authored collision export.
 * The game keeps its original scenery and static snapshot. Small additional
 * props use the same shared collision records on the client and host. */
export const AUTHORED_ARENA_REVISION='authored-map-1';
export const AUTHORED_MAPS={
 'swoop-detroit':{label:'Swoop Detroit',arena:'detroit-full-map',entry:'index.html'},
 'elmwood-explorer':{label:'Elmwood Explorer',arena:'elmwood-full-map',entry:'elmwood.html'},
} as const;
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.z-b.z);
const finite=(p:Vec3)=>[p.x,p.y,p.z].every(Number.isFinite);
export type AuthoredArenaLayout={
 product:TagFixture['product'];arena:string;revision:string;collision:string;
 nodes:Vec3[];spawns:{position:Vec3;headingY:number}[];
 zones:Vec3[];supplies:Vec3[];initialRadius:number;
};

/** Deterministic on client and server; only mutually connected exported edges
 * can own spawns/loot/final circles. Isolated roofs and decorative points fail
 * selection. No nearest-point shortcut is used across disconnected islands. */
export function authoredArenaLayout(fixture:TagFixture,clear:(p:Vec3)=>boolean):AuthoredArenaLayout{
 const map=AUTHORED_MAPS[fixture.product],nav=fixture.navigation;
 if(!map||fixture.arena!==map.arena||!fixture.hash||!nav?.nodes.length)
  throw Error('An authored full-map collision and navigation export is required.');
 const edges=nav.nodes.map(()=>new Set<number>());
 for(const [a,b,w]of nav.edges){
  if(!Number.isInteger(a)||!Number.isInteger(b)||!edges[a]||!edges[b]||!Number.isFinite(w)||w<=0)
   throw Error('Invalid authored navigation edge.');
  edges[a].add(b);
 }
 for(let a=0;a<edges.length;a++)for(const b of edges[a])if(!edges[b].has(a))edges[a].delete(b);
 const seen=new Set<number>();let largest:number[]=[];
 for(let start=0;start<edges.length;start++){
  if(seen.has(start)||!edges[start].size)continue;
  const queue=[start];seen.add(start);
  for(let i=0;i<queue.length;i++)for(const next of edges[queue[i]])if(!seen.has(next)){seen.add(next);queue.push(next);}
  if(queue.length>largest.length)largest=queue;
 }
 const usable=largest.filter(i=>edges[i].size>=2&&finite(nav.nodes[i])&&clear(nav.nodes[i]));
 if(usable.length<18)throw Error('Authored map needs connected clear sites for six riders.');
 const nodes=usable.map(i=>({...nav.nodes[i]}));
 const mean=nodes.reduce((p,n)=>({x:p.x+n.x/nodes.length,y:p.y+n.y/nodes.length,z:p.z+n.z/nodes.length}),{x:0,y:0,z:0});
 const center=nodes.reduce((best,p)=>distance(p,mean)<distance(best,mean)?p:best,nodes[0]);
 const zones=[center];
 for(const p of [...nodes].sort((a,b)=>distance(a,center)-distance(b,center)))
  if(zones.length<5&&distance(p,center)<=50&&zones.every(z=>distance(p,z)>=12))zones.push(p);
 // Spread bays across the authored map, rather than Tag's close group start.
 const spawnSites=[nodes.reduce((best,p)=>distance(p,center)>distance(best,center)?p:best,nodes[0])];
 while(spawnSites.length<6){
  let best:Vec3|undefined,score=-1;
  for(const p of nodes){const d=Math.min(...spawnSites.map(s=>distance(s,p)));if(d>score){score=d;best=p;}}
  if(!best||score<20)throw Error('Authored map cannot fit six separated start bays.');
  spawnSites.push(best);
 }
 const supplies:Vec3[]=[];
 for(const spawn of spawnSites){
  const candidates=nodes.filter(p=>distance(p,spawn)>=8&&distance(p,spawn)<=35)
   .sort((a,b)=>distance(a,spawn)-distance(b,spawn));
  for(const p of candidates){if(supplies.filter(s=>distance(s,spawn)<=35).length>=2)break;
   if(supplies.every(s=>distance(s,p)>=5))supplies.push({...p});}
 }
 if(supplies.length<12)throw Error('Authored map needs equivalent nearby supplies at every start.');
 return {product:fixture.product,arena:fixture.arena,revision:AUTHORED_ARENA_REVISION,collision:fixture.hash,nodes,
  spawns:spawnSites.map(p=>({position:{...p},headingY:Math.atan2(center.x-p.x,center.z-p.z)})),
  zones:zones.map(p=>({...p})),supplies,
  initialRadius:Math.ceil(Math.max(...nodes.map(p=>Math.max(...zones.map(z=>distance(p,z)))))+20)};
}

export class AuthoredArena implements TerrainSampler{
 readonly layout:AuthoredArenaLayout;readonly navigation:TagNavigation;
 readonly handshake;
 constructor(readonly terrain:TagTerrain){
  this.navigation=new TagNavigation(terrain.fixture,terrain);
  this.layout=authoredArenaLayout(terrain.fixture,p=>this.clear(p.x,p.z,.75,p.y));
  this.handshake=Object.freeze({map:this.layout.arena,arena:this.layout.revision,
   rules:'static-royale-1',protocol:1,physics:terrain.fixture.physicsVersion,collision:this.layout.collision});
 }
 compatible(value:unknown){return !!value&&Object.entries(this.handshake).every(([k,v])=>(value as Record<string,unknown>)[k]===v);}
 sampleGround(x:number,z:number,out:GroundSample,referenceY?:number){return this.terrain.sampleGround(x,z,out,referenceY);}
 ground(x:number,z:number,referenceY?:number){return this.sampleGround(x,z,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false},referenceY);}
 clear(x:number,z:number,radius=.75,referenceY?:number){
  const ground=this.ground(x,z,referenceY);if(ground.offCourse)return false;
  for(const [dx,dz]of [[radius,0],[-radius,0],[0,radius],[0,-radius]])
   if(!this.terrain.legal({x:x+dx,y:ground.height,z:z+dz}))return false;
  return this.terrain.sweep({x:x-.01,y:ground.height+1,z},{x:.02,y:0,z:0},radius)===null;
 }
 sweep(origin:Vec3,delta:Vec3,radius=0){return this.terrain.sweep(origin,delta,radius);}
 raycastObstacle(o:Vec3,d:Vec3,max:number,w=0,l?:Vec3,out?:ObstacleHit){return this.terrain.raycastObstacle(o,d,max,w,l,out);}
 raycast(o:Vec3,d:Vec3,max:number){return this.terrain.raycast(o,d,max);}
 line(a:Vec3,b:Vec3,radius=.1){return this.sweep(a,{x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},radius)===null;}
 route(from:Vec3,to:Vec3){const result=this.navigation.path(from,to);
  return result.length>1||distance(from,to)<1?result:[];
 }
 /** Coordinates for the existing map-scene root, not a duplicated map. */
 sourcePosition(p:Vec3){const t=this.terrain.fixture.transform;return {x:t.tx+t.sx*p.x,y:p.y+t.ty,z:p.z+t.tz};}
 // Lifetime belongs to the existing game or server's shared immutable map cache.
}
