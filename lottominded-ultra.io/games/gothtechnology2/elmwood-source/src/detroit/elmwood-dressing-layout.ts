import type {ElmwoodTerrain} from './elmwood-terrain.ts';
import {inElmwoodPond} from './elmwood-terrain.ts';
import {ELMWOOD_PARKING,inRing,segmentDistance} from './elmwood-details.ts';

const trees=new Set(['white-oak','red-maple','american-elm','white-pine','weeping-willow','black-walnut','tour-beech','tour-birch','tour-spruce','tour-cedar','tour-flowering','tour-higan-cherry']);
type Dressing={asset:string;position:number[];rotation:number;scale:number;layer:string;confidence?:string};

/** Keep the complete trunk footprint in lawn, clear of paved lanes, curbs and parking. */
export function elmwoodGrassTreeSite(terrain:ElmwoodTerrain,boundary:number[][],x:number,north:number,radius=1.1){
 const buildings=terrain.features.filter(f=>f.kind==='building');
 for(let i=0;i<9;i++){
  const r=i===8?0:radius,px=x+Math.cos(i*Math.PI/4)*r,pn=north+Math.sin(i*Math.PI/4)*r;
  if(!inRing(px,pn,boundary)||inRing(px,pn,ELMWOOD_PARKING)||inElmwoodPond(px,pn,terrain.features)||buildings.some(f=>inRing(px,pn,f.points)))return false;
 }
 for(const s of terrain.segments){const half=s.feature.tags.bridge==='yes'&&s.feature.tags.highway==='footway'?1.5:2.3;if(segmentDistance(x,north,s.a,s.b)<half+radius)return false;}
 for(const f of terrain.features){
  if(f.kind==='building'&&f.points.slice(1).some((b,i)=>segmentDistance(x,north,f.points[i],b)<radius+.4))return false;
  if(f.tags.waterway==='stream'&&!f.tags.tunnel&&f.points.slice(1).some((b,i)=>segmentDistance(x,north,f.points[i],b)<radius+1.5))return false;
 }
 return true;
}

/** Elmwood's Blender bench has its back at -Z and its open seating side at +Z. */
export function elmwoodBenchHeading(terrain:ElmwoodTerrain,x:number,north:number){const road=terrain.nearest(x,north);return Math.atan2(road.x-x,north-road.north);}

export function layoutElmwoodDressing<P extends Dressing>(terrain:ElmwoodTerrain,boundary:number[][],placements:P[]):P[]{
 return placements.flatMap(p=>{
  const [x,north]=p.position;
  if(p.asset==='elmwood-park-bench')return [{...p,rotation:elmwoodBenchHeading(terrain,x,north)}];
  // The complete grass clump stays in lawn, including its scaled footprint.
  if(p.asset==='grass-tuft'&&!elmwoodGrassTreeSite(terrain,boundary,x,north,.8*p.scale+.12)){
   for(let r=.5;r<=5;r+=.5)for(let i=0;i<24;i++){const a=i*Math.PI/12,px=x+Math.cos(a)*r,pn=north+Math.sin(a)*r;if(elmwoodGrassTreeSite(terrain,boundary,px,pn,.8*p.scale+.12))return [{...p,position:[px,pn,terrain.surfaceGround(px,pn)]}];}
   return [];
  }
  if(!trees.has(p.asset))return [p];
  const radius=Math.max(1.1,.65*p.scale+.4);
  if(elmwoodGrassTreeSite(terrain,boundary,x,north,radius))return [p];
  // Move an obstructing ornamental trunk to the nearest lawn; retain its species and size.
  for(let r=2;r<=30;r+=2)for(let i=0;i<24;i++){
   const a=i*Math.PI/12,px=x+Math.cos(a)*r,pn=north+Math.sin(a)*r;
   if(!elmwoodGrassTreeSite(terrain,boundary,px,pn,radius))continue;
   if(placements.some(other=>other!==p&&trees.has(other.asset)&&Math.hypot(px-other.position[0],pn-other.position[1])<radius+.65*other.scale))continue;
   return [{...p,position:[px,pn,terrain.surfaceGround(px,pn)],confidence:(p.confidence??'Estimated landscape placement')+'; trunk moved to adjacent lawn to keep paved routes clear.'}];
  }
  return []; // A decorative tree must never block a paved entrance when no lawn fits.
 });
}
