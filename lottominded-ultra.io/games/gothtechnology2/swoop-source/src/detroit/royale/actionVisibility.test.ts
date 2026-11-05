import test from 'node:test';
import assert from 'node:assert/strict';
import {contextualActions,type ActionContext} from './actionVisibility.ts';
const riding:ActionContext={foot:false,brawling:false,crashed:false,dogCharges:0,scopes:0,weapons:1,health:100,healthPacks:1,healing:false,shields:1,canSwap:false,magazine:20,capacity:20,reserve:60,reloading:false,fireModes:7};
test('fresh rider sees only available equipment and riding controls',()=>{
 const a=contextualActions(riding);for(const key of ['brawl','evade','dog-attack','dog-radar','scope','switch','recover','swap','repair'])assert.equal(a[key],false,key);assert.equal(a.reload,true);
 assert.equal(a.utility,true);assert.equal(a.aim,true);assert.equal(a.cycleMode,true);
});
test('equipment, injury and a nearby replacement reveal their actions; exhaustion hides them again',()=>{
 const a=contextualActions({...riding,dogCharges:1,scopes:1,weapons:2,health:65,magazine:19,canSwap:true,crashed:true});
 for(const key of ['dog-attack','dog-radar','scope','switch','repair','reload','swap','recover'])assert.equal(a[key],true,key);
 const empty=contextualActions({...riding,health:40,healthPacks:0,magazine:0,reserve:0,shields:0,fireModes:1});
 for(const key of ['repair','utility','cycleMode'])assert.equal(empty[key],false,key);assert.equal(empty.reload,true);
 assert.equal(contextualActions({...riding,healing:true,healthPacks:0}).repair,true);
});
test('dismount exposes melee and brawling keeps heavy attack available without ammunition',()=>{
 assert.equal(contextualActions({...riding,foot:true}).brawl,true);
 const a=contextualActions({...riding,foot:true,brawling:true,reserve:0});
 assert.equal(a.evade,true);assert.equal(a.reload,true);
 for(const key of ['aim','cycleMode','lean-left','lean-right','scope','switch'])assert.equal(a[key],false,key);
});
