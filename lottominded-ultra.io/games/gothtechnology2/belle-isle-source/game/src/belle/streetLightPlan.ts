import {ParkTerrain,inside,type ParkMap} from './terrain.ts';
import {pathSamples,roadIndex} from './streetPlan.ts';
export type StreetLamp={x:number;y:number;z:number;dx:number;dz:number;height:number;kind:'road'|'path';road:string};
/** Road-derived placement, not a survey of existing city-owned luminaires. */
export function planStreetLights(map:ParkMap){
 const terrain=new ParkTerrain(map),occupied=roadIndex(map.roads),lamps:StreetLamp[]=[];
 const visitor=(x:number,z:number)=>map.landmarks.some(l=>Math.hypot(l.x-x,l.z-z)<85);
 const clear=(x:number,z:number)=>terrain.land(x,z)&&!terrain.bridge(x,z).active&&!occupied(x,z,'',.55)&&!terrain.obstructed(x,z,.65)&&!map.buildings.some(b=>inside(x,z,b.points));
 const roads=map.roads.filter(r=>!r.bridge&&r.highway!=='corridor'&&r.highway!=='steps'&&(!r.foot||r.surface==='concrete'||r.surface==='asphalt'));
 // Main roads get priority over adjoining footpaths when placements overlap.
 roads.sort((a,b)=>Number(a.foot)-Number(b.foot)||b.width-a.width||a.id.localeCompare(b.id));
 for(const r of roads){
  if(!r.foot&&r.width<6)continue;
  const spacing=r.foot?28:42;
  for(const [i,p]of pathSamples(r.points,spacing).entries()){
   if(r.foot&&!visitor(p.x,p.z))continue;
   const sides=r.width>=12?[-1,1]:[i%2?1:-1];
   for(const side of sides){
    const offset=r.width/2+(r.foot?.85:1.35),x=p.x+p.dz*offset*side,z=p.z-p.dx*offset*side;
    if(!clear(x,z)||lamps.some(l=>Math.hypot(l.x-x,l.z-z)<(r.foot?20:26)))continue;
    lamps.push({x,y:terrain.height(x,z),z,dx:-p.dz*side,dz:p.dx*side,height:r.foot?3.8:7.8,kind:r.foot?'path':'road',road:r.id});
   }
  }
 }
 return lamps;
}
