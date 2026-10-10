import type {Vec3} from '../terrain.ts';
import type {BattleTerrain} from './battleTerrain.ts';
export type SpawnNode={id:string;cluster:string;position:Vec3;headingY:number};
export const SPAWN_SECTORS=[{id:'atwater',x:-72.5,z:-1180},{id:'chene',x:-211,z:-1625},{id:'cut',x:1100,z:-1360},{id:'mack',x:2460,z:-1430}] as const;
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.z-b.z);
export function shuffled<T>(values:readonly T[],seed:number){const a=[...values];let n=seed|0;for(let i=a.length-1;i>0;i--){n^=n<<13;n^=n>>>17;n^=n<<5;if(!n)n=1234567;const j=(n>>>0)%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function configuredSpawnNodes(nodes:readonly Vec3[],t:{sx:number;tx:number;tz:number},clear:(p:Vec3)=>boolean):SpawnNode[]{
 const out:SpawnNode[]=[];
 for(const sector of SPAWN_SECTORS){
  const anchor={x:(sector.x-t.tx)/t.sx,y:0,z:sector.z-t.tz},center=[...nodes].filter(clear).sort((a,b)=>distance(a,anchor)-distance(b,anchor))[0];if(!center)throw Error('No safe downtown spawn sector '+sector.id);
  const candidates=nodes.filter(p=>clear(p)&&distance(p,center)<=100).sort((a,b)=>distance(a,center)-distance(b,center)),group:Vec3[]=[];
  for(const p of candidates)if(group.every(q=>distance(p,q)>=30&&distance(p,q)<=100)){group.push(p);if(group.length===4)break;}
  if(group.length<3)throw Error('Spawn sector needs three supported nodes: '+sector.id);
  group.forEach((p,i)=>out.push({id:sector.id+'-'+i,cluster:sector.id,position:{...p},headingY:Math.atan2(center.x-p.x,center.z-p.z)}));
 }
 if(out.length<12)throw Error('Downtown needs at least twelve spawn nodes');return out;
}
export function initialSpawnNodes(nodes:readonly SpawnNode[],count:number,seed:number){
 const clusters=shuffled([...new Set(nodes.map(n=>n.cluster))],seed),ordered=clusters.flatMap((c,i)=>shuffled(nodes.filter(n=>n.cluster===c),seed+i*7919));
 if(count>ordered.length)throw Error('Not enough distinct spawn nodes');return ordered.slice(0,count);
}
export function recoveryNode(terrain:BattleTerrain,nodes:readonly SpawnNode[],dead:Vec3,oldNode:string,live:readonly Vec3[],field:{x:number;z:number;radius:number},seed:number){
 const nearest=[...nodes].sort((a,b)=>distance(a.position,dead)-distance(b.position,dead))[0]?.id;
 return shuffled(nodes,seed).find(n=>n.id!==oldNode&&n.id!==nearest&&distance(n.position,dead)>=100&&live.every(p=>distance(n.position,p)>=90)&&Math.hypot(n.position.x-field.x,n.position.z-field.z)<field.radius-30&&terrain.clear(n.position.x,n.position.z,.8,n.position.y));
}
