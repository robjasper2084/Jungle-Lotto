import test from 'node:test';import assert from 'node:assert/strict';
import {PairSimulation,peerRay,riderProfile,coopFrameSeconds} from './simulation.ts';
import {assignPlayer,defaultPair,defaultSelection} from './coop.ts';
const command=(extra={})=>({throttle:0,steer:0,hop:false,recover:false,interact:false,brake:false,...extra});
const ground=()=>({sampleGround(x,z,out){Object.assign(out,{height:2,surface:'pavement',offCourse:false});out.normal={x:0,y:1,z:0};return out;},raycast(){return null;},raycastObstacle(){return null;},raycastFlight(){return null;},map:{water:[]},land(){return true;},height(){return 2;},obstructed(){return false;}});
const manifest=(a={},b={})=>{const p=defaultPair();return[assignPlayer(0,{...p[0],vehicleId:'euc',...a}),assignPlayer(1,{...p[1],riderId:'DS_Hoodie_Woman_01',vehicleId:'euc',...b})];};
const sim=(a={},b={})=>new PairSimulation(ground(),manifest(a,b),{x:10,y:2,z:10,heading:0});
test('two actual RideCore controllers and separately selected fit profiles',()=>{
 const s=sim({riderId:'DS_Mascot_Suit_01'},{});assert.notEqual(s.actors[0],s.actors[1]);assert.notEqual(s.actors[0].controller,s.actors[1].controller);
 assert.equal(s.actors[0].profile.motionScale,.48);assert.equal(s.actors[1].profile.motionScale,1);
 assert(riderProfile('DS_Man_01').footDownStop);assert.equal(riderProfile('DS_Mascot_Hoodie_01').footDownStop,false);
});
test('Player 1 movement never moves Player 2',()=>{
 const s=sim();const before=s.actors.map(c=>({...c.current}));
 // Turn away from the second player's spawn; only one command stream is active.
 for(let i=0;i<240;i++)s.advance(1/120,[command({throttle:1,steer:.15}),command()]);
 assert(Math.hypot(s.actors[0].current.x-before[0].x,s.actors[0].current.z-before[0].z)>1);
 assert(Math.hypot(s.actors[1].current.x-before[1].x,s.actors[1].current.z-before[1].z)<.01);
});
test('the selected city versus speed profile is applied to the motor, not only its label',()=>{
 const city=sim({vehicleId:'euc:city'}),speed=sim({vehicleId:'euc:speed'});
 for(const s of [city,speed])s.actors[1].reset({position:{x:500,y:2,z:500},headingY:0});
 for(let i=0;i<180;i++){city.advance(1/120,[command({throttle:1,steer:-.1}),command()]);speed.advance(1/120,[command({throttle:1,steer:-.1}),command()]);}
 assert(speed.actors[0].current.speed>city.actors[0].current.speed+.2);
});
test('pause freezes both complete simulation clocks and clears queued actions',()=>{
 const s=sim();s.advance(.25,[command({throttle:1}),command({throttle:-1})]);const before=s.actors.map(a=>a.snapshot());
 s.advance(4,[command({throttle:1,hop:true}),command({throttle:1})],true);assert.deepEqual(s.actors.map(a=>a.snapshot()),before);
});
test('each player can ride or walk without toggling their partner',()=>{
 const s=sim();s.advance(1/60,[command({interact:true}),command()]);for(let i=0;i<120;i++)s.advance(1/120,[command(),command()]);
 assert(s.actors[0].current.footBlend>.5);assert.equal(s.actors[1].current.footBlend,0);
});
test('recovering a rider chooses dry ground and maintains peer separation',()=>{
 const s=sim();const peer=s.actors[1].current;
 const placed=s.recover(0,{x:peer.x,y:peer.y,z:peer.z,heading:0});assert(Math.hypot(placed.x-peer.x,placed.z-peer.z)>2);
});
test('same input stream remains frame-rate independent at 30/60/120Hz',()=>{
 const results=[];for(const hz of [30,60,120]){const s=sim();for(let i=0;i<hz;i++)s.advance(1/hz,[command({throttle:1,steer:.1}),command({throttle:-1})]);results.push(s.actors.map(a=>({...a.current})));}
 for(const r of results.slice(1))for(let i=0;i<2;i++)for(const k of ['x','z','speed','headingY'])assert(Math.abs(r[i][k]-results[0][i][k])<1e-7,k);
});
test('swept peer collision catches a body before the ray endpoint, not another floor',()=>{
 const o={x:0,y:3,z:0},d={x:0,y:0,z:1},peer={x:0,y:2,z:4};assert(Math.abs(peerRay(o,d,6,peer,1)-3)<1e-8);assert.equal(peerRay(o,d,2,peer,1),null);assert.equal(peerRay({...o,y:8},d,6,peer,1),null);
});
test('overlapping bodies may back away but cannot continue further into a contact',()=>{
 assert.equal(peerRay({x:0,y:3,z:.5},{x:0,y:0,z:1},3,{x:0,y:2,z:1},1),0);
 assert.equal(peerRay({x:0,y:3,z:.5},{x:0,y:0,z:-1},3,{x:0,y:2,z:1},1),null);
});
test('head-on riders cannot pass through one another',()=>{
 const s=sim();const a=s.actors[0],b=s.actors[1];a.reset({position:{x:0,y:2,z:-6},headingY:0});b.reset({position:{x:0,y:2,z:6},headingY:Math.PI});let minimum=Infinity;
 for(let i=0;i<600;i++){s.advance(1/120,[command({throttle:1}),command({throttle:1})]);minimum=Math.min(minimum,Math.hypot(a.current.x-b.current.x,a.current.z-b.current.z));}
 assert(minimum>1.32,'players overlapped: '+minimum);assert(a.current.z<b.current.z,'players passed through each other');
});
test('bad frame times fail rather than introducing NaNs or endless stepping',()=>{
 const s=sim();for(const v of [NaN,Infinity,-1])assert.throws(()=>s.advance(v,[command(),command()]));s.advance(50,[command({throttle:1}),command()]);assert(Number.isFinite(s.actors[0].current.x));
});

