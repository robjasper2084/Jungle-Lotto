import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visitorStops,visitorPath,visitorSegmentClear,visitorClear,VisitorJourney} from './retailVisitorRoutes.ts';
test('all visitor routes clear the modeled retail fixtures and reserved entry',()=>{
 for(const store of [false,true]){const stops=visitorStops(store);for(let i=0;i<stops.length;i++){
  assert.ok(visitorClear(store,stops[i]),'stop '+store+' '+i);
  const path=visitorPath(store,stops[i],stops[(i+1)%stops.length]);assert.ok(path.length>=2,'route '+store+' '+i);
  for(let n=1;n<path.length;n++)assert.ok(visitorSegmentClear(store,path[n-1],path[n]),'clear route');
 }}
});
test('five visitors browse and walk through both rooms, while paused time preserves positions',()=>{
 for(const store of [false,true]){const people=Array.from({length:5},(_,i)=>new VisitorJourney(store,i));
  const initial=people.map(p=>JSON.stringify(p.position));people.forEach(p=>p.step(0));assert.deepEqual(people.map(p=>JSON.stringify(p.position)),initial);
  for(let n=0;n<7200;n++)for(let i=0;i<people.length;i++){people[i].step(1/30,people.filter((_,j)=>j!==i).map(p=>p.position));assert.ok(visitorClear(store,people[i].position),'fixture contact');}
  assert.ok(people.every(p=>p.completed>=3),'all visitors keep making progress: '+people.map(p=>p.completed));
 }
});
