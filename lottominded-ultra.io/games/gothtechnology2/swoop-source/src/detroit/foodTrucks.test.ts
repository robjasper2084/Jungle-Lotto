import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FOOD_TRUCK_SITES,FOOD_CART_SITES,foodTruckSolids,truckFootprint,cartFootprint,VENDORS,atwaterCurb,LEGACY_TRUCK_SITES} from './foodTruckSites.ts';
import {nearestCut} from './geography.ts';
import {cutWidth} from './geo-profile.ts';
import {roadwayClearance} from './roadsidePlacement.ts';
import {dryStreetSite} from './dryStreetSite.ts';
import {TagTerrain} from '../../../ride-core/src/tag/fixture.ts';
const fixture=JSON.parse(fs.readFileSync(new URL('../../public/love-tag/swoop-detroit.json',import.meta.url),'utf8'));
test('five additional trucks and RiverWalk carts stay on dry land and clear travel paths',()=>{
 assert.equal(FOOD_TRUCK_SITES.length,9);assert.equal(FOOD_TRUCK_SITES.filter(p=>p.vendor!=='sauce-pitt').length,5);assert.equal(FOOD_CART_SITES.filter(p=>p.name.startsWith('RiverWalk')).length,5);assert.equal(FOOD_CART_SITES.filter(p=>p.name.startsWith('Dequindre')).length,4);assert(FOOD_CART_SITES.filter(p=>p.name.startsWith('Atwater')).length>=3);assert.equal(FOOD_CART_SITES.filter(p=>p.name.startsWith('GothTech')).length,1);
 for(const site of FOOD_TRUCK_SITES){for(const p of truckFootprint(site))assert(dryStreetSite(p.x,p.z,.2));if(site.curbside){const curb=atwaterCurb(site)!;assert(Math.abs(curb.road.width/2-curb.distance-1.38-.30)<.02,'truck parks 30 cm from the Atwater curb');assert(curb.distance-1.38>=1,'centre lane stays open');}else for(const p of truckFootprint(site))assert(roadwayClearance(p)>3.2);}
 for(const site of FOOD_CART_SITES)for(const p of cartFootprint(site)){assert(dryStreetSite(p.x,p.z,.25));assert(roadwayClearance(p)>(site.name.startsWith('Dequindre')?.75:1.5));if(site.name.startsWith('Dequindre')){const c=nearestCut(p.x,p.z);assert(Math.abs(c.u)>cutWidth(c.d)/2+.5,'cart leaves the Cut riding ribbon clear');}}
 const sites=[...FOOD_TRUCK_SITES,...FOOD_CART_SITES];for(let i=0;i<sites.length;i++)for(let j=i+1;j<sites.length;j++)assert(Math.hypot(sites[i].x-sites[j].x,sites[i].z-sites[j].z)>8,'vendor separation');
});
test('moving curbside trucks removes their old invisible body collisions',async()=>{
 const terrain=await TagTerrain.create(fixture),t=fixture.transform;
 try{for(const p of LEGACY_TRUCK_SITES.filter(p=>p.name!=='Mack studio gathering')){const hit=terrain.sweep({x:(p.x-t.tx)/t.sx,y:p.y+1.55-t.ty,z:p.z-t.tz},{x:.05,y:0,z:0},.1);assert.equal(hit,null,p.name+' old grass location must be clear');}}
 finally{terrain.dispose();}
});
test('canonical Royale fixture blocks every visible truck and menu board',async()=>{
 const terrain=await TagTerrain.create(fixture),t=fixture.transform;
 try{for(const s of foodTruckSolids()){
  const center={x:(s.x-t.tx)/t.sx,y:s.y-t.ty,z:s.z-t.tz};
  const dx=Math.cos(s.yaw)/t.sx,dz=-Math.sin(s.yaw);
  const hit=terrain.sweep({x:center.x-dx*6,y:center.y,z:center.z-dz*6},{x:dx*12,y:0,z:dz*12},.2);
  assert(hit!==null&&hit<.55,s.kind+' must stop riders and projectiles');
 }}finally{terrain.dispose();}
});
test('each new Blender truck/cart has an LCD surface, a menu, and a bounded export',()=>{
 for(const id of [...Object.values(VENDORS).filter(v=>v.asset!=='sauce-pitt-truck').map(v=>v.asset),'paradise-cart']){
  const b=fs.readFileSync(new URL('../../public/exports/street-life/'+id+'.glb',import.meta.url)),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());assert(g.nodes.some((n:{name:string})=>n.name==='LCD_Pixels'),id+' screen');assert(b.length<3_000_000,id+' size');assert(!g.cameras?.length);assert(g.materials.some((m:{name:string})=>/lettering|supplied.*artwork/i.test(m.name)),id+' branding');
 }
});
test('portable truck excludes review floor and includes supplied menu textures',()=>{
 const bytes=fs.readFileSync(new URL('../../public/exports/street-life/sauce-pitt-truck.glb',import.meta.url));
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 assert(!gltf.nodes.some((n:{name?:string})=>n.name==='Preview floor'));assert(!gltf.cameras?.length);
 assert(gltf.materials.some((m:{name:string})=>m.name==='User supplied Sauce Pitt menu'));
 assert(gltf.images.length>=2);assert(bytes.length<3_000_000,'Mobile truck must stay under 3 MB');
});
