import type {ElmwoodTerrain} from './elmwood-terrain.ts';
import {inElmwoodPond} from './elmwood-terrain.ts';
import {ELMWOOD_PARKING,inRing,segmentDistance} from './elmwood-details.ts';
import {elmwoodGrassTreeSite} from './elmwood-dressing-layout.ts';

const shadeTrees=new Set(['white-oak','red-maple','american-elm','white-pine','weeping-willow','black-walnut','tour-beech','tour-birch','tour-spruce','tour-cedar','tour-flowering','tour-higan-cherry']);
export type CherrySite={id:string;x:number;north:number;y:number;scale:number;creek:boolean;area:'entrance'|'valley'|'creek'|'garden'};

/** Larger ornamental cherries in open lawns; clearance includes their crowns. */
export function elmwoodCherrySites(terrain:ElmwoodTerrain,boundary:number[][]){
 const creeks=terrain.features.filter(f=>f.tags.waterway==='stream'&&!f.tags.tunnel);
 const water=creeks.flatMap(f=>f.points.slice(1).map((b,i)=>[f.points[i],b]));
 const buildings=terrain.features.filter(f=>f.kind==='building');
 const sites:CherrySite[]=[];
 const clear=(x:number,n:number,scale:number)=>{
  const crown=2.2*scale;
  if(terrain.nearest(x,n).distance<crown+3.5||!elmwoodGrassTreeSite(terrain,boundary,x,n,crown)||sites.some(p=>Math.hypot(p.x-x,p.north-n)<Math.max(20,crown+2.2*p.scale+10)))return false;
  if(water.some(([a,b])=>segmentDistance(x,n,a,b)<crown+2))return false;
  const heights:number[]=[];
  for(let i=0;i<9;i++){
   const r=i===8?0:crown,px=x+Math.cos(i*Math.PI/4)*r,pn=n+Math.sin(i*Math.PI/4)*r;
   if(!inRing(px,pn,boundary)||inRing(px,pn,ELMWOOD_PARKING)||inElmwoodPond(px,pn,terrain.features)||buildings.some(f=>inRing(px,pn,f.points)))return false;
   heights.push(terrain.surfaceGround(px,pn));
  }
  if(Math.max(...heights)-Math.min(...heights)>1.6)return false;
  return !terrain.placements.some(p=>{
   if(['grass-tuft','fallen-leaf-patch'].includes(p.asset))return false;
   const radius=shadeTrees.has(p.asset)?crown+3.5*p.scale+1.25:p.footprint?Math.hypot(p.footprint[0]/2,p.footprint[1]/2)+crown+1:p.layer==='mapped'?5.2+crown:crown+1;
   return Math.hypot(x-p.position[0],n-p.position[1])<radius;
  });
 };
 const add=(id:string,x:number,north:number,scale:number,area:CherrySite['area'],creek=false)=>{
  if(!clear(x,north,scale))return false;
  sites.push({id,x,north,y:terrain.surfaceGround(x,north),scale,area,creek});return true;
 };
 const clearing=(id:string,x:number,north:number,scale:number,area:CherrySite['area'],creek=false,rightOf?:number)=>{
  // Prefer the authored clearing, then find nearby open ground without moving
  // a requested right-side tree back into the old crowded patch.
  for(let r=0;r<=30;r+=3)for(let i=0;i<(r?24:1);i++){
   const a=i*Math.PI/12,px=x+Math.cos(a)*r,pn=north+Math.sin(a)*r;
   if(rightOf!==undefined&&px<rightOf)continue;
   if(add(id,px,pn,scale,area,creek))return;
  }
 };
 // Move the southern valley blossom east into its own open lawn. Its previous
 // creek site (1,128) was crowded beneath a black walnut. Keep the larger crown.
 clearing('valley-right',22,146,1.8,'valley',false,13);
 for(const [i,[x,n]]of [[30,47],[-6,80],[52,111]].entries())clearing('entrance-'+i,x,n,1.45+i*.1,'entrance');
 for(const [i,[x,n]]of [[-38,173],[-74,220],[-127,298],[-193,374]].entries())clearing('valley-'+i,x,n,1.45+i%2*.15,'valley');
 const candidates:{x:number;north:number}[]=[];
 for(const f of creeks)for(let j=1;j<f.points.length;j++){
  const a=f.points[j-1],b=f.points[j],dx=b[0]-a[0],dn=b[1]-a[1],length=Math.hypot(dx,dn);if(length<.01)continue;
  for(let d=0;d<length;d+=8)for(const side of [-1,1])for(const offset of [9,13,17]){
   const t=d/length,x=a[0]+dx*t-dn/length*side*offset,n=a[1]+dn*t+dx/length*side*offset;
   if(clear(x,n,1.4))candidates.push({x,north:n});
  }
 }
 // Visit evenly distributed candidates first rather than cluster at one end.
 let added=0;
 for(let i=0;i<12&&added<12;i++){
  const start=Math.floor(i*candidates.length/12),scale=1.4+i%3*.1;
  for(let j=start;j<Math.min(candidates.length,start+Math.ceil(candidates.length/12));j++){
   const p=candidates[j];if(add('creek-'+i,p.x,p.north,scale,'creek',true)){added++;break;}
  }
 }
 // Small groups in selected outer lawns, rather than blanket random planting.
 for(const [i,[x,n]]of [[70,195],[90,280],[-37,342],[-139,444],[-230,496],[-304,548]].entries()){
  if(sites.length>=24)break;clearing('garden-'+i,x,n,1.35+i%3*.1,'garden');
 }
 return sites;
}
