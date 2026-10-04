import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DETROIT_RACE_COURSE} from './detroitRaceMap.ts';
import {RACE_ROUTE,RaceRules} from './raceRules.ts';
import {pointOnCut} from './geography.ts';
import {northUp} from './routeMap.ts';
import {raceMapProgress} from './raceMap.ts';
test('Swoop map matches the actual Cut-to-Mack gates and advances with its race rules',()=>{
 const course=DETROIT_RACE_COURSE;assert.equal(course.id,RACE_ROUTE.id);assert.equal(course.checkpoints.length,12);assert.ok(course.points.length>12);
 for(let i=0;i<RACE_ROUTE.gates.length;i++){const p=pointOnCut(RACE_ROUTE.gates[i]);assert.deepEqual(course.checkpoints[i],northUp(p.x,p.z));}
 assert.deepEqual(course.points.at(-1),course.checkpoints.at(-1));
 const race=new RaceRules('DS_Man_01');race.advance(3);race.player.previous=RACE_ROUTE.gates[0]-.5;race.observe(race.player.id,RACE_ROUTE.gates[0]+.5,0,.1);
 assert.equal(race.player.gate,1);assert.equal(raceMapProgress({...course,next:race.player.gate}).checkpoints[0].state,'passed');assert.deepEqual(raceMapProgress({...course,next:race.player.gate}).target,course.checkpoints[1]);
});
