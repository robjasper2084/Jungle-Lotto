import {riverEdge} from './geography.ts';
import {inWaterfrontPond,polygonContains} from './waterfrontSite.ts';
import {inValadeInlet} from './valadeSite.ts';
import harbor from './harbor-data.json' with {type:'json'};
const basin=harbor.ways.find(w=>w.tags.leisure==='marina')!.points;
/** Furniture footprints must fit on land, including mapped inland water. */
export function dryStreetSite(x:number,z:number,margin=.35){
 return [[0,0],[margin,0],[-margin,0],[0,margin],[0,-margin]].every(([dx,dz])=>{
  const px=x+dx,pz=z+dz;return px>riverEdge(pz)+1&&!inWaterfrontPond(px,pz)&&!inValadeInlet(px,pz)&&!polygonContains(basin,px,pz);
 });
}
