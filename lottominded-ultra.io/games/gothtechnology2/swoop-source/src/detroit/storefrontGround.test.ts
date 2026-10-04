import test from 'node:test';
import assert from 'node:assert/strict';
import {heightAt} from './world.ts';
import {MACK_STUDIO,studioMap,studioPavingCell} from './mackStudioSite.ts';
import {LOTTO_SHOP,lottoMap} from './lottoShopSite.ts';
import {STUDIO_SCREEN_WALLS} from './mediaSources.ts';
import {STUDIO_VIEWS,STUDIO_FIXTURES} from './studioInteriorLayout.ts';
test('ground stays below both finished retail slabs, including corners and entrances',()=>{
 for(const [site,map,halfW,halfD]of [[MACK_STUDIO,studioMap,24,21.8],[LOTTO_SHOP,lottoMap,6.7,9.4]] as const){
  for(let u=-halfW;u<=halfW;u+=.5)for(let v=-halfD;v<=halfD;v+=.5){const p=map(u,v);assert.ok(Math.abs(heightAt(p.x,p.z)-site.floor)<1e-6,`${site.osmId} floor at ${u},${v}`);}
 }
 for(let v=8;v<=16.4;v+=.1){const p=lottoMap(0,v);assert.ok(Math.abs(heightAt(p.x,p.z)-LOTTO_SHOP.floor)<1e-6,'step-free LottoMind entrance');}
});
test('parking tessellation excludes the building and preserves the loading approach',()=>{
 assert.equal(studioPavingCell(-2,-2,2,2),false);assert.equal(studioPavingCell(24,0,26,2),false,'partial wall overlap is excluded');
 assert.equal(studioPavingCell(-2,22.2,2,24),true);assert.equal(studioPavingCell(26,-2,28,2),true);
 for(const [u,v]of [[0,27],[-50,30],[-60,-78]]){const p=studioMap(u,v);assert.ok(Math.abs(heightAt(p.x,p.z)-MACK_STUDIO.floor)<1e-6,'level parking and arrival route');}
 const gate=studioMap(34.5,39);assert.ok(Math.abs(heightAt(gate.x,gate.z)-MACK_STUDIO.floor)<.07,'gate transitions gently to the street');
});
test('cinema playback is clear of its relocated chassis and visible to its inspection camera',()=>{
 const screen=STUDIO_SCREEN_WALLS.find(p=>p.id==='cinema')!,chassis=STUDIO_FIXTURES.find(p=>p.name==='cinema display chassis')!;
 assert.ok(screen.v<chassis.v-chassis.depth/2,'video stays in front of its frame');
 assert.ok(Math.abs(screen.u-chassis.u)+screen.width/2<chassis.width/2,'video fits within its frame');
 const [u,,v]=STUDIO_VIEWS.cinema.eye;
 assert.ok((u-screen.u)*Math.sin(screen.angle)+(v-screen.v)*Math.cos(screen.angle)>0,'camera sees the front of the video');
 assert.deepEqual(STUDIO_VIEWS.cinema.target,[screen.u,screen.y,screen.v]);
});
