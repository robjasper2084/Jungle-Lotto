import type {TerrainSampler,Vec3} from '../terrain.ts';
import {beginSimulationProfile,endSimulationProfile} from '../simulationProfile.ts';
type GroundTerrain=TerrainSampler&{ground(x:number,z:number,referenceY?:number):{height:number;offCourse?:boolean}};
const gap=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.z-b.z);

/** A sight ray above a bank is not a driveable path. Follow its actual floor,
 * reject steps/unsupported ground, and sweep the rider's full body along it. */
export function groundTravelClear(terrain:GroundTerrain,from:Vec3,to:Vec3,radius=.32){
 const profile=beginSimulationProfile();try{
 const length=gap(from,to),steps=Math.max(1,Math.ceil(length/.7));
 let previous={...from},bodyStart={...from};
 for(let i=0;i<=steps;i++){
  const t=i/steps,x=from.x+(to.x-from.x)*t,z=from.z+(to.z-from.z)*t;
  const g=terrain.ground(x,z,previous.y),p={x,y:g.height,z};
  if(g.offCourse||Math.abs(p.y-previous.y)>.46)return false;
  if(i===steps&&Math.abs(p.y-to.y)>.55)return false;
  if(i>0&&(i%3===0||i===steps)){
   const d={x:p.x-bodyStart.x,y:p.y-bodyStart.y,z:p.z-bodyStart.z},distance=Math.hypot(d.x,d.y,d.z);
   if(distance>1e-5)for(const h of [.65,1.15,1.65])
    if(terrain.raycastObstacle({...bodyStart,y:bodyStart.y+h},d,distance,radius)!==null)return false;
   bodyStart=p;
  }
  previous=p;
 }
 return true;
 }finally{endSimulationProfile('groundTravelClear',profile);}
}

/** Validate only route edges that are actually used, then cache their verdict.
 * Exported roads remain the graph; this avoids inventing shortcuts over banks
 * and avoids a full city collision scan during room launch. */
export class GroundRoutes{
 private edgeClear=new Map<string,boolean>();
 private routes=new Map<string,readonly number[]>();
 private buckets=new Map<string,number[]>();
 constructor(private nodes:readonly Vec3[],private edges:Map<number,Map<number,number>>,private terrain:GroundTerrain){
  nodes.forEach((p,i)=>{if(!edges.get(i)?.size)return;const key=Math.floor(p.x/32)+','+Math.floor(p.z/32),b=this.buckets.get(key)??[];b.push(i);this.buckets.set(key,b);});
 }
 private nearby(p:Vec3){const x=Math.floor(p.x/32),z=Math.floor(p.z/32),ids:number[]=[];
  for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++)ids.push(...this.buckets.get((x+a)+','+(z+b))??[]);
  return ids.sort((a,b)=>gap(p,this.nodes[a])-gap(p,this.nodes[b])||a-b).slice(0,32);
 }
 private edgeKey(a:number,b:number){return Math.min(a,b)+':'+Math.max(a,b);}
 private remember(key:string,route:readonly number[]){this.routes.set(key,route);if(this.routes.size>256)this.routes.delete(this.routes.keys().next().value!);}
 private search(start:number,end:number){
  const profile=beginSimulationProfile();try{
  const cost=new Map([[start,0]]),prev=new Map<number,number>(),heap:{id:number;score:number;cost:number}[]=[];
  const push=(id:number,c:number)=>{const item={id,cost:c,score:c+gap(this.nodes[id],this.nodes[end])};let i=heap.length;heap.push(item);while(i){const p=(i-1)>>1;if(heap[p].score<=item.score)break;heap[i]=heap[p];i=p;}heap[i]=item;};
  const pop=()=>{const first=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1].score<heap[j].score)j++;if(heap[j].score>=last.score)break;heap[i]=heap[j];i=j;}heap[i]=last;}return first;};
  push(start,0);
  while(heap.length){const {id,cost:c}=pop();if(c!==cost.get(id))continue;if(id===end){const route=[end];while(route[0]!==start)route.unshift(prev.get(route[0])!);return route;}
   for(const [next,w]of this.edges.get(id)??[]){if(this.edgeClear.get(this.edgeKey(id,next))===false)continue;const n=c+w;if(n<(cost.get(next)??Infinity)){cost.set(next,n);prev.set(next,id);push(next,n);}}
  }return [];
  }finally{endSimulationProfile('routeSearch',profile);}
 }
 path(from:Vec3,to:Vec3){
  const profile=beginSimulationProfile();try{
  const start=this.nearby(from).find(i=>groundTravelClear(this.terrain,from,this.nodes[i]));
  const destinations=this.nearby(to),end=destinations.find(i=>groundTravelClear(this.terrain,this.nodes[i],to))??destinations[0];
  if(start===undefined||end===undefined)return [];
  const key=start+':'+end;let route=this.routes.get(key);
  if(!route){
   while(!route){
    const candidate=this.search(start,end);if(!candidate.length){this.remember(key,[]);return [];}
    let blocked=false;
    for(let j=1;j<candidate.length;j++){
     const a=candidate[j-1],b=candidate[j],key=this.edgeKey(a,b);
     if(!this.edgeClear.has(key))this.edgeClear.set(key,groundTravelClear(this.terrain,this.nodes[a],this.nodes[b])&&groundTravelClear(this.terrain,this.nodes[b],this.nodes[a]));
     if(!this.edgeClear.get(key))blocked=true;
    }
    if(!blocked){route=candidate;this.remember(key,route);break;}
   }
  }
  if(!route.length)return [];
  const points=route.map(i=>({...this.nodes[i]}));
  if(gap(points.at(-1)!,to)>.8&&groundTravelClear(this.terrain,points.at(-1)!,to))points.push({x:to.x,y:to.y,z:to.z});
  return points;
  }finally{endSimulationProfile('route',profile);}
 }
}
