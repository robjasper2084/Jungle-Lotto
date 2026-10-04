import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BalanceEngine} from './balanceEngine.ts';
import {RIDE_TUNING as tune} from './rideDynamics.ts';
const dt=1/120;
const command={steer:1,speed:12,grounded:true,crouch:false,grip:.9};

test('the rider shifts weight and banks before reaching the steady turning arc',()=>{
  const b=new BalanceEngine();let first=b.step(dt,command);
  for(let i=0;i<12;i++)first=b.step(dt,command);
  assert.ok(first.weightShift<-.01&&first.bank<0&&first.yawRate<0);
  const achievedLateral=Math.abs(first.yawRate*command.speed);
  const bankLateral=tune.gravity*Math.abs(Math.tan(first.bank));
  assert.ok(achievedLateral<bankLateral,'yaw should follow the lean during turn-in');
});
test('high-speed steering stays within the tyre grip and the bank limit',()=>{
  for(const speed of [6,12,21.8])for(const grip of [.14,.6,.9])for(const eyeControl of [false,true]){
    const b=new BalanceEngine();
    for(let i=0;i<720;i++){
      const p=b.step(dt,{...command,speed,grip,eyeControl,steer:i<360?1:-1});
      assert.ok(Math.abs(p.lateralAcceleration)<=tune.gravity*grip+1e-6);
      assert.ok(Math.abs(p.bank)<=tune.maxLean+1e-6);
    }
  }
});

test('eye-mode carves respond to partial stick and reverse sooner without stronger full lock',()=>{
  const reverse=(eyeControl:boolean)=>{
    const b=new BalanceEngine(),input={...command,speed:6,steer:-.5,eyeControl};
    for(let i=0;i<120;i++)b.step(dt,input);
    for(let i=1;i<=120;i++)if(b.step(dt,{...input,steer:.5}).yawRate<0)return i*dt;
    return Infinity;
  };
  assert.ok(reverse(true)+.04<reverse(false));
  const turn=(steer:number,eyeControl:boolean)=>{const b=new BalanceEngine();let p;for(let i=0;i<240;i++)p=b.step(dt,{...command,speed:6,steer,eyeControl});return Math.abs(p!.yawRate);};
  assert.ok(turn(.5,true)>turn(.5,false)*1.25);
  assert.ok(Math.abs(turn(1,true)-turn(1,false))<.001);
  assert.equal(turn(.03,true),0);
});
test('release returns the wheel upright without a lingering yaw or pose offset',()=>{
  const b=new BalanceEngine();for(let i=0;i<240;i++)b.step(dt,command);
  let p=b.step(dt,{...command,steer:0});
  for(let i=0;i<240;i++)p=b.step(dt,{...command,steer:0});
  assert.ok(Math.abs(p.bank)<1e-5&&Math.abs(p.yawRate)<1e-5&&Math.abs(p.weightShift)<1e-5);
});
test('reverse changes wheel travel direction while keeping a matching lean into the arc',()=>{
  const a=new BalanceEngine(),b=new BalanceEngine();let f=a.step(dt,{...command,speed:3}),r=b.step(dt,{...command,speed:-3});
  for(let i=0;i<600;i++){f=a.step(dt,{...command,speed:3});r=b.step(dt,{...command,speed:-3});}
  assert.ok(Math.abs(f.bank-r.bank)<1e-9);assert.ok(Math.abs(f.yawRate+r.yawRate)<1e-9);
});
test('centred and small analogue commands produce proportionate curves, with no dead steering step',()=>{
  const rates=[0,.05,.15,.5,1].map(steer=>{const b=new BalanceEngine();let p=b.step(dt,{...command,steer});for(let i=0;i<360;i++)p=b.step(dt,{...command,steer});return Math.abs(p.yawRate);});
  assert.equal(rates[0],0);for(let i=1;i<rates.length;i++)assert.ok(rates[i]>rates[i-1]);
  assert.ok(rates[1]<rates[4]*.1);
});
