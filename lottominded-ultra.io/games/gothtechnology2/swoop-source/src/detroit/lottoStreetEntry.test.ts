import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {DetroitWorld,heightAt} from './world.ts';
import {LOTTO_SHOP,LOTTO_STREET_ENTRY,LOTTO_WALLS,LOTTO_FIXTURES,lottoMap,lottoToolsAvailable} from './lottoShopSite.ts';

test('street doorway and the turn into the app aisle clear the mapped world and shop fixtures',async()=>{
 const world=await new DetroitWorld().init();
 try{
  for(const p of [...LOTTO_WALLS,...LOTTO_FIXTURES]){
   const at=lottoMap(p.u,p.v);
   world.addBox({x:at.x,y:LOTTO_SHOP.floor+('y' in p?p.y:p.height/2),z:at.z,hx:p.width/2,hy:p.height/2,hz:p.depth/2,yaw:-LOTTO_SHOP.heading,kind:'LottoMind shop'});
  }
  world.step();
  function passage(u:number,v:number,endU:number,endV:number){
   const start=lottoMap(u,v),end=lottoMap(endU,endV),length=Math.hypot(end.x-start.x,end.z-start.z),direction={x:(end.x-start.x)/length,y:0,z:(end.z-start.z)/length};
   for(const height of [.3,1,1.75]){
    const hit=world.physics.castRay(new RAPIER.Ray({x:start.x,y:LOTTO_SHOP.floor+height,z:start.z},direction),length,true,undefined,0xffff0002);
    assert.equal(hit,null,`Passage blocked: ${u},${v} to ${endU},${endV} at rider height ${height}`);
   }
  }
  for(const offset of [-.45,0,.45]){
   passage(LOTTO_STREET_ENTRY.u+offset,-16,LOTTO_STREET_ENTRY.u+offset,-3.6);
   passage(-4.35,-3.6+offset,0,-3.6+offset);
   passage(offset,13,offset,-4.5);
  }
 }finally{world.physics.free();}
});
test('both street approaches remain level and the tools reach the new doorway',()=>{
 for(const u of [-4.8,-4.35,-3.9])for(let v=-16;v<-3.5;v+=.1){const p=lottoMap(u,v);assert.ok(Math.abs(heightAt(p.x,p.z)-LOTTO_SHOP.floor)<1e-6,`Ground intrusion at ${u},${v}`);}
 assert.equal(lottoToolsAvailable(-4.35,-13),true);assert.equal(lottoToolsAvailable(0,6.6),true);
 assert.equal(lottoToolsAvailable(0,-14),false);assert.equal(lottoToolsAvailable(-4.35,-18),false);
});
