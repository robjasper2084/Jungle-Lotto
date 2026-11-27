import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {PIN,GAME,sha256,gitBlob} from './contract.mjs';
import {gridShape,assertGroundRows,collectConstructorGrid} from './grid-capture.mjs';
import {rawJson,parseRaw} from './evidence.mjs';
const path=process.env.PREFLIGHT_PLANNER_PATH;assert(path,'Focused grid checks require the exact pinned original planner path');
const bytes=await readFile(path),pin=PIN.sourceFiles.find(row=>row.path===GAME+'/scripts/staged-landmark-exterior-proof.mjs');assert.equal(sha256(bytes),pin.sha256);assert.equal(gitBlob(bytes),pin.gitBlob);
const {createExteriorPlanner:original}=await import(pathToFileURL(path).href);
const bounds={min:[-25,0,-25],max:[25,30,25],center:[0,15,0]},camera={fov:75,aspect:1.6};
const ground=points=>points.map(point=>({...point,height:2,walkable:true,planningClearance:2.25,obstacleOccupancy:{bodyHeights:[.62,1.1,1.58],narrowRadius:.7,narrowHits:[null,null,null],wideRadius:2.25,wideHits:[null,null,null]}}));
function collector(overrides={}){const batches=[];return{batches,options:{createExteriorPlanner:original,bounds,camera,layout:'desktop',queryGround:async points=>ground(points),record:async raw=>{batches.push(parseRaw(rawJson(raw)));return{file:'grid-'+raw.index+'.json',bytes:1,sha256:'a'.repeat(64)};},...overrides}};}
test('exact pinned original constructor emits the complete unchanged multibatch grid without a route',async()=>{
 const {options,batches}=collector(),receipt=await collectConstructorGrid(options),shape=gridShape(bounds,camera);
 assert.equal(receipt.totalPoints,shape.count);assert(receipt.batches.length>1);assert.equal(batches.reduce((n,row)=>n+row.points.length,0),shape.count);assert.equal(receipt.constructorCalls,1);assert.equal(receipt.sweepRequests,0);assert.equal(receipt.viewRequests,0);assert.equal(receipt.routeCalls,0);
 assert(batches.every(row=>row.complete&&row.error===null));assert.deepEqual(receipt.receipt.plans,[]);
});
test('no route property access or constructor view/sweep request is needed',async()=>{
 const wrapper=async args=>{const planner=await original(args);Object.defineProperty(planner,'route',{get(){throw Error('Route was accessed');}});return planner;};
 await collectConstructorGrid(collector({createExteriorPlanner:wrapper}).options);
 for(const key of ['querySweeps','queryViewBounds'])await assert.rejects(()=>collectConstructorGrid(collector({createExteriorPlanner:async args=>args[key]([])}).options),/forbids|cannot query/);
});
test('a constructor that omits, reorders or adds grid points fails instead of returning a partial receipt',async()=>{
 const missing=async args=>{await args.queryGround([{x:0,z:0}]);return{};};await assert.rejects(()=>collectConstructorGrid(collector({createExteriorPlanner:missing}).options),/grid changed/);
 await assert.rejects(()=>collectConstructorGrid(collector({createExteriorPlanner:async()=>({center:{x:0,z:0},viewDistance:1})}).options),/incomplete original grid/);
});
test('incomplete or altered original ground outputs fail and are retained raw',async()=>{
 for(const queryGround of [async points=>ground(points).slice(1),async points=>ground(points).reverse(),async points=>{const rows=ground(points);rows[0].obstacleOccupancy.narrowRadius=.27;return rows;}]){
  const {options,batches}=collector({queryGround});await assert.rejects(()=>collectConstructorGrid(options));assert.equal(batches.length,1);assert.equal(batches[0].complete,false);assert(batches[0].error&&batches[0].rows);
 }
});
test('failed terrain calls still retain all original batch inputs and their failure',async()=>{
 const {options,batches}=collector({queryGround:async()=>{throw Error('original query failed');}});await assert.rejects(()=>collectConstructorGrid(options),/original query failed/);assert.equal(batches.length,1);assert.equal(batches[0].points.length,10000);assert.equal(batches[0].rows,null);assert.match(batches[0].error,/original query failed/);
});
test('original total grid guard is enforced before any ground query',async()=>{
 let called=false;await assert.rejects(()=>collectConstructorGrid(collector({bounds:{min:[-1000,0,-1000],max:[1000,300,1000],center:[0,150,0]},queryGround:()=>{called=true;return[];}}).options),/200000/);assert.equal(called,false);
});
test('ground envelope guards reject bypassed narrow and wide occupancy',()=>{
 const points=[{x:0,z:0}],rows=ground(points);rows[0].obstacleOccupancy.narrowHits[0]=0;assert.throws(()=>assertGroundRows(points,rows),/narrow occupancy/);
 rows[0].obstacleOccupancy.narrowHits[0]=null;rows[0].obstacleOccupancy.wideHits[1]=0;assert.throws(()=>assertGroundRows(points,rows),/wide occupancy/);
});
test('nonfinite blocked terrain height remains a raw observation, never a walkable point',()=>{
 const points=[{x:0,z:0}],rows=ground(points);Object.assign(rows[0],{height:NaN,walkable:false,planningClearance:0});rows[0].obstacleOccupancy.narrowHits=[0,0,0];rows[0].obstacleOccupancy.wideHits=[0,0,0];
 assertGroundRows(points,rows);assert(Number.isNaN(parseRaw(rawJson(rows))[0].height));rows[0].walkable=true;assert.throws(()=>assertGroundRows(points,rows));
});
