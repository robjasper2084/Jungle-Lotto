import {CITY,nearestCut} from './geography.ts';
type Point={x:number;z:number};
type Node=Point&{edges:{to:number;length:number}[];distance:number;next:number};
const nodes:Node[]=[],ids=new Map<string,number>(),segments:{a:number;b:number}[]=[];
const goals=new Set<number>();
function node(p:number[]){const key=p[0].toFixed(2)+','+p[1].toFixed(2);let id=ids.get(key);if(id===undefined){id=nodes.length;ids.set(key,id);nodes.push({x:p[0],z:p[1],edges:[],distance:Infinity,next:-1});}return id;}
for(const r of CITY.roads){
 if(['motorway','motorway_link','trunk','trunk_link','steps'].includes(r.kind))continue;
 const list=r.points.map(node);
 if(r.name==='Dequindre Cut Greenway')list.forEach(i=>goals.add(i));
 for(let i=1;i<list.length;i++){const a=list[i-1],b=list[i],length=Math.hypot(nodes[a].x-nodes[b].x,nodes[a].z-nodes[b].z);if(length<.01)continue;nodes[a].edges.push({to:b,length});nodes[b].edges.push({to:a,length});segments.push({a,b});}
}
// One reverse shortest-path solve at load; riding only projects onto nearby
// connected edges. Connections are mapped shared vertices, never overpass chords.
const heap:{id:number;distance:number}[]=[];
function push(id:number,distance:number){const v={id,distance};let i=heap.length;heap.push(v);while(i){const p=(i-1)>>1;if(heap[p].distance<=distance)break;heap[i]=heap[p];i=p;}heap[i]=v;}
function pop(){const out=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1].distance<heap[j].distance)j++;if(heap[j].distance>=last.distance)break;heap[i]=heap[j];i=j;}heap[i]=last;}return out;}
for(const i of goals){nodes[i].distance=0;push(i,0);}
while(heap.length){const v=pop(),n=nodes[v.id];if(v.distance!==n.distance)continue;for(const e of n.edges){const d=n.distance+e.length;if(d<nodes[e.to].distance){nodes[e.to].distance=d;nodes[e.to].next=v.id;push(e.to,d);}}}
export function routeToCut(x:number,z:number){
 const cut=nearestCut(x,z);
 if(cut.d>=0&&cut.distance<4)return{path:[] as Point[],approach:[] as Point[],distance:0,arrived:true};
 let best=Infinity,start=-1,snap={x,z},remaining=0;
 for(const s of segments){const a=nodes[s.a],b=nodes[s.b];if(!Number.isFinite(a.distance))continue;const dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/l2)),p={x:a.x+dx*t,z:a.z+dz*t},gap=Math.hypot(x-p.x,z-p.z);if(gap>best)continue;const length=Math.sqrt(l2),viaA=length*t+a.distance,viaB=length*(1-t)+b.distance;
  if(gap<best-.01||Math.abs(gap-best)<.01&&Math.min(viaA,viaB)<remaining){best=gap;start=viaA<viaB?s.a:s.b;snap=p;remaining=Math.min(viaA,viaB);}
 }
 if(start<0||best>100)return{path:[] as Point[],approach:[] as Point[],distance:Infinity,arrived:false};
 const path:Point[]=[snap];for(let i=start,limit=0;i>=0&&limit++<nodes.length;i=nodes[i].next){path.push({x:nodes[i].x,z:nodes[i].z});if(goals.has(i))break;}
 return{path,approach:best>1?[{x,z},snap]:[],distance:remaining+best,arrived:false};
}
