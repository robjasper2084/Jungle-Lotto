import type {Vec3} from '../terrain.ts';
import type {BattleTerrain} from './battleTerrain.ts';
export type SpawnNode={id:string;cluster:string;position:Vec3;headingY:number};
export const SPAWN_SECTORS=[{id:'atwater',x:-72.5,z:-1180},{id:'chene',x:-115,z:-1759},{id:'cut',x:1100,z:-1360},{id:'mack',x:2460,z:-1430}] as const;
/** Source-map metres: authored Aretha canopy footprint (OSM 60624913),
 * expanded 12 m for the initial chase camera. Keep the venue walkable;
 * only match/re-entry placement avoids its roof and support columns. */
export function spawnCameraSpace(p:{x:number;z:number}){return !(p.x>=-263&&p.x<=-165&&p.z>=-1686&&p.z<=-1561);}
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
/** Assign human start bays on the authority, independent of roster order. */
export function matchSpawnNodes(nodes:readonly SpawnNode[],roster:readonly {bot:boolean}[],seed:number,players:readonly SpawnNode[]=[]){
 if(!players.length)return initialSpawnNodes(nodes,roster.length,seed);
 const humanCount=roster.filter(p=>!p.bot).length;
 if(humanCount>players.length)throw Error('Not enough Cut entrance bays');
 const starts=players.slice(0,humanCount),bots=initialSpawnNodes(nodes.filter(n=>starts.every(p=>distance(p.position,n.position)>=12)),roster.length-humanCount,seed);
 let human=0,bot=0;return roster.map(p=>p.bot?bots[bot++]:starts[human++]);
}
/** Extra predetermined recovery sites, spaced over the connected navigation
 * graph. Starting clusters remain unchanged; one enemy cannot block a sector. */
export function configuredRecoveryNodes(nodes:readonly Vec3[],starts:readonly SpawnNode[],center:Vec3,clear:(p:Vec3)=>boolean):SpawnNode[]{
 const out:SpawnNode[]=[];
 for(const p of [...nodes].sort((a,b)=>distance(a,center)-distance(b,center)||a.x-b.x||a.z-b.z)){
  if([...starts,...out].some(n=>distance(n.position,p)<100)||!clear(p))continue;
  out.push({id:'recovery-'+out.length,cluster:'recovery',position:{...p},headingY:Math.atan2(center.x-p.x,center.z-p.z)});
 }
 return out;
}
export function recoveryNodes(terrain:BattleTerrain,nodes:readonly SpawnNode[],dead:Vec3,oldNode:string,live:readonly Vec3[],field:{x:number;z:number;radius:number},seed:number){
 const nearest=[...nodes].sort((a,b)=>distance(a.position,dead)-distance(b.position,dead))[0]?.id;
 return shuffled(nodes,seed).filter(n=>n.id!==oldNode&&n.id!==nearest&&distance(n.position,dead)>=100&&live.every(p=>distance(n.position,p)>=90)&&Math.hypot(n.position.x-field.x,n.position.z-field.z)<field.radius-30&&terrain.clear(n.position.x,n.position.z,.8,n.position.y));
}

export function recoveryNode(...args:Parameters<typeof recoveryNodes>){return recoveryNodes(...args)[0];}
export function spawnLabel(node:SpawnNode){const sector:Record<string,string>={atwater:'Atwater waterfront',chene:'Chene riverfront',cut:'Dequindre Cut',mack:'Mack Avenue',recovery:'Downtown recovery',legacy:'Arena'};return (sector[node.cluster]??node.cluster)+' · Point '+(Number(node.id.split('-').at(-1))+1);}
