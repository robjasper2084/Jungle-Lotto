import test from 'node:test';import assert from 'node:assert/strict';import R from '@dimforge/rapier3d-compat';
import {TagTerrain,type TagFixture} from '../src/tag/fixture.ts';
import {RideController,NEUTRAL_ACTIONS} from '../src/controller.ts';
await R.init();
const world=new R.World({x:0,y:0,z:0}),bits=Buffer.alloc(Math.ceil(81/8),255);
for(let j=0;j<9;j++)bits[(j*9+5)>>3]&=~(1<<((j*9+5)&7));
const f:TagFixture={version:1,product:'elmwood-explorer',arena:'boundary-regression',revision:'test',hash:'test',physicsVersion:'0.20.0',transform:{sx:1,tx:0,ty:0,tz:0},physics:Buffer.from(world.takeSnapshot()).toString('base64'),walkable:bits.toString('base64'),grid:{x:0,z:0,width:9,height:9,spacing:1,heights:Array(81).fill(0)},lanes:[],spawns:[{position:{x:3,y:0,z:4},headingY:Math.PI/2}]};world.free();
test('mounted movement stops before unsupported ground and can reverse away',async()=>{
 const terrain=await TagTerrain.create(f),rider=new RideController(terrain,{spawn:f.spawns[0]});
 for(let n=0;n<360;n++){rider.step(1/60,{...NEUTRAL_ACTIONS,throttle:1});assert(terrain.legal(rider.poseValue));}
 const stopped=rider.poseValue.x;assert(stopped<4);assert.equal(rider.crashed,false);
 for(let n=0;n<240;n++)rider.step(1/60,{...NEUTRAL_ACTIONS,throttle:-1});
 assert(rider.poseValue.x<stopped-.5);assert(terrain.legal(rider.poseValue));terrain.dispose();
});
test('water/support boundaries do not replace real heart or sight collision',async()=>{
 const terrain=await TagTerrain.create(f),origin={x:3.6,y:1.05,z:4},direction={x:1,y:0,z:0};
 assert.notEqual(terrain.raycastObstacle(origin,direction,3,.28),null);
 assert.equal(terrain.raycastObstacle(origin,direction,3,.14),null);
 assert.equal(terrain.raycastObstacle(origin,direction,3,0),null);terrain.dispose();
});
