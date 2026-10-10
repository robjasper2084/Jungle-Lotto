import test from 'node:test';import assert from 'node:assert/strict';
import {RideController,NEUTRAL_ACTIONS} from '../src/controller.ts';
import {RIDE_TUNING} from '../src/rideDynamics.ts';
import {TagMatch,TAG_RULES,neutralCommand,sphereTOI} from '../src/tag/rules.ts';
import type {TagFixture} from '../src/tag/fixture.ts';
import type {TerrainSampler} from '../src/terrain.ts';
import {TagNavigation} from '../src/tag/navigation.ts';
import {resumeTagInput} from '../src/tag/inputCursor.ts';
const fixture:TagFixture={version:1,product:'swoop-detroit',arena:'test',revision:'test',hash:'test',physicsVersion:'0.20.0',transform:{sx:1,tx:0,ty:0,tz:0},physics:'',grid:{x:-20,z:-20,width:81,height:81,spacing:.5,heights:Array(81*81).fill(0)},lanes:[{a:{x:0,y:0,z:-20},b:{x:0,y:0,z:20},width:12}],spawns:Array.from({length:8},(_,i)=>({position:{x:i%2?3:-3,y:0,z:i*3},headingY:0}))};
const terrain:TerrainSampler={sampleGround(_x,_z,out){out.height=0;Object.assign(out.normal,{x:0,y:1,z:0});out.surface='pavement';out.offCourse=false;return out;},raycast(){return null;},raycastObstacle(){return null;}};
test('bots cannot route toward the nearest rejected isolated map endpoint',()=>{
 const f={...fixture,navigation:{nodes:[{x:0,y:0,z:0},{x:3,y:0,z:0},{x:8,y:0,z:0}],edges:[[1,2,5],[2,1,5]] as [number,number,number][]}};
 const nav=new TagNavigation(f,terrain);assert.equal(nav.nearest({x:.01,y:0,z:0}),1);
 assert.deepEqual(nav.reachable({x:.01,y:0,z:0}),f.navigation.nodes.slice(1));
 assert(nav.path({x:.01,y:0,z:0},{x:8,y:0,z:0}).every(p=>p.x>=3));
});
function match(rules:'classic'|'spread'='classic'){const m=new TagMatch(fixture,terrain,rules,'normal',1);for(let i=0;i<4;i++)m.addActor('p'+i,'Player '+i);m.start('round');return m;}
function at(m:TagMatch,id:number,x:number,z:number,y=0){const a=m.actors[id];a.controller.reset({position:{x,y,z},headingY:0});const state=a.controller.captureState();state.fields.pose.y=y;a.controller.restoreState(state);a.previous={...a.controller.poseValue};}
function advance(m:TagMatch,t:number){for(let i=0;i<Math.round(t*60);i++)m.step();}
test('rejoined client moves and fires immediately after a long input history',()=>{
 const m=match();advance(m,6.1);const a=m.actors[0];at(m,0,0,0);at(m,1,8,15);
 for(let seq=1;seq<=4000;seq++)assert(m.command(a.id,neutralCommand(m.round,seq,m.tick)));
 a.lastShotId=8000;
 const cursor=resumeTagInput(m.snapshot(a.id).actors.find(p=>p.id===a.id)!.ack);
 assert.equal(m.command(a.id,{...neutralCommand(m.round,1,m.tick),throttle:1}),false);
 assert(m.command(a.id,{...neutralCommand(m.round,++cursor.seq,m.tick),throttle:1,fire:true,shot:++cursor.shot}));
 m.step();assert.equal(a.ack,4001);assert.equal(a.ammo,2);assert(a.controller.poseValue.speed>0);
 assert(m.events.some(e=>e.kind==='shot'&&e.actor===a.id));
 m.start('rematch');assert.deepEqual(resumeTagInput(m.snapshot(a.id).actors[0].ack),{seq:0,shot:0});
 assert.throws(()=>resumeTagInput(NaN));
});
test('snapshot JSON restore replays all controller state, airborne, springs and trick state',()=>{const a=new RideController(terrain,{tuning:{maxSpeed:10}}),b=new RideController(terrain,{tuning:{maxSpeed:10}});
  for(let i=0;i<100;i++)a.step(1/60,{...NEUTRAL_ACTIONS,throttle:1,steer:.2,hop:i===90});
  b.restoreState(JSON.parse(JSON.stringify(a.captureState())));for(let i=0;i<180;i++){const c={...NEUTRAL_ACTIONS,throttle:i<90?1:-1,steer:Math.sin(i*.02)*.4};a.step(1/60,c);b.step(1/60,c);}assert.deepEqual(b.captureState(),a.captureState());});
