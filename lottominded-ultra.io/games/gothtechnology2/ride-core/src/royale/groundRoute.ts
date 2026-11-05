import type {TerrainSampler,Vec3} from '../terrain.ts';
import {beginSimulationProfile,endSimulationProfile} from '../simulationProfile.ts';
type GroundTerrain=TerrainSampler&{ground(x:number,z:number,referenceY?:number):{height:number;offCourse?:boolean}};
const gap=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.z-b.z);

/** A sight ray above a bank is not a driveable path. Follow its actual floor,
 * reject steps/unsupported ground, and sweep the rider's full body along it. */
function* groundTravelSteps(terrain:GroundTerrain,from:Vec3,to:Vec3,radius=.32):Generator<void,boolean>{
 const length=gap(from,to),steps=Math.max(1,Math.ceil(length/.7));
 let previous={...from},bodyStart={...from};
 for(let i=0;i<=steps;i++){
  const t=i/steps,x=from.x+(to.x-from.x)*t,z=from.z+(to.z-from.z)*t;
  yield;
  const g=terrain.ground(x,z,previous.y),p={x,y:g.height,z};
  if(g.offCourse||Math.abs(p.y-previous.y)>.46)return false;
  if(i===steps&&Math.abs(p.y-to.y)>.55)return false;
  if(i>0&&(i%3===0||i===steps)){
   const d={x:p.x-bodyStart.x,y:p.y-bodyStart.y,z:p.z-bodyStart.z},distance=Math.hypot(d.x,d.y,d.z);
   if(distance>1e-5)for(const h of [.65,1.15,1.65]){
    yield;
    if(terrain.raycastObstacle({...bodyStart,y:bodyStart.y+h},d,distance,radius)!==null)return false;
   }
   bodyStart=p;
  }
  previous=p;
 }
 return true;
}

function drain<T>(work:Generator<void,T>):T{let next=work.next();while(!next.done)next=work.next();return next.value;}
export function groundTravelClear(terrain:GroundTerrain,from:Vec3,to:Vec3,radius=.32){
 const start=beginSimulationProfile();try{return drain(groundTravelSteps(terrain,from,to,radius));}finally{endSimulationProfile('groundTravelClear',start);}
}

type RouteCache={edges:[string,boolean][];routes:[string,readonly number[]][]};
export type RoutePlannerState={cache:RouteCache;queue:string[];jobs:{key:string;from:Vec3;to:Vec3;steps:number;initial:RouteCache;result?:Vec3[]}[]};
export interface RoutePlanner{
 capture():RoutePlannerState;
 restore(state:RoutePlannerState):void;
 request(key:string,from:Vec3,to:Vec3):Vec3[]|undefined;
 advance(budget?:number):number;
 clear():void;
 cancel(key:string):void;
 readonly pending:number;
}
/** Each match owns its queue. A yield precedes each terrain query or graph edge;
 * even a long obstructed edge cannot monopolize a simulation tick. */
class RouteQueue implements RoutePlanner{
 private jobs=new Map<string,{from:Vec3;to:Vec3;work:Generator<void,Vec3[]>;worker:GroundRoutes;steps:number;initial:RouteCache;result?:Vec3[]}>();
 private queue:string[]=[];
 constructor(private routes:GroundRoutes){}
 capture():RoutePlannerState{return structuredClone({cache:this.routes.capture(),queue:this.queue,jobs:[...this.jobs].map(([key,j])=>({key,from:j.from,to:j.to,steps:j.steps,initial:j.initial,result:j.result}))});}
 restore(state:RoutePlannerState){
  this.clear();this.routes.restore(state.cache);
  for(const saved of state.jobs){const worker=this.routes.fork();worker.restore(saved.initial);const work=worker.steps(saved.from,saved.to);
   // Explicit host restoration only; normal ticks never drain a whole route.
   // Every job uses its own starting cache, independent of interleaved jobs.
   if(saved.result===undefined)for(let i=0;i<saved.steps;i++)work.next();
   this.jobs.set(saved.key,{...structuredClone(saved),worker,work});
  }this.queue=[...state.queue];
 }
 get pending(){return this.queue.length;}
 clear(){this.jobs.clear();this.queue=[];}
 cancel(key:string){this.jobs.delete(key);this.queue=this.queue.filter(k=>k!==key);}
 request(key:string,from:Vec3,to:Vec3){
  let job=this.jobs.get(key);
  // Keep working as targets move. Only a teleport invalidates unfinished work.
  if(job&&(gap(from,job.from)>48||gap(to,job.to)>48||Math.abs(from.y-job.from.y)>3)){
   this.jobs.delete(key);this.queue=this.queue.filter(k=>k!==key);job=undefined;
  }
  if(job?.result!==undefined){this.jobs.delete(key);return job.result;}
  if(!job&&this.jobs.size<64){const a={x:from.x,y:from.y,z:from.z},b={x:to.x,y:to.y,z:to.z};
   const worker=this.routes.fork(),initial=worker.capture();this.jobs.set(key,{from:a,to:b,work:worker.steps(a,b),worker,steps:0,initial});this.queue.push(key);
  }
  return undefined;
 }
 advance(budget=96){
  const start=beginSimulationProfile();let used=0;
  try{while(this.queue.length&&used<budget){
   const key=this.queue.shift()!,job=this.jobs.get(key)!;let next:IteratorResult<void,Vec3[]>;
   // Small fair slices prevent a long route from starving nearby riders/dogs.
   for(let i=0;i<8&&used<budget;i++){used++;job.steps++;next=job.work.next();if(next.done){job.result=next.value;this.routes.merge(job.worker.capture());break;}}
   if(job.result===undefined)this.queue.push(key);
  }return used;}finally{endSimulationProfile('routeWork',start);}
 }
}

