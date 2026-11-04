import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {ParkTerrain} from './terrain.ts';import {RideCore} from '../../runtime/ride-core/src/ridecore.ts';import {bridgeCourse,gridSpot,RaceRules,aiRaceInput} from './raceRules.ts';
const map=JSON.parse(fs.readFileSync('public/belle/map.json','utf8')),terrain=new ParkTerrain(map),course=bridgeCourse(map.bridge);
test('AI rides the complete bridge circuit with real terrain and wheel physics',()=>{const rules=new RaceRules(course,[{id:'ai',name:'AI',ai:true}],1),p=gridSpot(course,0),core=new RideCore(terrain,{spawn:{position:{x:p.x,y:terrain.height(p.x,p.z),z:p.z},headingY:p.heading}});rules.running=true;let falls=0;for(let i=0;i<60*400&&!rules.finished;i++){rules.tick(1/60);core.advance(1/60,aiRaceInput(core.current,course,rules.racers[0].next));if(core.controller.crashed){falls++;break;}rules.observe('ai',core.current);}assert.equal(falls,0);assert(rules.finished,'stuck at gate '+rules.racers[0].next+' '+JSON.stringify({x:core.current.x,z:core.current.z,speed:core.current.speed,heading:core.current.headingY}));});

test('all four grid slots race, recover and finish under the real physics model',()=>{
 const entries=Array.from({length:4},(_,i)=>({id:'ai'+i,name:'AI '+i,ai:true})),rules=new RaceRules(course,entries,1);
 const cores=entries.map((_,i)=>{const p=gridSpot(course,i);return new RideCore(terrain,{spawn:{position:{x:p.x,y:terrain.height(p.x,p.z),z:p.z},headingY:p.heading}});});
 rules.running=true;
 for(let i=0;i<60*450&&!rules.finished;i++){
  rules.tick(1/60);
  cores.forEach((core,j)=>{const r=rules.racers[j];if(r.finished!==null||r.dnf)return;
   if(i===300&&j===2){const p=rules.recover(r.id)!;core.reset({position:{x:p.x,y:terrain.height(p.x,p.z),z:p.z},headingY:p.heading});}
   core.advance(1/60,aiRaceInput(core.current,course,r.next,.9+j*.025));assert(!core.controller.crashed,'fall at slot '+j);rules.observe(r.id,core.current);
  });
 }
 assert(rules.finished);assert(rules.racers.every(r=>r.finished!==null&&!r.dnf));assert.equal(rules.racers[2].penalty,3);
 const times=rules.standings().map(r=>r.finished!);assert.deepEqual(times,[...times].sort((a,b)=>a-b));
});

import {islandCourses} from './raceCourses.ts';
for(const island of islandCourses(map.bridge)){test('full island route: '+island.name,()=>{const rules=new RaceRules(island,[{id:'ai',name:'AI',ai:true}],1),p=gridSpot(island,0),core=new RideCore(terrain,{spawn:{position:{x:p.x,y:terrain.height(p.x,p.z),z:p.z},headingY:p.heading}});rules.running=true;assert(island.length>9500);let stuck=0,last=-1;for(let i=0;i<60*3600&&!rules.finished;i++){rules.tick(1/60);core.advance(1/60,{...aiRaceInput(core.current,island,rules.racers[0].next),stableAI:true});rules.observe('ai',core.current);if(rules.racers[0].passed===last)stuck++;else{last=rules.racers[0].passed;stuck=0;}if(core.controller.crashed||stuck>3600)break;}assert(rules.finished,'stuck '+JSON.stringify({gate:rules.racers[0].next,total:island.points.length,target:island.points[rules.racers[0].next],x:core.current.x,z:core.current.z,speed:core.current.speed,heading:core.current.headingY,crashed:core.controller.crashed,elapsed:rules.elapsed}));});}
