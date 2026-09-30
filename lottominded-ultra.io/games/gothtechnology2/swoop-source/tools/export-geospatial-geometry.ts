// Export the runtime geometry verbatim for Blender and engine interchange.
import {writeFileSync,mkdirSync} from 'node:fs';
import * as T from 'three';
import {terrainChunks,heightAt,DetroitWorld} from '../src/detroit/world.ts';
import {GEO,MAP_ORIGIN,cutWidth} from '../src/detroit/geo-profile.ts';
import {geospatialMeshes,buildingEnvelope} from '../src/detroit/geo-geometry.ts';
import {CUT_METRES,pointOnCut} from '../src/detroit/geography.ts';
const world=new DetroitWorld();
const items:{name:string;kind:string;source:string;vertices:number[];indices:number[]}[]=[];
function add(name:string,kind:string,source:string,p:ArrayLike<number>,idx:ArrayLike<number>){
  const vertices=Array.from(p,(v,i)=>Number(((v-[MAP_ORIGIN.x,MAP_ORIGIN.y,MAP_ORIGIN.z][i%3])*(i%3===0?-1:1)).toFixed(4)));
  // Reflection changes winding; reverse each triangle to retain outward normals.
  const indices=Array.from(idx);for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  items.push({name,kind,source,vertices,indices});
}
function geometry(name:string,kind:string,source:string,g:T.BufferGeometry){
  const p=g.attributes.position;add(name,kind,source,p.array,g.index?.array??Uint32Array.from({length:p.count},(_,i)=>i));
}
for(const c of terrainChunks()){

  add('Terrain '+c.x+' '+c.z,'terrain','Shared game terrain / profile estimates',c.vertices,c.indices);
}
for(const m of geospatialMeshes(heightAt))geometry(m.name,m.kind,m.source,m.geometry);
for(const m of world.buildingMeshes)geometry((m.data.name||'Building')+' OSM '+m.data.id,'building','OSM footprint; height and facade require review',m.geometry);
mkdirSync('public/geospatial',{recursive:true});
writeFileSync('public/geospatial/runtime-buildings.json',JSON.stringify(world.buildingMeshes.map(m=>m.data)));
function ribbon(name:string,points:number[][],widths:number[],kind:string,source:string){
  const v:number[]=[],indices:number[]=[];
  points.forEach((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],len=Math.hypot(b[0]-a[0],b[1]-a[1]);for(const side of [-1,1]){const x=p[0]-(b[1]-a[1])/len*widths[i]/2*side,z=p[1]+(b[0]-a[0])/len*widths[i]/2*side;v.push(x,heightAt(x,z)+.045,z);}if(i){const a=i*2-2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}});
  add(name,kind,source,v,indices);
}
const trail:number[][]=[],widths:number[]=[];for(let d=0;d<=CUT_METRES;d+=2){const p=pointOnCut(d);trail.push([p.x,p.z]);widths.push(cutWidth(d));}
ribbon('Dequindre Cut paved corridor',trail,widths,'path','OSM centerline; 20 ft south / 15 ft Phase II plan width');
for(const r of GEO.ramps){const pts:number[][]=[];for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);for(let j=0;j<n;j++)pts.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);}pts.push(r.points.at(-1)!);ribbon(r.name,pts,pts.map(()=>r.width),'ramp',r.source);}
mkdirSync('art/geospatial',{recursive:true});
writeFileSync('art/geospatial/runtime-geometry.json',JSON.stringify({units:'metres',coordinates:'Three.js Y-up, local Gratiot origin',origin:GEO.origin,items}));
writeFileSync('art/geospatial/geometry-manifest.json',JSON.stringify({origin:GEO.origin,objects:items.length,triangles:items.reduce((s,m)=>s+m.indices.length/3,0),kinds:Object.fromEntries([...new Set(items.map(i=>i.kind))].map(k=>[k,items.filter(i=>i.kind===k).length])),source:'Exported directly from the game terrain and structural mesh builders; building/path envelopes share the map and profile.'},null,2));
console.log('Exported',items.length,'objects');
