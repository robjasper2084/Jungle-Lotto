import test from 'node:test';import assert from 'node:assert/strict';
import {GroundRoutes} from '../src/royale/groundRoute.ts';
const point=(x:number,z=0,y=0)=>({x,y,z});
function fixture(){
 let queries=0;
 const terrain={ground:()=>{queries++;return {height:0,offCourse:false};},raycastObstacle:()=>{queries++;return null;},raycast:()=>null,sampleGround:()=>({height:0,normal:{x:0,y:1,z:0},surface:'pavement' as const,offCourse:false})};
 const nodes=[point(0),point(600),point(0,4)],edges=new Map([[0,new Map([[1,600],[2,4]])],[1,new Map([[0,600]])],[2,new Map([[0,4]])]]);
 return {routes:new GroundRoutes(nodes,edges,terrain),nodes,get queries(){return queries;}};
}
test('long terrain edges obey each update budget and return the same safe route',()=>{
 const f=fixture(),planner=f.routes.createPlanner();assert.equal(planner.request('rider',f.nodes[0],f.nodes[1]),undefined);assert.equal(f.queries,0);
 let frames=0;while(planner.pending&&frames++<2000){const before=f.queries;assert(planner.advance(16)<=16);assert(f.queries-before<=16,'terrain checks must stay inside the per-tick budget');}
 assert.equal(planner.pending,0);assert(frames>100);assert.deepEqual(planner.request('rider',f.nodes[0],f.nodes[1]),f.routes.path(f.nodes[0],f.nodes[1]));
});
test('a nearby request completes before a long path; moving destinations do not restart work',()=>{
 const f=fixture(),q=f.routes.createPlanner();q.request('long',f.nodes[0],f.nodes[1]);q.request('near',f.nodes[0],f.nodes[2]);
 let near;for(let i=0;i<80&&!near;i++){q.advance(8);near=q.request('near',f.nodes[0],f.nodes[2]);q.request('long',point(i*.01),point(600+i*.01));}
 assert(near?.length);assert(q.pending>0,'long request must not block nearby request');
 while(q.pending)q.advance(96);assert(q.request('long',point(1),point(601))?.length);
});
test('separate match queues and clear cannot cancel another match',()=>{
 const f=fixture(),a=f.routes.createPlanner(),b=f.routes.createPlanner();a.request('same',f.nodes[0],f.nodes[1]);b.request('same',f.nodes[0],f.nodes[2]);a.clear();assert.equal(a.pending,0);assert.equal(b.pending,1);while(b.pending)b.advance();assert(b.request('same',f.nodes[0],f.nodes[2])?.length);
});
test('teleport discards the old endpoint and blocked cliffs keep their safe detour',()=>{
 const nodes=[point(0,-2),point(0,2,2),point(6,-2),point(6,2,2)];const edges=new Map<number,Map<number,number>>();
 for(const [a,b,w]of [[0,1,4],[0,2,6],[2,3,4],[3,1,6]])for(const [u,v]of [[a,b],[b,a]]){const e=edges.get(u)??new Map();e.set(v,w);edges.set(u,e);}
 const terrain={ground:(x:number,z:number)=>({height:x<4?(z<0?0:2):Math.max(0,Math.min(2,(z+2)/2))}),raycastObstacle:()=>null,raycast:()=>null,sampleGround:()=>({height:0,normal:{x:0,y:1,z:0},surface:'pavement' as const,offCourse:false})};
 const r=new GroundRoutes(nodes,edges,terrain),q=r.createPlanner();q.request('a',nodes[0],nodes[1]);for(let n=0;n<1000&&q.pending;n++)q.advance(7);assert.equal(q.pending,0);assert.deepEqual(q.request('a',nodes[0],nodes[1]),[nodes[0],nodes[2],nodes[3],nodes[1]]);
 q.request('a',nodes[0],nodes[1]);q.advance(1);q.request('a',point(1000),point(1001));while(q.pending)q.advance();assert.deepEqual(q.request('a',point(1000),point(1001)),[]);
});

test('respawn cancellation discards an old route even at a nearby node',()=>{const f=fixture(),q=f.routes.createPlanner();q.request('rider',f.nodes[0],f.nodes[1]);q.advance(20);q.cancel('rider');assert.equal(q.pending,0);q.request('rider',f.nodes[0],f.nodes[2]);while(q.pending)q.advance();assert.deepEqual(q.request('rider',f.nodes[0],f.nodes[2]),[f.nodes[0],f.nodes[2]]);});
