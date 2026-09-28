import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SpiritEncounters,type SpiritRider} from './elmwood-spirit-events.ts';
const rider=(x=0):SpiritRider=>({x,y:0,z:0,headingY:0,speed:3});
const place=(r:SpiritRider,seat:number,side:number)=>({...r,seat,side,heading:0});
test('one or two brief encounters per ride, with a long gap shared by both players',()=>{
  for(const random of [0,.9]){
    const events=new SpiritEncounters(()=>random),times:number[]=[];
    for(let i=0;i<12000;i++)if(events.update(.1,[rider(i*.3),rider(i*.3+10)],false,true,place))times.push(i*.1);
    assert.equal(times.length,random===0?1:2);if(times.length===2)assert.ok(times[1]-times[0]>=55);assert.equal(events.active,undefined);
  }
});
test('no encounter for standing still, pause, recovery jumps, unsafe ground or disabled setting',()=>{
  const events=new SpiritEncounters(()=>0);
  for(let i=0;i<1000;i++)events.update(.1,[rider()],false,true,place);
  assert.equal(events.seen,0);
  for(let i=0;i<1000;i++)events.update(.1,[rider(i*10)],false,true,place);
  assert.equal(events.seen,0);
  for(let i=0;i<1000;i++)events.update(.1,[rider(i*.3)],true,true,place);
  assert.equal(events.seen,0);
  for(let i=0;i<1000;i++)events.update(.1,[rider(i*.3)],false,true,()=>undefined);
  assert.equal(events.seen,0);
  assert.ok(events.update(.1,[rider(300)],false,true,place));const age=events.age;
  events.update(10,[rider(300)],true,true,place);assert.equal(events.age,age);
  events.update(.1,[rider(300)],false,false,place);assert.equal(events.active,undefined);assert.equal(events.seen,1);
  events.reset();assert.equal(events.seen,0);
});
