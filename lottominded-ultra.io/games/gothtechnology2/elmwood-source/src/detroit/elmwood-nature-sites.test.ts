import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ElmwoodTerrain,inElmwoodPond} from './elmwood-terrain.ts';
import {elmwoodCherrySites} from './elmwood-nature-sites.ts';
import {ELMWOOD_PARKING,inRing,segmentDistance} from './elmwood-details.ts';
import {layoutElmwoodDressing} from './elmwood-dressing-layout.ts';
const read=(name:string)=>JSON.parse(fs.readFileSync(new URL('../../public/elmwood/'+name,import.meta.url),'utf8'));
test('larger blossom groves stay on open ground, clear of paths, water and landmarks',()=>{
 const site=read('site.json'),grid=read('terrain.json'),raw=read('placements.json');
 const dressed=layoutElmwoodDressing(new ElmwoodTerrain(grid,site.features,raw),site.boundary,raw),terrain=new ElmwoodTerrain(grid,site.features,dressed);
 const trees=elmwoodCherrySites(terrain,site.boundary),water=site.features.filter((f:any)=>f.tags.waterway==='stream'&&!f.tags.tunnel).flatMap((f:any)=>f.points.slice(1).map((b:number[],i:number)=>[f.points[i],b]));
 assert.ok(trees.length>=20&&trees.length<=24);
 assert.ok(trees.filter(t=>t.creek).length>=8);
 assert.ok(trees.filter(t=>t.area==='valley').length>=4);
 assert.ok(trees.filter(t=>t.area==='garden').length>=4);
 const moved=trees.find(t=>t.id==='valley-right')!;
 assert.ok(moved.x>=13&&moved.scale>=1.7,'featured blossom moves into the right clearing and grows');
 assert.ok(trees.every(t=>t.scale>1.3));
 for(const p of trees){
  const crown=p.scale*2.2;
  assert.ok(terrain.nearest(p.x,p.north).distance>=crown+3.5);assert.equal(inRing(p.x,p.north,ELMWOOD_PARKING),false);
  assert.equal(inElmwoodPond(p.x,p.north,site.features),false);assert.ok(inRing(p.x,p.north,site.boundary));
  assert.ok(Math.abs(p.y-terrain.surfaceGround(p.x,p.north))<.001);
  const waterDistance=Math.min(...water.map(([a,b]:number[][])=>segmentDistance(p.x,p.north,a,b)));
  assert.ok(waterDistance>=crown+2);
  if(p.creek)assert.ok(waterDistance<=17.1);
  for(let i=0;i<8;i++){
   const x=p.x+Math.cos(i*Math.PI/4)*crown,n=p.north+Math.sin(i*Math.PI/4)*crown;
   assert.ok(inRing(x,n,site.boundary));assert.equal(inElmwoodPond(x,n,site.features),false);
   assert.equal(inRing(x,n,ELMWOOD_PARKING),false);
   assert.ok(!site.features.some((f:any)=>f.kind==='building'&&inRing(x,n,f.points)));
  }
  assert.ok(!terrain.placements.some(q=>q.footprint&&Math.hypot(p.x-q.position[0],p.north-q.position[1])<Math.hypot(q.footprint[0]/2,q.footprint[1]/2)+crown+1));
  assert.ok(trees.every(q=>q===p||Math.hypot(p.x-q.x,p.north-q.north)>=20));
 }
 console.log('Blossom groves:',{trees:trees.length,valley:trees.filter(t=>t.area==='valley').length,creek:trees.filter(t=>t.creek).length,featured:moved});
});
