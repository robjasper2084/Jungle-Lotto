import test from 'node:test';import assert from 'node:assert/strict';
import {walkingLoop,cityWalkRoutes,seedCityPeople} from './cityWalkRoutes.ts';
import {advanceCrowd} from './crowdFlow.ts';
import {TRACKS} from './soundtrackCatalog.ts';import {ridingMusic} from './musicLocation.ts';
test('store-only recording never leaks into a riding station, including an old saved selection',()=>{
 for(const station of ['shuffle','auto','all','bonus','track-02'])for(const scene of ['ride','garden','style','results']){const list=ridingMusic(TRACKS,station,scene);assert(list.length);assert(!list.some(t=>t.id==='track-02'));}
});
test('walking loop stays continuous across both ends and the wrap, with room to pass',()=>{
 const route=walkingLoop([[0,0],[0,100]],8),step=.01;
 for(const lane of [-.4,0,.4])for(let d=0;d<route.length+step;d+=step){const a=route.point(d,lane),b=route.point(d+step,lane);assert(Math.hypot(a.x-b.x,a.z-b.z)<.025,'no jump at endpoint');assert(a.x<-6.9,'stays beside road');}
 const path={...route,point(d:number,u:number){return {...route.point(d,u),y:0};}},a={id:'person',kind:'pedestrian',distance:route.length-.04,lane:0,direction:1,pace:1.1,speed:1.1,radius:.32,height:1.7,y:0,...route.point(route.length-.04,0)};
 for(let i=0;i<600;i++)advanceCrowd([a],1/30,path,[]);assert(a.distance>15);assert(a.speed>.5);
});
test('fresh load seeds distribute people through every district with different starts',()=>{
 const routes=cityWalkRoutes(),a=seedCityPeople(routes,121,()=>0,()=>true),b=seedCityPeople(routes,812,()=>0,()=>true);
 assert.deepEqual(new Set(a.map(g=>g.name)),new Set(['Atwater Street','Detroit Riverwalk','Mack Avenue','Chene Street']));assert(a.flatMap(g=>g.agents).length<=32);
 assert.notDeepEqual(a.flatMap(g=>g.agents).map(p=>[p.x,p.z]),b.flatMap(g=>g.agents).map(p=>[p.x,p.z]));
 for(const group of a){const before=group.agents.map(p=>p.distance);for(let i=0;i<900;i++)advanceCrowd(group.agents,1/30,group.path,[]);assert(group.agents.every((p,i)=>p.distance!==before[i]));}
});
