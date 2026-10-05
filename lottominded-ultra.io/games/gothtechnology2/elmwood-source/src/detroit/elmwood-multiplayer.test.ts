import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPose,NEUTRAL_ACTIONS} from '@digital-static/ridecore';
import {ElmwoodSessionInput,setupError} from './elmwood-session-input.ts';
import {roomMatch,roomFrame,roomRoster,fillRaceRoster,type RoomMember} from './onlineProtocol.ts';
test('four keyboard riders keep throttle, steering and recovery independent',()=>{
 const input=new ElmwoodSessionInput();input.configure(['wasd','arrows','ijkl','numpad']);
 input.key('KeyW',true);input.key('ArrowLeft',true);input.key('KeyK',true);input.key('Numpad0',true);
 const packets=[0,1,2,3].map(i=>input.consume(i,0,1));
 assert.equal(packets[0].actions.throttle,1);assert.equal(packets[1].actions.steer,-1);
 assert.equal(packets[2].actions.throttle,-1);assert.equal(packets[3].actions.hop,true);
 assert.equal(packets[0].actions.hop,false);assert.equal(input.consume(3,0,1).actions.hop,false);
 input.key('KeyY',true);assert.equal(input.consume(2,0,1).recover,true);assert.equal(input.consume(0,0,1).actions.throttle,1);
 assert.equal(setupError(['wasd','arrows','ijkl','numpad'],[]),'');assert.notEqual(setupError(['wasd','wasd'],[]),'');
});
test('Elmwood rooms preserve chosen heroes and validate match, map and frame ownership',()=>{
 const host='11111111-1111-4111-8111-111111111111',guest='22222222-2222-4222-8222-222222222222';
 const roster:RoomMember[]=[{id:host,rider:'DS_Armored_Rider_01',joined:1,host:true},{id:guest,rider:'DS_Hoodie_Woman_01',joined:2,host:false}];
 assert.deepEqual(roomRoster(roster,host).map(r=>r.rider),['DS_Armored_Rider_01','DS_Hoodie_Woman_01']);
 const match={id:'33333333-3333-4333-8333-333333333333',owner:host,map:'elmwood',mode:'race',spawn:0,seed:42,startAt:Date.now()+3000,members:fillRaceRoster(roster,host),botFill:true,difficulty:'expert'};
 assert.equal(roomMatch(match,roster,host,'elmwood',['free','race','tour','tricks'])?.members.length,4);
 assert.equal(roomMatch({...match,map:'cut'},roster,host,'elmwood',['race']),undefined);
 assert.equal(roomMatch({...match,members:match.members.slice(0,3)},roster,host,'elmwood',['race']),undefined);
 const frame={match:match.id,seq:1,elapsed:1,countdown:0,done:false,riders:match.members.map(()=>({pose:createPose(),gate:1,station:0,finish:null,missed:false,banked:0,message:'Riding',crashed:false}))};
 assert.ok(roomFrame(frame,4,match.id,0));assert.equal(roomFrame(frame,4,match.id,1),undefined);
 frame.riders[1].pose.x=Infinity;assert.equal(roomFrame(frame,4,match.id,0),undefined);
 assert.equal(NEUTRAL_ACTIONS.throttle,0);
});
