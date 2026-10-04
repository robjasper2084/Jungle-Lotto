import test from 'node:test';import assert from 'node:assert/strict';
import {WATERFRONT,mappedShorelineAt,inWaterfrontPond,waterfrontBuildings,polygonContains} from './waterfrontSite.ts';
import {CITY,roadAt} from './geography.ts';import {DetroitWorld,SPOTS,heightAt,terrainChunks} from './world.ts';
import {HARBOR_GANGWAY,DOCK_TOP,harborFixtures} from './harborLayout.ts';
import {harborTerrainDetail} from './harbor.ts';
test('Chene park is dry land behind the actual bank; pond outline remains water',()=>{
 assert.ok(mappedShorelineAt(-1625)!< -240);assert.equal(heightAt(-211,-1625),0);
 assert.ok(inWaterfrontPond(-135,-1700));assert.equal(heightAt(-135,-1700),-.7);
 for(const s of SPOTS.filter(s=>/Aretha|Chene/.test(s.name))){assert.equal(heightAt(s.x,s.z),0);assert.equal(inWaterfrontPond(s.x,s.z),false);}
});
test('full mapped waterfront buildings and Chene / Atwater streets have terrain coverage',()=>{
 const chunks=terrainChunks(),covered=(x:number,z:number)=>chunks.some(c=>Math.abs(c.x-x)<=50&&Math.abs(c.z-z)<=50);
 const basinChunks=chunks.filter(c=>harborTerrainDetail(c.x,c.z));assert.ok(basinChunks.length>=4);for(const c of basinChunks)assert.ok(c.vertices.length/3>=51*51,'harbor edges must use a grid finer than 20 metres');
 assert.ok(covered(-125,-1899));assert.ok(covered(350,-1775));assert.ok(covered(-211,-1625));
 assert.equal(roadAt(-124.13,-1759.45)?.name,'Atwater Street');assert.equal(roadAt(-70,-1763)?.name,'Chene Street');
 const combined=waterfrontBuildings(CITY.buildings);assert.equal(new Set(combined.map(b=>b.id)).size,combined.length);
 assert.equal(combined.find(b=>b.id==='957898908')?.name,'Pasadena Apartments');assert.ok(WATERFRONT.buildings.length>=200);
 const world=new DetroitWorld();assert.equal(world.buildingMeshes.some(b=>['60624913','105519122'].includes(b.data.id)),false);
});
test('dock fittings leave central aisle clear and shore gangway has an accessible grade',()=>{
 const g=HARBOR_GANGWAY,len=Math.hypot(g.dock.x-g.shore.x,g.dock.z-g.shore.z);assert.ok((DOCK_TOP-g.shore.y)/len<.04);assert.equal(g.dock.y,DOCK_TOP);
 assert.ok(harborFixtures().boats.length>=6);assert.ok(harborFixtures().pedestals.length>=8);
 for(const p of harborFixtures().boats)assert.ok(polygonContains([[-176.072,-1281.464],[-188.099,-1401.795],[-102.506,-1408.857],[-92.7,-1288.166]],p.x,p.z));
});
