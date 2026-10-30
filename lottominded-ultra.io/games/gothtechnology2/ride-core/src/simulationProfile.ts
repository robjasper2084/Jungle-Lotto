export type SimulationProfileKey='movement'|'botInput'|'route'|'routeWork'|'routeSearch'|'groundTravelClear'|'obstacleRecovery';
type Cost={calls:number;totalMs:number;maxMs:number};
let enabled=false;
let costs:Partial<Record<SimulationProfileKey,Cost>>={};
/** Opt-in diagnostics only. These counters never enter authoritative state. */
export function setSimulationProfiling(value:boolean){enabled=value;costs={};}
export function beginSimulationProfile(){return enabled?performance.now():-1;}
export function endSimulationProfile(key:SimulationProfileKey,start:number){
 if(start<0)return;
 const elapsed=performance.now()-start,cost=costs[key]??={calls:0,totalMs:0,maxMs:0};
 cost.calls++;cost.totalMs+=elapsed;cost.maxMs=Math.max(cost.maxMs,elapsed);
}
/** Nested timings overlap; do not add route and groundTravelClear together. */
export function takeSimulationProfile(){const result=costs;costs={};return result;}
