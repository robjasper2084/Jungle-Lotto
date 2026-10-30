import test from 'node:test';
import assert from 'node:assert/strict';
import {chunkCoverage} from './chunkCoverage.ts';
import {mappedShorelineAt,WATERFRONT} from './waterfrontSite.ts';
import {VALADE} from './valadeSite.ts';

test('terrain coverage preserves inclusive edges, negative coordinates and gaps',()=>{
 const chunks=[{x:-150,z:-50},{x:50,z:50},{x:250,z:150},{x:17,z:41}],covered=chunkCoverage(chunks);
 for(let x=-250;x<=350;x+=2.5)for(let z=-150;z<=250;z+=2.5)assert.equal(covered(x,z),chunks.some(c=>Math.abs(c.x-x)<=50&&Math.abs(c.z-z)<=50),`${x},${z}`);
 for(const c of chunks)for(const dx of [-50,50])for(const dz of [-50,50])assert(covered(c.x+dx,c.z+dz));
});

test('indexed shoreline keeps the exact mapped bank and inlet mouth',()=>{
 const reference=(z:number)=>{
  if(z< -1950||z>220)return undefined;let edge=Infinity;
  const a=VALADE.inlet[0],b=VALADE.inlet.at(-1)!;
  if(z<=a[1]&&z>=b[1])edge=a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]);
  for(const w of WATERFRONT.shoreline)for(let i=1;i<w.points.length;i++){
   const p=w.points[i-1],q=w.points[i];if(z<Math.min(p[1],q[1])||z>Math.max(p[1],q[1])||Math.abs(q[1]-p[1])<.001)continue;
   const x=p[0]+(q[0]-p[0])*(z-p[1])/(q[1]-p[1]);if(x> -650&&x<100)edge=Math.min(edge,x);
  }return Number.isFinite(edge)?edge:undefined;
 };
 const probes=[...WATERFRONT.shoreline.flatMap(w=>w.points.map(p=>p[1])),...VALADE.inlet.map(p=>p[1])];
 for(let z=-2000;z<=250;z+=.5)probes.push(z);
 for(const z of probes)assert.equal(mappedShorelineAt(z),reference(z),`shoreline at ${z}`);
});
