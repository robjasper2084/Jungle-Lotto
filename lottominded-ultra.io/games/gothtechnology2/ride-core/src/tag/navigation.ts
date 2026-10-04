import {lanePoint,type TagFixture} from './fixture.ts';
import type {Vec3,TerrainSampler} from '../terrain.ts';
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.z-b.z);
/** Real paths and open-ground routes; junctions require physical clearance. */
export class TagNavigation{
 readonly nodes:Vec3[]=[];readonly edges=new Map<number,Map<number,number>>();
 constructor(f:TagFixture,private terrain:TerrainSampler & {legal?(p:Vec3):boolean}){
  // Exported against the same canonical terrain/hash. Building thousands of
  // physical route edges is an asset-pipeline job, not a room-launch frame.
  if(f.navigation){this.nodes.push(...f.navigation.nodes.map(p=>({...p})));for(const [i,j,w]of f.navigation.edges){const e=this.edges.get(i)??new Map();e.set(j,w);this.edges.set(i,e);}return;}
  const buckets=new Map<string,number[]>(),key=(p:Vec3)=>Math.floor(p.x/32)+','+Math.floor(p.z/32);
  const nearby=(p:Vec3,r=1)=>{const out:number[]=[],x=Math.floor(p.x/32),z=Math.floor(p.z/32);for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++)out.push(...buckets.get((x+i)+','+(z+j))??[]);return out;};
  const node=(p:Vec3)=>{const i=nearby(p).find(i=>distance(p,this.nodes[i])<.6);if(i!==undefined)return i;const n=this.nodes.length;this.nodes.push({...p});const b=buckets.get(key(p))??[];b.push(n);buckets.set(key(p),b);return n;};
  const clear=(a:Vec3,b:Vec3)=>this.clearPath(a,b);
  const link=(a:number,b:number)=>{if(a===b||!clear(this.nodes[a],this.nodes[b]))return;for(const [i,j]of [[a,b],[b,a]]){const e=this.edges.get(i)??new Map();e.set(j,distance(this.nodes[i],this.nodes[j]));this.edges.set(i,e);}};
  const lanes=f.lanes.map(l=>({...l,start:node(l.a),end:node(l.b)}));for(const l of lanes)link(l.start,l.end);
  // OSM lane intersections may occur in the middle of a polyline edge.
  const laneBuckets=new Map<string,typeof lanes>();
  for(const l of lanes)for(let x=Math.floor((Math.min(l.a.x,l.b.x)-2)/32);x<=Math.floor((Math.max(l.a.x,l.b.x)+2)/32);x++)for(let z=Math.floor((Math.min(l.a.z,l.b.z)-2)/32);z<=Math.floor((Math.max(l.a.z,l.b.z)+2)/32);z++){const k=x+','+z,b=laneBuckets.get(k)??[];b.push(l);laneBuckets.set(k,b);}
  for(let i=0;i<this.nodes.length;i++)for(const l of laneBuckets.get(key(this.nodes[i]))??[]){const q=lanePoint(this.nodes[i],l);if(distance(q,this.nodes[i])>Math.min(1.8,l.width*.45)||Math.abs(q.y-this.nodes[i].y)>1)continue;const j=node(q);link(i,j);link(l.start,j);link(j,l.end);}
  const roaming=(f.roam??[]).map(node);
  for(const i of roaming){const p=this.nodes[i],candidates=nearby(p,2).filter(j=>j!==i&&distance(p,this.nodes[j])<=35).sort((a,b)=>distance(p,this.nodes[a])-distance(p,this.nodes[b]));
    for(const j of candidates.slice(0,16))link(i,j);}
 }
 clearPath(a:Vec3,b:Vec3){const d={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},l=distance(a,b);if(this.terrain.raycastObstacle({...a,y:a.y+.8},d,l,.25)!==null)return false;const steps=Math.max(1,Math.ceil(l/.5));for(let i=0;i<=steps;i++){const t=i/steps;if(this.terrain.legal?.({x:a.x+d.x*t,y:a.y+d.y*t,z:a.z+d.z*t})===false)return false;}return true;}
 nearest(p:Vec3){let best=0,d=Infinity;
  // Map polylines can end outside safe ground. Export keeps their display
  // coordinates, but these rejected, isolated endpoints are not drive targets.
  for(const [i,edges]of this.edges){if(!edges.size)continue;const n=distance(p,this.nodes[i]);if(n<d){best=i;d=n;}}return best;}
 path(from:Vec3,to:Vec3){const start=this.nearest(from),end=this.nearest(to),cost=new Map([[start,0]]),prev=new Map<number,number>(),heap:{id:number;cost:number}[]=[];
  const push=(id:number,cost:number)=>{let i=heap.length;heap.push({id,cost});while(i){const p=(i-1)>>1;if(heap[p].cost<=cost)break;heap[i]=heap[p];i=p;}heap[i]={id,cost};};
  const pop=()=>{const first=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1].cost<heap[j].cost)j++;if(heap[j].cost>=last.cost)break;heap[i]=heap[j];i=j;}heap[i]=last;}return first;};push(start,0);
  while(heap.length){const {id:best,cost:c}=pop();if(c!==(cost.get(best)??Infinity))continue;if(best===end)break;for(const [next,w]of this.edges.get(best)??[]){if(c+w<(cost.get(next)??Infinity)){cost.set(next,c+w);prev.set(next,best);push(next,c+w);}}}
  if(!cost.has(end))return [this.nodes[start]];const result=[end];while(result[0]!==start)result.unshift(prev.get(result[0])!);const route=result.map(i=>({...this.nodes[i]}));if(route.length>1){const first=lanePoint(from,{a:route[0],b:route[1],width:0});if(distance(first,from)<3)route[0]=first;}return route;
 }
 reachable(p:Vec3){const seen=new Set([this.nearest(p)]),queue=[...seen];while(queue.length){for(const n of this.edges.get(queue.shift()!)?.keys()??[]){if(!seen.has(n)){seen.add(n);queue.push(n);}}}return [...seen].map(i=>this.nodes[i]);}
}
