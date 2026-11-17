import source from './showcaseStops.json' with {type:'json'};
import type {Landmark,ParkMap} from './terrain.ts';

/** The three authored stops resolve against actual map IDs. Never create
 * synthetic coordinates, alter travel physics or silently substitute a POI. */
export type ShowcaseStop=typeof source.stops[number] & {destination:Landmark};
export const SHOWCASE_ROUTE_ID=source.id;
export function resolveShowcaseStops(map:Pick<ParkMap,'landmarks'|'pois'>):ShowcaseStop[]{
 const known=[...map.landmarks,...map.pois] as Landmark[];
 const used=new Set<string>();
 return source.stops.map(stop=>{
  if(used.has(stop.destinationId))throw Error('Duplicate showcase destination: '+stop.destinationId);
  used.add(stop.destinationId);
  const destination=known.find(item=>item.id===stop.destinationId);
  if(!destination||destination.name!==stop.destinationName||
    !Number.isFinite(destination.x)||!Number.isFinite(destination.z))
    throw Error('Missing or renamed Belle Isle showcase destination: '+stop.destinationName);
  return {...stop,destination};
 });
}
