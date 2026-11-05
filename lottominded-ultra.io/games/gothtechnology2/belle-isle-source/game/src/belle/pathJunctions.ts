import {ParkTerrain,type ParkMap} from './terrain.ts';
import {roadIndex} from './streetPlan.ts';
// Shared OSM nodes can have separately capped ribbons. A small underlay fills
// the triangular grass slit between their caps without changing any route.
export function pathJunctions(map:ParkMap){
 const nodes=new Map<string,{x:number;z:number;roads:Map<string,ParkMap['roads'][number]>}>();
 const terrain=new ParkTerrain(map),carriageway=roadIndex(map.roads.filter(r=>!r.foot));
 for(const r of map.roads.filter(r=>r.foot&&!r.bridge))for(const p of r.points){
  const key=p[0].toFixed(2)+','+p[1].toFixed(2);if(!nodes.has(key))nodes.set(key,{x:p[0],z:p[1],roads:new Map()});nodes.get(key)!.roads.set(r.id,r);
 }
 return [...nodes.values()].filter(n=>n.roads.size>1&&!carriageway(n.x,n.z,'',.25)&&terrain.land(n.x,n.z)&&!terrain.bridge(n.x,n.z).active).map(n=>{
  const roads=[...n.roads.values()].sort((a,b)=>b.width-a.width);return{x:n.x,z:n.z,radius:Math.min(4,roads[0].width/2),road:roads[0]};
 });
}
