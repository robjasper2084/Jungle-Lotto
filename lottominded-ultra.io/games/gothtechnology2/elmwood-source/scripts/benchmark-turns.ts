import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {ElmwoodTerrain} from '../src/detroit/elmwood-terrain.ts';
import {createGroundSample} from '../src/simulation/world.ts';
const read=(name:string)=>JSON.parse(fs.readFileSync(new URL('../public/elmwood/'+name,import.meta.url),'utf8'));
const terrain=new ElmwoodTerrain(read('terrain.json'),read('site.json').features,read('placements.json'));
const sample=createGroundSample();
const points=terrain.segments.flatMap(s=>[.1,.5,.9].map(t=>({x:s.a[0]+(s.b[0]-s.a[0])*t,north:s.a[1]+(s.b[1]-s.a[1])*t})));
let checksum=0;const timings:number[]=[];
for(let run=0;run<6;run++){const start=performance.now();for(let lap=0;lap<12;lap++)for(const p of points){const g=terrain.sampleGround(p.x,-p.north,sample);checksum+=g.height+g.normal.y;}if(run)timings.push(performance.now()-start);}
console.log(JSON.stringify({scope:'CPU ground queries across all mapped lane segments; not browser FPS',segments:terrain.segments.length,queriesPerRun:points.length*12,medianMs:timings.sort((a,b)=>a-b)[2],timings,checksum},null,2));
