import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RideController,NEUTRAL_ACTIONS} from '../src/controller.ts';
import type {TerrainSampler} from '../src/terrain.ts';

function terrain(height:(x:number,z:number)=>number):TerrainSampler{
  return {sampleGround(x,z,out){
    out.height=height(x,z);out.surface='pavement';out.offCourse=false;
    // Same finite-difference footprint as the standalone Elmwood terrain.
    const nx=(height(x-.25,z)-height(x+.25,z))/.5,nz=(height(x,z-.25)-height(x,z+.25))/.5,n=Math.hypot(nx,1,nz);
    Object.assign(out.normal,{x:nx/n,y:1/n,z:nz/n});return out;
  },raycast:()=>null,raycastObstacle:()=>null};
}

test('ordinary curbs on grades stay grounded in forward, reverse and diagonal turns',()=>{
  for(const hz of [30,120])for(const curb of [.15,.25])for(const grade of [-.12,.12])for(const throttle of [-1,1])for(const heading of [0,.6]){
    const ground=terrain((_x,z)=>Math.max(0,z-2)*grade+((z>=4&&z<4.45)||(z>=8&&z<11)?curb:0));
    const sim=new RideController(ground,{spawn:{position:{x:0,y:0,z:0},headingY:heading+(throttle<0?Math.PI:0)}});
    sim.step(1/hz,NEUTRAL_ACTIONS); // Release the brake before requesting reverse.
    let crossed=false;
    for(let i=0;i<hz*8;i++){
      const steer=i<hz?0:Math.floor(i/(hz*.4))%2===0?.18:-.18;
      sim.step(1/hz,{...NEUTRAL_ACTIONS,throttle,steer});const s=sim.snapshot();
      assert.equal(s.crashed,false,`${hz} Hz, curb ${curb}, grade ${grade}, throttle ${throttle}: ${s.crashCause}`);
      assert.equal(s.grounded,true,`${hz} Hz, curb ${curb}, grade ${grade}, throttle ${throttle}, z=${s.position.z}: false takeoff`);
      if(s.position.z>11.5){crossed=true;break;}
    }
    assert.ok(crossed,`crossed both curbs: ${hz} Hz, curb ${curb}, grade ${grade}, throttle ${throttle}, heading ${heading}: ${JSON.stringify(sim.snapshot().position)}`);assert.equal(sim.snapshot().landings,0);
  }
});

test('real ledges and deliberate hops still leave the ground',()=>{
  const sim=new RideController(terrain((_x,z)=>z<5?1:0),{spawn:{position:{x:0,y:1,z:0},headingY:0}});
  let airborne=false;for(let i=0;i<600;i++){sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:.5});airborne ||= !sim.snapshot().grounded;}
  assert.ok(airborne);assert.ok(sim.snapshot().landings>0);
  const hop=new RideController(terrain(()=>.15));hop.step(1/120,{...NEUTRAL_ACTIONS,hop:true});
  for(let i=0;i<30;i++)hop.step(1/120,NEUTRAL_ACTIONS);
  assert.equal(hop.snapshot().hops,1);assert.equal(hop.snapshot().grounded,false);
});
