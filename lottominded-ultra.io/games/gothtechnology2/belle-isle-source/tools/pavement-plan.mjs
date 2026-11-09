import pc from '../game/node_modules/polygon-clipping/dist/polygon-clipping.esm.js';
import {ENCLOSED_SHELTERS} from '../game/src/belle/referenceSites.ts';
// Reconcile overlapping OSM ways into one surface before triangulation. A plaza
// owns its footpaths; a real carriageway owns crossings. No stacked flat ribbons.
export const surfaceKind=r=>['grass','gravel','fine_gravel','unpaved','dirt','ground','compacted','sand'].includes(r.surface)?'gravel':r.surface==='wood'?'wood':['paving_stones','sett'].includes(r.surface)?'pavers':/concrete/.test(r.surface)?'concrete':'asphalt';
export function corridorPolygons(points,width){
 const clean=points.filter((p,i)=>!i||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>.001);
 if(clean.length<2)return [];
 const closed=clean.length>2&&Math.hypot(clean[0][0]-clean.at(-1)[0],clean[0][1]-clean.at(-1)[1])<.001;
 const sides=clean.map((p,i)=>{const a=clean[i===0&&closed?clean.length-2:Math.max(0,i-1)],b=clean[i===clean.length-1&&closed?1:Math.min(clean.length-1,i+1)],l=Math.hypot(p[0]-a[0],p[1]-a[1]),r=Math.hypot(b[0]-p[0],b[1]-p[1]);let ax=l?(p[1]-a[1])/l:(b[1]-p[1])/r,az=l?-(p[0]-a[0])/l:-(b[0]-p[0])/r,bx=r?(b[1]-p[1])/r:ax,bz=r?-(b[0]-p[0])/r:az;const n=Math.hypot(ax+bx,az+bz),nx=n?(ax+bx)/n:ax,nz=n?(az+bz)/n:az,m=Math.min(1.8,1/Math.max(.01,nx*bx+nz*bz));return [-1,1].map(s=>[p[0]+nx*width*.5*m*s,p[1]+nz*width*.5*m*s]);});
 const out=[];for(let i=1;i<sides.length;i++)out.push([[sides[i-1][0],sides[i][0],sides[i][1],sides[i-1][1],sides[i-1][0]]]);
 // Small round joins seal differently oriented endpoints without bulbous caps.
 for(const p of [clean[0],clean.at(-1)] ){const ring=Array.from({length:13},(_,i)=>[p[0]+Math.cos(i*Math.PI/6)*Math.min(.12,width*.04),p[1]+Math.sin(i*Math.PI/6)*Math.min(.12,width*.04)]);out.push([ring]);}
 return out;
}
export function unionAll(polygons){if(!polygons.length)return [];let batches=[];for(let i=0;i<polygons.length;i+=120)batches.push(pc.union(...polygons.slice(i,i+120)));return batches.length===1?batches[0]:pc.union(...batches);}
export function makePavementPlan(map,terrain){
 const buckets=new Map(),put=(key,polys)=>{if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(...polys);};
 for(const source of map.roads){const r=source.highway==='corridor'?{...source,foot:true,width:Math.min(2.6,source.width),surface:source.surfaceEvidence==='OSM surface tag'?source.surface:'concrete'}:source;
  if(r.bridge&&r.points.some(p=>terrain.bridge(...p).active))continue;
  const points=r.points.filter(p=>Math.abs(p[0])<6500&&Math.abs(p[1])<5000);if(points.length<2)continue;
  const level=r.bridge?'deck':'ground',kind=surfaceKind(r),priority=r.foot?({gravel:0,wood:1,pavers:2,asphalt:3,concrete:4}[kind]):kind==='concrete'?6:7;
  put(level+':'+priority+':'+kind,corridorPolygons(points,r.width));
 }
 for(const a of map.areas)if(a.kind==='pedestrian'&&a.points.length>3)put('ground:5:concrete',[[a.points,...a.holes||[]]]);
 // Match the terrain's open-shelter contract; do not erase a walkable path under a roof.
 const openShelters=new Set((map.facilities?.sites??[]).filter(s=>s.kind==='shelter'&&!ENCLOSED_SHELTERS.has(s.id)).map(s=>s.id));
 const cutouts=(map.buildings||[]).filter(b=>b.points.length>3&&!openShelters.has(b.id)).map(b=>[b.points]);
 const aquarium=map.aquarium,s=aquarium?.stairs;
 if(s){const world=(u,v)=>[aquarium.center[0]+Math.cos(aquarium.yaw)*u-Math.sin(aquarium.yaw)*v,aquarium.center[1]-Math.sin(aquarium.yaw)*u-Math.cos(aquarium.yaw)*v];const ring=[world(-s.width/2,s.outsideStart),world(s.width/2,s.outsideStart),world(s.width/2,s.insideEnd),world(-s.width/2,s.insideEnd)];ring.push(ring[0]);cutouts.push([ring]);}
 const exclusions=unionAll(cutouts),result=[];
 for(const level of ['ground','deck']){
  let covered=[];
  for(const key of [...buckets.keys()].filter(k=>k.startsWith(level+':')).sort((a,b)=>Number(b.split(':')[1])-Number(a.split(':')[1]))){
   const all=unionAll(buckets.get(key));let visible=covered.length?pc.difference(all,covered):all;
   if(exclusions.length&&visible.length)visible=pc.difference(visible,exclusions);
   if(visible.length)result.push({level,kind:key.split(':')[2],polygons:visible});
   covered=covered.length?pc.union(covered,all):all;
  }
 }
 return result;
}