test('co-op fixed ticks use bounded wall time rather than the presentation-only dt cap',()=>{
 assert.equal(coopFrameSeconds(.05,6000,1000),.25);
 assert.equal(coopFrameSeconds(.016,1016,1000),.016);
 assert.equal(coopFrameSeconds(.05,10000,0),.05);
});
test('pausing or an invalid/regressed clock cannot add catch-up simulation',()=>{
 assert.equal(coopFrameSeconds(.05,10000,1000,true),0);
 assert.equal(coopFrameSeconds(.05,1000,1100),0);
 assert.equal(coopFrameSeconds(NaN,NaN,0),0);
 assert.equal(coopFrameSeconds(.05,10000,0),.05);
});
test('slow renderer still advances both real controllers without an unbounded jump',()=>{
 const s=sim({riderId:'DS_Man_01',vehicleId:'euc:city'});s.advance(.05,[command(),command()]);const before=s.actors.map(c=>({...c.current}));
 for(let i=1;i<=8;i++)s.advance(coopFrameSeconds(.05,1000+i*15000,1000+(i-1)*15000),[command({throttle:-1}),command()]);
 assert(Math.hypot(s.actors[0].current.x-before[0].x,s.actors[0].current.z-before[0].z)>.12);
 assert(Math.hypot(s.actors[1].current.x-before[1].x,s.actors[1].current.z-before[1].z)<.01);
 assert(Math.hypot(s.actors[0].current.x-before[0].x,s.actors[0].current.z-before[0].z)<6);
});

const mixed=()=>new PairSimulation(ground(),Array.from({length:4},(_,i)=>assignPlayer(i,{...defaultSelection(i),vehicleId:i%2?'euc':'hoverbike'})),{x:10,y:2,z:10,heading:0});
test('four players can fly and ride simultaneously without moving idle partners',()=>{const s=mixed(),before=s.actors.map(c=>({...c.current}));s.advance(1/60,[command({hop:true}),command(),command(),command()]);for(let i=0;i<240;i++)s.advance(1/120,[command({throttle:1}),command({throttle:1}),command(),command()]);assert(s.hovers[0].flying);assert(s.actors[0].current.y>3);assert(Math.hypot(s.actors[0].current.x-before[0].x,s.actors[0].current.z-before[0].z)>1);assert(Math.hypot(s.actors[1].current.x-before[1].x,s.actors[1].current.z-before[1].z)>.5);for(const i of [2,3])assert(Math.hypot(s.actors[i].current.x-before[i].x,s.actors[i].current.z-before[i].z)<.01);});
test('recover resets only that hoverbike, clears its queued takeoff and respects all peers',()=>{const s=mixed();s.advance(.02,[command({hop:true}),command(),command(),command()]);const peers=s.actors.slice(1).map(a=>({...a.current}));s.advance(.02,[command({recover:true,hop:true,throttle:1}),command(),command(),command()]);assert.equal(s.hovers[0].flying,false);assert.equal(s.hovers[0].pose.speed,0);for(let i=1;i<4;i++){assert.equal(s.actors[i].current.x,peers[i-1].x);assert(Math.hypot(s.actors[0].current.x-s.actors[i].current.x,s.actors[0].current.z-s.actors[i].current.z)>2);}});
test('landed hover dismount and remount preserve partner vehicles',()=>{const s=mixed();s.advance(.02,[command({interact:true}),command(),command(),command()]);assert.equal(s.mounted[0],false);for(let i=0;i<60;i++)s.advance(1/120,[command(),command(),command(),command()]);s.advance(.02,[command({interact:true}),command(),command(),command()]);assert.equal(s.mounted[0],true);assert.equal(s.hovers[2].landed,true);assert.equal(s.actors[1].current.footBlend,0);});
test('bad input counts fail before any player simulation advances',()=>{const s=mixed();assert.throws(()=>s.advance(.1,[command(),command()]));});
