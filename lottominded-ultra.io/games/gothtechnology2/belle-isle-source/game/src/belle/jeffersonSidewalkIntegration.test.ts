import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RideCore} from '../../runtime/ride-core/src/ridecore.ts';
import {createGroundSample} from '../../runtime/ride-core/src/terrain.ts';
import {underpassCameraHeight} from '../../runtime/ride-core/src/cameraClearance.ts';
import {ParkTerrain,type ParkMap} from './terrain.ts';
import {createJeffersonSidewalkSurface,type JeffersonSidewalkData} from './jeffersonSidewalks.ts';

const map=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
// A compact ramp/slab fixture on a dry, unobstructed part of the actual mainland
// exercises the unchanged motor against ParkTerrain's composed ground sampler.
const fixture:JeffersonSidewalkData={schema:1,topOffsetM:.22,roadOffsetM:.07,tileSizeM:320,surfaces:[
 {id:'ramp',kind:'ramp',outer:[[-1502,837],[-1500,837],[-1500,843],[-1502,843]],
  ramp:{toe:[[-1502,837],[-1502,843]],crest:[[-1500,837],[-1500,843]]}},
 {id:'slab',kind:'sidewalk',outer:[[-1500,837],[-1496,837],[-1496,843],[-1500,843]]}
]};
function actualTerrain(){const terrain=new ParkTerrain(map,true),surface=createJeffersonSidewalkSurface(fixture,(x,z)=>terrain.height(x,z));terrain.registerPedestrianSupport(surface);return{terrain,surface};}

test('registered sidewalks raise sampled support while raw construction terrain and existing solids stay unchanged',()=>{
 const terrain=new ParkTerrain(map,true),before=JSON.stringify(terrain.boxes),raw=terrain.height(-1499,840);
 const surface=createJeffersonSidewalkSurface(fixture,(x,z)=>terrain.height(x,z));terrain.registerPedestrianSupport(surface);
 const ground=createGroundSample();terrain.sampleGround(-1499,840,ground);
 assert.ok(Math.abs(ground.height-raw-.22)<1e-6);assert.equal(ground.offCourse,false);
 assert.equal(terrain.height(-1499,840),raw,'construction elevations must not recursively include sidewalk tops');
 terrain.sampleGround(-1501,840,ground);
 assert.ok(Math.abs(ground.height-raw-.145)<1e-6);assert.ok(ground.normal.x<-.07&&ground.normal.y>.99);
 terrain.sampleGround(-1503,840,ground);assert.equal(ground.height,raw,'a source gap retains ordinary ground');
 assert.equal(JSON.stringify(terrain.boxes),before,'walkable curb tops add no wall collision or alter buildings');
 const floor=terrain.sampleGround(-1499,840,ground).height;
 assert.ok(underpassCameraHeight(terrain,{x:-1499,y:floor,z:840},floor+.1)>=floor+.35-1e-9,'camera clearance uses the supported floor');
 surface.dispose();terrain.sampleGround(-1499,840,ground);assert.equal(ground.height,raw);
});

test('the ordinary walking motor climbs and descends the ramp without a false jump or blocked curb',()=>{
 const {terrain,surface}=actualTerrain();
 const core=new RideCore(terrain,{spawn:{position:{x:-1503,y:2,z:840},headingY:Math.PI/2}});
 core.advance(1/60,{dismount:true,instantDismount:true});assert.equal(core.current.footMode,2);
 const sample=createGroundSample();let raised=false,ramp=false;
 for(let i=0;i<240&&core.current.x< -1497;i++){
  core.advance(1/60,{throttle:1});terrain.sampleGround(core.current.x,core.current.z,sample,core.current.y);
  assert.ok(Math.abs(core.current.y-sample.height)<1e-6,'the actual actor remains on the rendered support');
  assert.equal(core.current.footJump,0);assert.equal(core.controller.crashed,false);
  raised ||=core.current.y>2.21;ramp ||=core.current.y>2.08&&core.current.y<2.20;
 }
 assert.ok(core.current.x>=-1497&&raised&&ramp,'the motor traverses the ramp and raised slab');
 for(let i=0;i<240&&core.current.x> -1503;i++){
  core.advance(1/60,{throttle:1,facingYaw:-Math.PI/2});
  assert.equal(core.current.footJump,0);assert.equal(core.controller.crashed,false);
 }
 assert.ok(core.current.x<=-1503);assert.ok(Math.abs(core.current.y-2)<1e-6);surface.dispose();
});

test('the optional mainland layer cannot change island-only ground or turn water into land',()=>{
 for(const connected of [false,true]){
  const terrain=new ParkTerrain(map,connected),ground=createGroundSample();let calls=0;
  terrain.registerPedestrianSupport({sample(){calls++;throw Error('Unqualified support should never be queried');}});
  terrain.sampleGround(0,1000,ground);assert.equal(ground.offCourse,true);assert.equal(calls,0);
  if(!connected){terrain.sampleGround(map.spawn.x,map.spawn.z,ground);assert.equal(calls,0);assert.equal(ground.height,terrain.height(map.spawn.x,map.spawn.z));}
 }
});
