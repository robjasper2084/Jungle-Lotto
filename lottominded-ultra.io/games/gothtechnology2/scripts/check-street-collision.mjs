import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import R from '../ride-core/node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs';
const base=new URL('../swoop-source/public/exports/street-life/',import.meta.url),out=new URL('../docs/combat/evidence/street-surfaces-20261011/',import.meta.url);
const original=JSON.parse(await readFile(new URL('street-surfaces.json',base))),optimized=JSON.parse(await readFile(new URL('collision.json',out)));
const a=gunzipSync(await readFile(new URL('street-surfaces.bin.gz',base))),b=await readFile(new URL('collision.bin',out));
const raw=new Float32Array(a.buffer,a.byteOffset,a.length/4),small=new Float32Array(b.buffer,b.byteOffset,b.length/4);
await R.init();let probes=0,misses=0,maxError=0,worst=null;const repair=process.argv.includes('--repair'),repaired=[],tiles=[];let offset=0,replaced=0;
const source=original.tiles.filter(t=>!['yellow','white','seam'].includes(t.material));
for(let k=0;k<source.length;k++){
 const old=source[k],next=optimized.tiles[k],v=raw.slice(old.offset,old.offset+old.count),w=small.slice(next.offset,next.offset+next.count);
 const worlds=[v,w].map(data=>{const world=new R.World({x:0,y:0,z:0});world.createCollider(R.ColliderDesc.trimesh(data,Uint32Array.from({length:data.length/3},(_,i)=>i)));world.step();return world;});
 const step=9;let bad=false;
 for(let i=0;i<v.length;i+=step){const x=(v[i]+v[i+3]+v[i+6])/3,z=(v[i+2]+v[i+5]+v[i+8])/3,y=(v[i+1]+v[i+4]+v[i+7])/3;
  const ray=new R.Ray({x,y:y+1,z},{x:0,y:-1,z:0}),hits=worlds.map(world=>world.castRay(ray,2,false));
  if(!hits[0])continue;probes++;if(!hits[1]){misses++;bad=true;continue;}const error=Math.abs(hits[0].timeOfImpact-hits[1].timeOfImpact);if(error>.03)bad=true;
  if(error>maxError){maxError=error;worst={tile:k,x,y,z};}
 }
 worlds.forEach(w=>w.free());
 const kept=bad&&repair?v:w;if(bad&&repair)replaced++;repaired.push(Buffer.from(kept.buffer,kept.byteOffset,kept.byteLength));tiles.push({...next,offset,count:kept.length});offset+=kept.length;
}
const report={probes,misses,maxError,worst,toleranceMetres:.03,replaced,triangles:offset/9};console.log(report);
if(repair){await writeFile(new URL('collision.bin',out),Buffer.concat(repaired));await writeFile(new URL('collision.json',out),JSON.stringify({...optimized,tiles,values:offset}));await writeFile(new URL('geometry-repair.json',out),JSON.stringify(report,null,2));}
else{await writeFile(new URL('geometry-check.json',out),JSON.stringify(report,null,2));if(misses||maxError>.03)throw Error('Street simplification exceeded geometry tolerance');}
