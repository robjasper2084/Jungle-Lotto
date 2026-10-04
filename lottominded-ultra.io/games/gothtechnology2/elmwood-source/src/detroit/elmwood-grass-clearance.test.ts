import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {ElmwoodTerrain} from './elmwood-terrain.ts';
import {layoutElmwoodDressing,elmwoodGrassTreeSite} from './elmwood-dressing-layout.ts';
const read=(n:string)=>JSON.parse(fs.readFileSync(new URL('../../public/elmwood/'+n,import.meta.url),'utf8'));
const site=read('site.json'),placements=read('placements.json'),terrain=new ElmwoodTerrain(read('terrain.json'),site.features,placements);
test('every retained Elmwood grass tuft clears lane edges and parking with its whole footprint',()=>{
 const grass=layoutElmwoodDressing(terrain,site.boundary,placements).filter(p=>p.asset==='grass-tuft');assert.ok(grass.length>100);
 for(const p of grass)assert.ok(elmwoodGrassTreeSite(terrain,site.boundary,p.position[0],p.position[1],.8*p.scale+.12));
 for(const s of terrain.segments){const x=(s.a[0]+s.b[0])/2,n=(s.a[1]+s.b[1])/2;const p={asset:'grass-tuft',position:[x,n,terrain.surfaceGround(x,n)],rotation:0,scale:1,layer:'detail'};for(const safe of layoutElmwoodDressing(terrain,site.boundary,[p]))assert.ok(terrain.nearest(safe.position[0],safe.position[1]).distance>3,'grass in a mapped lane');}
});
