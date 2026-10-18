import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SplitRideInput} from './splitInput.ts';
import {ElmwoodSessionInput} from '../../../elmwood-source/src/detroit/elmwood-session-input.ts';

test('Swoop touch double push locks only the local rider and preserves steering',()=>{
 const input=new SplitRideInput(['wasd','arrows']);for(let n=0;n<30;n++)input.poll([],[8,5],1/120);
 const t=input.touch[0];t.startStick(1);t.moveStick(1,0,1);input.consume(0);t.endStick(1);input.consume(0);
 t.startStick(2);t.moveStick(2,0,1);input.consume(0);assert.deepEqual(input.cruising,[true,false]);
 t.moveStick(2,.8,0);assert.ok(input.consume(0).steer>.5);assert.equal(input.cruising[0],true);
 t.endStick(2);assert.equal(input.consume(0).throttle,0);input.poll([],[7,5],1/120);assert.ok(input.consume(0).throttle>0);
 t.press('brake',3);assert.equal(input.consume(0).throttle,-1);assert.equal(input.cruising[0],false);
});
test('Elmwood floating, split and online input locks actual speed and cancels on dismount',()=>{
 const input=new ElmwoodSessionInput();input.configure(['touch','touch']);
 input.stick(1,0,1);input.consume(1,4,1);input.stick(1,0,0);input.consume(1,4,1);input.stick(1,0,1);input.consume(1,6,1);
 assert.equal(input.seats[1].cruiseControl.targetSpeed,6);assert.equal(input.seats[0].cruise,false);
 input.stick(1,.9,0);assert.ok(input.consume(1,5,1).actions.steer>.5);assert.ok(input.consume(1,5,1).actions.throttle>0);
 input.consume(1,5,1,false);assert.equal(input.seats[1].cruise,false);
 input.stick(1,0,1);input.consume(1,5,1);assert.equal(input.seats[1].cruise,false);
});
