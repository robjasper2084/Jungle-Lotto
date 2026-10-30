import data from './street-furniture-layout.json' with {type:'json'};
import {streetFurnitureSites,type StreetSite} from './streetFurnitureLayout.ts';
import {chunkCoverage} from './chunkCoverage.ts';
/** Different map coverage still runs the exact clearance search. The default
 * Detroit district uses the validated build-time result, shared with Royale. */
export function streetFurnitureForChunks(chunks:readonly {x:number;z:number}[]){
 const coverage=chunks.map(c=>c.x+','+c.z).sort().join(';');
 return coverage===data.coverage?data.sites as StreetSite[]:streetFurnitureSites(chunkCoverage(chunks));
}
