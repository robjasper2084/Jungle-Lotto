import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOG_GAITS,gaitCadence,gaitWeights,pawContact} from './dogGait.ts';

test('walk keeps support, trot uses diagonal pairs, and gallop has two flight windows',()=>{
  let trotFlight=0,runFlight=0,runFlights=0,wasAir=[0,1,2,3].every(leg=>pawContact(6.5,.9995,leg)<.01);
  for(let i=0;i<1000;i++){
    const phase=(i+.5)/1000;
    assert.ok([0,1,2,3].filter(leg=>pawContact(1,phase,leg)>.5).length>=2,'walk must not hop');
    assert.equal(pawContact(3,phase,0),pawContact(3,phase,3));
    assert.equal(pawContact(3,phase,1),pawContact(3,phase,2));
    if([0,1,2,3].every(leg=>pawContact(3,phase,leg)<.01))trotFlight++;
    const air=[0,1,2,3].every(leg=>pawContact(6.5,phase,leg)<.01);
    if(air){runFlight++;if(!wasAir)runFlights++;}wasAir=air;
  }
  assert.ok(trotFlight>100&&trotFlight<200,'trot has short suspension between diagonal contacts');
  assert.equal(runFlights,2);
  assert.ok(runFlight>250&&runFlight<400,'gallop must release the ground between front and hind support');
});

test('stride cadence matches ground distance without frantic running steps',()=>{
  for(const [speed,index] of [[1,1],[3,2],[6.5,3]]){
    const gait=DOG_GAITS[index];
    assert.ok(Math.abs(gaitCadence(speed)*2*gait.stride/gait.duty-speed)<1e-8);
  }
  assert.ok(gaitCadence(6.5)>2.4&&gaitCadence(6.5)<2.8);
  assert.equal(gaitCadence(0),0);
  for(let speed=0;speed<8;speed+=.01)assert.ok(Math.abs(gaitWeights(speed).reduce((a,b)=>a+b,0)-1)<1e-12);
});
