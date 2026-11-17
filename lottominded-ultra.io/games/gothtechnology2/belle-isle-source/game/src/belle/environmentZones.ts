import zones from './environmentZones.json' with {type:'json'};
import type {Landmark,ParkMap} from './terrain.ts';

export const ENVIRONMENT_ZONE_ID=zones.id;
export const ENVIRONMENT_ZONE_NAMES=zones.zones.map(zone=>zone.name);
export type EnvironmentZone=Omit<(typeof zones.zones)[number],'stops'> & {stops:Array<(typeof zones.zones)[number]['stops'][number] & {destination:Landmark}>};
/** Only uses existing map places; no synthetic coordinates, races, path or physics edits. */
export function resolveEnvironmentZones(map:Pick<ParkMap,'landmarks'|'pois'>):EnvironmentZone[]{
 const destinations=[...map.landmarks,...map.pois] as Landmark[];
 const seen=new Set<string>();
 return zones.zones.map(zone=>({
  ...zone,
  stops:zone.stops.map(stop=>{
   if(seen.has(stop.destinationId))throw Error('Duplicate environment zone destination '+stop.destinationId);
   seen.add(stop.destinationId);
   const destination=destinations.find(entry=>entry.id===stop.destinationId);
   // The mapped Coast Guard landmark is renamed by prepareCoastGuardMap()
   // before the Island Guide is built. Accept only explicitly documented
   // source/runtime names, never an arbitrary substitute or invented position.
   const sourceName='sourceName' in stop?stop.sourceName:undefined;
   const names=[stop.destinationName,sourceName];
   if(!destination||!names.includes(destination.name)||
       !Number.isFinite(destination.x)||!Number.isFinite(destination.z))throw Error('Unmapped environment zone stop: '+stop.destinationName);
   return {...stop,destination};
  })
 }));
}
