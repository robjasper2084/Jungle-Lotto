import zones from './environmentZones.json' with {type:'json'};
import type {Landmark,ParkMap} from './terrain.ts';

export const ENVIRONMENT_ZONE_ID=zones.id;
export const ENVIRONMENT_ZONE_NAMES=zones.zones.map(zone=>zone.name);
export type EnvironmentZone=typeof zones.zones[number] & {stops:Array<(typeof zones.zones)[number]['stops'][number] & {destination:Landmark}>};
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
   if(!destination||destination.name!==stop.destinationName||
       !Number.isFinite(destination.x)||!Number.isFinite(destination.z))throw Error('Unmapped environment zone stop: '+stop.destinationName);
   return {...stop,destination};
  })
 }));
}
