import test from 'node:test';
import assert from 'node:assert/strict';
import {neutral} from '../../../../ride-core/src/royale/rules.ts';
import {RideController,NEUTRAL_ACTIONS} from '../../../../ride-core/src/controller.ts';
import type {TerrainSampler} from '../../../../ride-core/src/terrain.ts';
import {photographyInput} from './cameraCapture.ts';
import {pacedFootCommand} from './movementIntent.ts';
import {FootAim} from './footAim.ts';
const flat:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,{height:0,normal:{x:0,y:1,z:0},offCourse:false,surface:'pavement'});},raycast:()=>null,raycastObstacle:()=>null};
const context={onFoot:true,keyboard:false,brawling:false,reloading:false};
test('camera, drawn weapon and holstered equipment keep identical analog walk/run and turning',()=>{
 const actors=Array.from({length:3},()=>{const controller=new RideController(flat);controller.combatOnFoot=true;controller.knockOff();for(let i=0;i<110;i++)controller.step(1/120,NEUTRAL_ACTIONS);return {controller,aim:new FootAim()};});
 for(let i=0;i<600;i++)for(const [j,a]of actors.entries()){
  a.aim.sync(a.controller.poseValue);let c={...neutral(''),throttle:i<300?i/300:1,steer:i<200?.35:0,holster:j===2};if(j===0)c=photographyInput({...c,fire:true});
  c.facingYaw=a.aim.commandYaw({aimMode:c.aimMode,fire:c.fire,lean:c.lean,brawl:false});c=pacedFootCommand(c,context);
  a.controller.step(1/120,{...NEUTRAL_ACTIONS,throttle:c.throttle,steer:c.steer,run:c.burst,facingYaw:c.facingYaw??undefined});
 }
 for(const a of actors.slice(1))for(const key of ['x','z','speed','headingY','footCycle'] as const)assert.equal(a.controller.poseValue[key],actors[0].controller.poseValue[key]);
 assert(actors[0].controller.poseValue.speed>5,'full analog input runs with the camera out');
});
test('deliberate ADS, lean, crouch and reload still suppress automatic sprint; keyboard keeps Shift control',()=>{
 const base={...neutral(''),throttle:1};assert(pacedFootCommand(base,context).burst);
 for(const change of [{aimMode:2},{lean:1},{crouch:true},{reload:true},{fire:true}])assert(!pacedFootCommand({...base,...change},context).burst);
 assert(!pacedFootCommand(base,{...context,keyboard:true}).burst);assert(pacedFootCommand({...base,burst:true},{...context,keyboard:true}).burst);
});
