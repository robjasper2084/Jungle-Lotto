import {test} from 'node:test';
import assert from 'node:assert/strict';
import {raceMapProgress,trimCoursePath,checkpointScreenPoint,fitRaceCourse,type RaceMapCourse} from './raceMap.ts';
const points=[{x:0,y:0},{x:0,y:40},{x:40,y:40},{x:40,y:80}];
const course:RaceMapCourse={id:'test',label:'Bent lane',points,checkpoints:[points[1],points[2],points[3]],next:0};
test('race map retains lane bends and clips the route to its start and finish',()=>{
 assert.deepEqual(trimCoursePath(points,{x:0,y:10},{x:40,y:65}),[{x:0,y:10},points[1],points[2],{x:40,y:65}]);
 assert.deepEqual(trimCoursePath(points,{x:40,y:65},{x:0,y:10}),[{x:40,y:65},points[2],points[1],{x:0,y:10}]);
});
test('gate progress advances the next marker, retains finish, and separates passed course',()=>{
 const first=raceMapProgress(course);assert.equal(first.target,points[1]);assert.equal(first.checkpoints[2].finish,true);assert.equal(first.passed.length,0);
 const second=raceMapProgress({...course,next:1});assert.equal(second.target,points[2]);assert.deepEqual(second.checkpoints.map(g=>g.state),['passed','next','upcoming']);assert.deepEqual(second.passed,[points[0],points[1]]);assert.deepEqual(second.remaining,[points[1],points[2],points[3]]);
 const done=raceMapProgress({...course,next:3});assert.equal(done.target,undefined);assert.deepEqual(done.remaining,[]);assert.deepEqual(done.passed,points);
 assert.equal(raceMapProgress({...course,next:-5}).next,0);assert.equal(raceMapProgress({...course,next:NaN}).next,0);
});
test('distant checkpoint is pinned in its true direction and nearby checkpoint remains in place',()=>{
 assert.deepEqual(checkpointScreenPoint({x:120,y:80},480,300),{x:120,y:80,edge:false,angle:Math.atan2(-70,-120)});
 const edge=checkpointScreenPoint({x:2000,y:-1000},480,300);assert.equal(edge.edge,true);assert.ok(edge.x>=22&&edge.x<=458&&edge.y>=22&&edge.y<=278);assert.ok(edge.x>240&&edge.y<150);
});
test('course framing keeps start and finish badges inside both short and long full maps',()=>{
 for(const length of [300,2700]){
  const points=[{x:0,y:0},{x:80,y:-length}],view=fitRaceCourse(points),scale=700/view.h;
  for(const p of points){const y=(p.y-view.y)*scale;assert.ok(y>=22&&y<=678,'endpoint badge stays in the map');}
 }
});
