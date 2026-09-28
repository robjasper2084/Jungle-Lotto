import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ElmwoodSessionInput,setupError,type Pad} from './elmwood-session-input.ts';
import {ElmwoodRun,laneGates} from './elmwood-gameplay.ts';
import {ElmwoodCompanion} from './elmwood-companion.ts';
import {RideMotion} from './ride-motion.ts';
import type {TerrainSampler} from '../simulation/world.ts';
import {readFileSync} from 'node:fs';
import {bankHeight} from './elmwood-bank.ts';
const pad=(index:number):Pad=>({index,id:'Test pad '+index,connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({value:0,pressed:false}))});
const flat:TerrainSampler={sampleGround(_x,_z,out){out.height=0;out.normal={x:0,y:1,z:0};out.surface='pavement';out.offCourse=false;return out;},raycast(){return null;},raycastObstacle(){return null;}};
test('shared keyboard keeps two riders and edge actions independent',()=>{
  const i=new ElmwoodSessionInput();i.configure(['wasd','arrows']);i.key('KeyW',true);i.key('ArrowLeft',true);i.key('Enter',true);
  assert.equal(i.consume(0,0,1).actions.throttle,1);let p2=i.consume(1,0,1);assert.equal(p2.actions.throttle,0);assert.equal(p2.actions.steer,-1);assert.equal(p2.actions.hop,true);assert.equal(i.consume(1,0,1).actions.hop,false);
  i.key('KeyW',false);assert.equal(i.consume(0,0,1).actions.throttle,0);
});
test('two gamepads are unique, neutral-armed and pause safely on disconnect',()=>{
  const i=new ElmwoodSessionInput(),p0=pad(0),p1=pad(1);i.configure(['pad:0','pad:1']);assert.equal(setupError(i.bindings,[p0,p1]),'');assert.match(setupError(['pad:0','pad:0'],[p0]),/different/);
  p0.axes=[.8,-1];i.poll([p0,p1]);assert.equal(i.consume(0,0,1).actions.throttle,0);p0.axes=[0,0];i.poll([p0,p1]);p0.axes=[0,-1];p1.axes=[1,0];i.poll([p0,p1]);assert.equal(i.consume(0,0,1).actions.throttle,1);assert.equal(i.consume(1,0,1).actions.steer,1);assert.match(i.poll([p0,null]),/disconnected/);assert.equal(i.consume(0,0,1).actions.throttle,0);
});
test('keyboard plus gamepad and simultaneous touch sources stay independent',()=>{
  const i=new ElmwoodSessionInput(),p=pad(2);i.configure(['wasd','pad:2']);i.poll([null,null,p]);i.key('KeyW',true);p.buttons[0]={pressed:true,value:1};i.poll([null,null,p]);assert.equal(i.consume(0,0,1).actions.hop,false);assert.equal(i.consume(1,0,1).actions.hop,true);
  i.configure(['touch','touch']);i.stick(0,.8,1);i.stick(1,-.6,.5);i.touch(1,'crouch',true,'finger1');i.touch(1,'crouch',true,'finger2');i.touch(1,'crouch',false,'finger1');assert.equal(i.consume(0,0,1).actions.throttle,1);assert.ok(i.consume(1,0,1).actions.steer<0);assert.equal(i.consume(1,0,1).actions.crouch,true);i.clear();assert.equal(i.consume(1,0,1).actions.crouch,false);
});
test('cruise cancels on brake and pause clears held controls',()=>{
  const i=new ElmwoodSessionInput();i.key('KeyV',true);assert.ok(i.consume(0,0,1).actions.throttle>0);i.key('KeyS',true);assert.equal(i.consume(0,0,1).actions.throttle,-1);assert.equal(i.seats[0].cruise,false);i.clear();assert.equal(i.consume(0,0,1).actions.throttle,0);
});
test('route checkpoints are ordered, pause freezes time, recovery cannot skip gates',()=>{
  const gates=laneGates([[0,0],[0,-52],[26,-52]],26),r=new ElmwoodRun(gates);r.reset('sprint',{x:0,z:0});r.update(1,{x:26,z:52},[]);assert.equal(r.gate,1);r.relocate({x:0,z:22});r.update(1,{x:0,z:26},[]);assert.equal(r.gate,2);const t=r.elapsed;r.update(20,{x:0,z:52},[],true);assert.equal(r.elapsed,t);r.relocate({x:0,z:48});r.update(1,{x:0,z:52},[]);r.relocate({x:22,z:52});r.update(1,{x:26,z:52},[]);assert.equal(r.finished,true);assert.equal(r.score,300);
});
test('trick scores come from completed simulation events, and deadline closes the session',()=>{
  const r=new ElmwoodRun([]);r.reset('tricks',{x:0,z:0});r.update(1,{x:0,z:0},[{type:'trick',points:120,message:'Curb hop'}]);assert.equal(r.score,120);r.update(120,{x:0,z:0},[]);assert.equal(r.finished,true);r.update(1,{x:0,z:0},[{type:'trick',points:120,message:'Curb hop'}]);assert.equal(r.score,120);
});
test('trick tap between fixed ticks survives exactly once',()=>{
  const r=new RideMotion(flat);r.update(1/480,{trick:1});let points=0;for(let n=0;n<600;n++){r.update(1/120,{trick:0});points+=r.events.filter(e=>e.type==='trick').reduce((n,e)=>n+e.points,0);}assert.equal(points,120);
});
test('a stuck dog regroups in under a second and stays near a moving rider',()=>{
  let blocked=true;const dog=new ElmwoodCompanion({...flat,raycastObstacle(){return blocked?0:null;}}),r={x:0,z:0,headingY:0,speed:4};dog.reset(r);r.z=9;for(let n=0;n<60;n++)dog.update(r,1/60);assert.ok(dog.recoveries>=1);assert.ok(Math.hypot(dog.x-r.x,dog.z-r.z)<3);blocked=false;for(let n=0;n<600;n++){r.z+=7/60;r.speed=7;dog.update(r,1/60);}assert.ok(Math.hypot(dog.x-r.x,dog.z-r.z)<3);
});
test('Hammond cover joins the uphill ridge and the rider uses the authored bank height',()=>{
  const placements=JSON.parse(readFileSync(new URL('../../public/elmwood/placements.json',import.meta.url),'utf8'));
  const p=placements.find((p:{asset:string})=>p.asset==='hammond-bank-vault'),c=Math.cos(p.rotation),s=Math.sin(p.rotation);
  const at=(x:number,y:number)=>bankHeight(p,p.position[0]+c*x-s*y,p.position[1]+s*x+c*y);
  for(const y of [0,5,10,15,20])assert.ok(at(0,y)!-p.position[2]>3,`chamber cover stays continuous at ${y}m`);
  assert.equal(at(0,-6),undefined,'door approach stays open');assert.equal(at(30,5),undefined,'outside retains original terrain');
});