/** Validate only route edges that are actually used, then cache their verdict.
 * Exported roads remain the graph; this avoids inventing shortcuts over banks
 * and avoids a full city collision scan during room launch. */
export class GroundRoutes{
 private edgeClear=new Map<string,boolean>();
 private routes=new Map<string,readonly number[]>();
 private buckets=new Map<string,number[]>();
 constructor(private nodes:readonly Vec3[],private edges:Map<number,Map<number,number>>,private terrain:GroundTerrain,buckets?:Map<string,number[]>){
  if(buckets){this.buckets=buckets;return;}
  nodes.forEach((p,i)=>{if(!edges.get(i)?.size)return;const key=Math.floor(p.x/32)+','+Math.floor(p.z/32),b=this.buckets.get(key)??[];b.push(i);this.buckets.set(key,b);});
 }
 private nearby(p:Vec3){const x=Math.floor(p.x/32),z=Math.floor(p.z/32),ids:number[]=[];
  for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++)ids.push(...this.buckets.get((x+a)+','+(z+b))??[]);
  return ids.sort((a,b)=>gap(p,this.nodes[a])-gap(p,this.nodes[b])||a-b).slice(0,32);
 }
 private edgeKey(a:number,b:number){return Math.min(a,b)+':'+Math.max(a,b);}
 private remember(key:string,route:readonly number[]){this.routes.set(key,route);if(this.routes.size>256)this.routes.delete(this.routes.keys().next().value!);}
 private *search(start:number,end:number):Generator<void,number[]>{
  const cost=new Map([[start,0]]),prev=new Map<number,number>(),heap:{id:number;score:number;cost:number}[]=[];
  const push=(id:number,c:number)=>{const item={id,cost:c,score:c+gap(this.nodes[id],this.nodes[end])};let i=heap.length;heap.push(item);while(i){const p=(i-1)>>1;if(heap[p].score<=item.score)break;heap[i]=heap[p];i=p;}heap[i]=item;};
  const pop=()=>{const first=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1].score<heap[j].score)j++;if(heap[j].score>=last.score)break;heap[i]=heap[j];i=j;}heap[i]=last;}return first;};
  push(start,0);
  while(heap.length){yield;const {id,cost:c}=pop();if(c!==cost.get(id))continue;if(id===end){const route=[end];while(route[0]!==start)route.unshift(prev.get(route[0])!);return route;}
   for(const [next,w]of this.edges.get(id)??[]){yield;if(this.edgeClear.get(this.edgeKey(id,next))===false)continue;const n=c+w;if(n<(cost.get(next)??Infinity)){cost.set(next,n);prev.set(next,id);push(next,n);}}
  }return [];
 }
 capture():RouteCache{return {edges:[...this.edgeClear],routes:[...this.routes]};}
 restore(cache:RouteCache){this.edgeClear=new Map(cache.edges);this.routes=new Map(cache.routes);}
 merge(cache:RouteCache){for(const [k,v]of cache.edges)this.edgeClear.set(k,v);for(const [k,v]of cache.routes)this.remember(k,v);}
 fork(){const other=new GroundRoutes(this.nodes,this.edges,this.terrain,this.buckets);other.restore(this.capture());return other;}
 createPlanner():RoutePlanner{return new RouteQueue(this.fork());}
 path(from:Vec3,to:Vec3){const start=beginSimulationProfile();try{return drain(this.steps(from,to));}finally{endSimulationProfile('route',start);}}
 *steps(from:Vec3,to:Vec3):Generator<void,Vec3[]>{
  let start:number|undefined,end:number|undefined;
  for(const i of this.nearby(from))if(yield* groundTravelSteps(this.terrain,from,this.nodes[i])){start=i;break;}
  const destinations=this.nearby(to);
  for(const i of destinations)if(yield* groundTravelSteps(this.terrain,this.nodes[i],to)){end=i;break;}
  end??=destinations[0];
  if(start===undefined||end===undefined)return [];
  const key=start+':'+end;let route=this.routes.get(key);
  while(!route){
   const candidate=yield* this.search(start,end);if(!candidate.length){this.remember(key,[]);return [];}
   let blocked=false;
   for(let j=1;j<candidate.length;j++){
    yield;
    const a=candidate[j-1],b=candidate[j],edge=this.edgeKey(a,b);
    if(!this.edgeClear.has(edge)){
     const clear=(yield* groundTravelSteps(this.terrain,this.nodes[a],this.nodes[b]))&&(yield* groundTravelSteps(this.terrain,this.nodes[b],this.nodes[a]));
     this.edgeClear.set(edge,clear);if(!clear)this.routes.clear();
    }
    if(!this.edgeClear.get(edge)){blocked=true;break;}
   }
   if(!blocked){route=candidate;this.remember(key,route);}
  }
  if(!route.length)return [];
  const points=route.map(i=>({...this.nodes[i]}));
  if(gap(points.at(-1)!,to)>.8&&(yield* groundTravelSteps(this.terrain,points.at(-1)!,to)))points.push({x:to.x,y:to.y,z:to.z});
  return points;
 }
}
