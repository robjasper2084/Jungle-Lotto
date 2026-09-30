import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ElmwoodTerrain,inElmwoodPond} from './elmwood-terrain.ts';
import {elmwoodCreekPlantings} from './elmwood-creek-garden.ts';
import {segmentDistance,inRing} from './elmwood-details.ts';
const read=(n:string)=>JSON.parse(fs.readFileSync(new URL('../../public/elmwood/'+n,import.meta.url),'utf8'));
const site=read('site.json'),ps=read('placements.json'),terrain=new ElmwoodTerrain(read('terrain.json'),site.features,ps);
test('creek planting follows open water banks while keeping riding lanes and bridges clear',()=>{
 const {flowers,shrubs}=elmwoodCreekPlantings(terrain,site.boundary);
 assert.ok(flowers.length>50);assert.ok(shrubs.length>5);
 const water=site.features.filter((f:any)=>f.tags.waterway==='stream'&&!f.tags.tunnel).flatMap((f:any)=>f.points.slice(1).map((b:number[],i:number)=>[f.points[i],b]));
 for(const p of [...flowers.map(p=>[p.x,p.north]),...shrubs]){
  assert.ok(terrain.nearest(p[0],p[1]).distance>3.4);assert.equal(inElmwoodPond(p[0],p[1],site.features),false);
  assert.ok(Math.min(...water.map(([a,b]:number[][])=>segmentDistance(p[0],p[1],a,b)))<7);
 }
 console.log('Creek flower clumps:',flowers.length,'shrubs:',shrubs.length);
});
test('all added crypts remain within cemetery bounds and the annotated bench stays off pavement',()=>{
 for(const p of ps.filter((p:any)=>p.footprint))assert.ok(inRing(p.position[0],p.position[1],site.boundary),p.asset);
 const benches=ps.filter((p:any)=>p.asset==='elmwood-park-bench');assert.equal(benches.length,3);
 for(const p of benches)assert.ok(terrain.nearest(p.position[0],p.position[1]).distance>3.2);
});
test('official Tree Tour stops are deduplicated and keep trunks on land outside riding lanes',()=>{
 const tour=read('tree-tours.json');assert.equal(tour.stops.reduce((n:number,s:any)=>n+s.tourStops.length,0),96);
 const trees=ps.filter((p:any)=>p.treeTour);assert.equal(trees.length,tour.uniqueTrees);
 for(const p of trees){
  const [x,n]=p.position;assert.ok(inRing(x,n,site.boundary),p.species+' outside cemetery');
  assert.equal(inElmwoodPond(x,n,site.features),false,p.species+' in pond');
  assert.ok(terrain.nearest(x,n).distance>=4.9,p.species+' blocks lane');
  assert.ok(Math.abs(p.position[2]-terrain.ground(x,n))<.002,p.species+' floats');
 }
});

test('expanded garden beds keep flower crowns off parking, monuments and grave markers',()=>{
 const {gardens}=elmwoodCreekPlantings(terrain,site.boundary);assert.ok(gardens.length>350);
 for(const p of gardens){assert.ok(terrain.nearest(p.x,p.north).distance>3.5);assert.equal(inElmwoodPond(p.x,p.north,site.features),false);assert.ok(inRing(p.x,p.north,site.boundary));for(const grave of ps.filter((q:any)=>['ledger','headstone','cross-headstone','arched-headstone','weathered-headstone'].includes(q.asset)))assert.ok(Math.hypot(p.x-grave.position[0],p.north-grave.position[1])>1.3);}
 console.log('Garden flowers:',gardens.length*9);
});


