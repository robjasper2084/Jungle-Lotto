import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {DetroitWorld,heightAt} from './world.ts';
import {PENNY_SHOP,PENNY_SOLIDS,pennyMap} from './pennyShopSite.ts';
test('both auction entrances and accessible aisles have actual physics clearance',async()=>{const world=await new DetroitWorld().init();try{assert.equal(world.buildingMeshes.some(b=>b.data.id===PENNY_SHOP.osmId),false);for(const p of PENNY_SOLIDS){const q=pennyMap(p.u,p.v);world.addBox({x:q.x,y:PENNY_SHOP.floor+p.y,z:q.z,hx:p.width/2,hy:p.height/2,hz:p.depth/2,yaw:-PENNY_SHOP.heading,kind:'auction'});}world.step();for(const [from,to]of [[13,2.4],[-13,-2.4]])for(const u of [-.5,0,.5])for(const y of [.3,1,1.75]){const a=pennyMap(u,from),b=pennyMap(u,to),length=Math.hypot(b.x-a.x,b.z-a.z),direction={x:(b.x-a.x)/length,y:0,z:(b.z-a.z)/length};assert.equal(world.physics.castRay(new RAPIER.Ray({x:a.x,y:PENNY_SHOP.floor+y,z:a.z},direction),length,true,undefined,0xffff0002),null);}}finally{world.physics.free();}});
test('showroom slab and street approaches have no terrain intrusion',()=>{for(const u of [-3,0,3])for(let v=-15;v<=15;v+=.5){const q=pennyMap(u,v);assert.ok(Math.abs(heightAt(q.x,q.z)-PENNY_SHOP.floor)<1e-6);}});