test('handling injection leaves default controller tuning unchanged',()=>{const normal=new RideController(terrain),tag=new RideController(terrain,{tuning:{maxSpeed:10,hopSpeed:3.5}});assert.equal(normal.captureState().fields.tuning.maxSpeed,RIDE_TUNING.maxSpeed);assert.equal(tag.captureState().fields.tuning.maxSpeed,10);tag.setHandling({maxSpeed:13});assert.equal(normal.captureState().fields.tuning.maxSpeed,21.8);});
test('relative swept collision catches moving crossings and rejects elevation separation',()=>{assert.notEqual(sphereTOI({x:-2,y:1,z:0},{x:2,y:1,z:0},{x:0,y:1,z:-2},{x:0,y:1,z:2},.64),null);assert.equal(sphereTOI({x:-2,y:1,z:0},{x:2,y:1,z:0},{x:0,y:5,z:0},{x:0,y:5,z:0},.64),null);});
test('Classic transfer, locks and stale projectile epoch enforce one It',()=>{const m=match();at(m,0,0,0);at(m,1,0,2);at(m,2,8,15);at(m,3,-8,15);advance(m,6.1);const c={...neutralCommand('round',1,m.tick),fire:true,shot:1};assert(m.command('p0',c));advance(m,.1);assert.equal(m.actors.filter(a=>a.role==='it').length,1);assert.equal(m.actors[1].role,'it');assert.equal(m.actors[0].role,'runner');assert.equal(m.actors[0].tags,1);assert(m.actors[1].lock>m.time);assert.equal(m.hearts.length,0);assert.equal(m.command('p0',c),false);});
test('wall at muzzle blocks a heart and does not confirm a tag',()=>{const wall={...terrain,raycastObstacle(){return 0;}};const m=new TagMatch(fixture,wall,'classic');m.addActor('p0','P0');m.addActor('p1','P1');m.start('round');at(m,0,0,0);at(m,1,0,2);advance(m,6.1);m.command('p0',{...neutralCommand('round',1,m.tick),fire:true,shot:1});advance(m,.1);assert.equal(m.actors[1].role,'runner');assert.equal(m.hearts.length,0);assert(m.events.some(e=>e.kind==='blocked'));assert.equal(m.actors[0].ammo,2);});
test('Spread final catch precedes deterministic result and no caught runner returns',()=>{const m=match('spread');at(m,0,0,0);at(m,1,0,.5);at(m,2,0,.6);at(m,3,0,.7);advance(m,6.1);assert.equal(m.phase,'results');assert(m.actors.every(a=>a.role==='it'));assert.equal(m.winners.length,4);});
test('head start disables It movement and tagging; resources regenerate only active',()=>{const m=match();m.actors[0].ammo=1;m.actors[0].regen=.75;m.command('p0',{...neutralCommand('round',1,0),throttle:1,fire:true,shot:1});advance(m,5.9);assert.equal(m.actors[0].controller.poseValue.speed,0);assert.equal(m.actors[0].ammo,1);assert.equal(m.actors[0].regen,.75);});
test('forged, stale, duplicate, nonfinite and overbound commands rejected',()=>{const m=match(),a=m.actors[0],c=neutralCommand('round',1,0);for(const forged of [{...c,throttle:NaN},{...c,steer:2},{...c,round:'other'},{...c,tick:1000},{...c,aimYaw:3}])assert.equal(m.command(a.id,forged),false);assert(m.command(a.id,c));assert.equal(m.command(a.id,c),false);assert.equal(m.command('unknown',{...c,seq:2}),false);});
test('manual reset preserves ammunition and burst, incurs penalty and role',()=>{const m=match();advance(m,6.1);const a=m.actors[1];a.ammo=1;a.burst=40;m.reset(a);assert.equal(a.role,'it');assert.equal(a.resets,1);assert.equal(a.ammo,1);assert.equal(a.burst,40);assert.equal(m.actors.filter(a=>a.role==='it').length,1);});
test('three minute canonical rules and heart speed are unchanged',()=>{assert.equal(TAG_RULES.duration,180);assert.equal(TAG_RULES.speed,24);assert.equal(TAG_RULES.range,24);assert.equal(TAG_RULES.shotInterval,.7);});
test('batched network commands preserve one-shot actions until one simulation tick consumes them',()=>{
 const m=match('spread');advance(m,6.1);const a=m.actors[1];
 assert(m.command(a.id,{...neutralCommand('round',1,m.tick),reset:true,hop:true,burst:true,steer:.5}));
 assert(m.command(a.id,{...neutralCommand('round',2,m.tick),steer:-.25}));
 assert.equal(a.input.steer,-.25);assert.equal(a.input.hop,true);assert.equal(a.input.burst,true);assert.equal(a.input.reset,true);
 m.step();assert.equal(a.resets,1);assert.equal(a.role,'it');assert.equal(a.input.reset,false);assert.equal(a.input.hop,false);assert.equal(a.input.burst,false);
 m.step();assert.equal(a.resets,1);
 assert(m.command(a.id,{...neutralCommand('round',3,m.tick),reset:true}));m.release(a.id);m.step();assert.equal(a.resets,1);
});
