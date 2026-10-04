import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {elmwoodRaceCourse} from './elmwoodRaceMap.ts';
import {laneGates,ElmwoodRun} from './elmwood-gameplay.ts';
import {raceMapProgress} from './raceMap.ts';
test('standalone Elmwood map course matches its real lane and run checkpoints',()=>{
 const site=JSON.parse(readFileSync(new URL('../../public/elmwood/site.json',import.meta.url),'utf8'));
 const lane=site.features.find((f:{id:string})=>f.id==='59197492'),gates=laneGates(lane.points),course=elmwoodRaceCourse(lane.points);
 assert.ok(course.checkpoints.length>5);assert.equal(course.id,'elmwood-creek-lane');
 assert.deepEqual(course.checkpoints,gates.slice(1).map(p=>({x:p.x,y:p.z})));
 assert.deepEqual(course.points[0],{x:gates[0].x,y:gates[0].z});assert.deepEqual(course.points.at(-1),course.checkpoints.at(-1));
 // Arrival updates the run and the map in the same order; the start is not checkpoint 1.
 const run=new ElmwoodRun(gates);run.reset('sprint',gates[0]);const goal=gates[1];run.relocate({x:goal.x-1,z:goal.z});run.update(.1,goal,[]);
 assert.equal(run.gate,2);const map=raceMapProgress({...course,next:run.gate-1});assert.equal(map.next,1);assert.deepEqual(map.target,course.checkpoints[1]);assert.equal(map.checkpoints[0].state,'passed');
});
