import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DetroitWorld} from './world.ts';
import {GEO,profileLevel,toLocal,toMap} from './geo-profile.ts';
import {bridgeFrame} from './bridges.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {createGroundSample} from './terrain.ts';
import {RideController,NEUTRAL_ACTIONS,createPose} from './controller.ts';
import {DogFollower} from './companion.ts';
import {FollowCamera} from './followCamera.ts';

const pose=(sim:RideController)=>{const p=createPose();sim.writePose(p);return p;};
const world=await new DetroitWorld().init(),terrain=new GeoTerrain(world);
test('every bridge supports the rider and dog on top without moving underpass riders onto the roof',()=>{
  for(const b of GEO.bridges){
    const f=bridgeFrame(b),p=f.point((f.lo+f.hi)/2,(f.near+f.far)/2),top=profileLevel(b.at,'street');
    const lower=world.sampleGround(p.x,p.z,createGroundSample()).height;
    for(const below of [.5,.9,1.5])assert.ok(Math.abs(world.sampleGround(p.x,p.z,createGroundSample(),top-below).height-lower)<.04,b.name+' underside mistaken for rideable ground');
    const spawn=toLocal(p.x,top,p.z),sim=new RideController(terrain,{spawn:{position:spawn,headingY:0}});
    assert.ok(Math.abs(pose(sim).y-spawn.y)<.04,b.name+' rider sinks below deck');
    const dog=new DogFollower(terrain);dog.reset(pose(sim));
    const camera=new FollowCamera(terrain);camera.reset(pose(sim));
    for(let i=0;i<120;i++){sim.step(1/120,NEUTRAL_ACTIONS);dog.step(1/120,pose(sim));camera.step(1/120,pose(sim));}
    assert.ok(Math.abs(dog.current.y-spawn.y-.015)<.04,b.name+' dog sinks below deck');
    assert.ok(camera.eye.y>spawn.y+.35,b.name+' camera drops under deck');
    const under=new RideController(terrain,{spawn:{position:toLocal(p.x,lower,p.z),headingY:0}});
    assert.ok(Math.abs(pose(under).y-toLocal(p.x,lower,p.z).y)<.04,b.name+' underpass rider jumps to roof');
  }
});

test('EUC and dog cross all bridge approaches in both directions without dropping through the road',()=>{
  for(const b of GEO.bridges)for(const direction of [-1,1]){
    const f=bridgeFrame(b),middle=(f.near+f.far)/2,top=profileLevel(b.at,'street');
    const approach=world.geoMeshes.find(m=>'bridge' in m&&m.bridge===b.name&&m.kind==='approach')!;
    const vertices=approach.geometry.attributes.position;
    let lo=f.lo,hi=f.hi;
    for(let i=0;i<vertices.count;i++){const [along]=f.project(vertices.getX(i),vertices.getZ(i));lo=Math.min(lo,along);hi=Math.max(hi,along);}
    const start=direction>0?lo-1:hi+1,end=direction>0?hi+1:lo-1,a=f.point(start,middle),next=f.point(start+direction,middle);
    const sim=new RideController(terrain,{spawn:{position:toLocal(a.x,world.sampleGround(a.x,a.z,createGroundSample()).height,a.z),headingY:Math.atan2(a.x-next.x,next.z-a.z)}});
    const dog=new DogFollower(terrain);dog.reset(pose(sim));let crossed=false,deckSamples=0,dogSamples=0;
    for(let i=0;i<4800;i++){
      sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:.5});const p=pose(sim);dog.step(1/120,p);
      const map=toMap(p.x,p.y,p.z),[along]=f.project(map.x,map.z);
      assert.equal(sim.crashed,false,b.name+' direction '+direction+' at '+along+': '+sim.crashCause);
      if(along>f.lo+2&&along<f.hi-2){deckSamples++;assert.ok(map.y>=top-.04,b.name+' rider below road at '+along);}
      const dp=toMap(dog.current.x,dog.current.y,dog.current.z),[dogAlong]=f.project(dp.x,dp.z);
      if(dogAlong>f.lo+2&&dogAlong<f.hi-2){dogSamples++;assert.ok(dp.y>=top-.04,b.name+' dog below road at '+dogAlong);}
      if((along-end)*direction>=0){crossed=true;break;}
    }
    assert.ok(crossed&&deckSamples>20&&dogSamples>20,b.name+' did not cross full approaches');
  }
});

test('hop, clean landing and recovery retain Adelaide bridge support',()=>{
  const b=GEO.bridges.find(b=>b.name==='Adelaide Street')!,f=bridgeFrame(b),p=f.point((f.lo+f.hi)/2,(f.near+f.far)/2);
  const start=toLocal(p.x,profileLevel(b.at,'street'),p.z),sim=new RideController(terrain,{spawn:{position:start,headingY:0}});
  for(let i=0;i<600;i++)sim.step(1/120,{...NEUTRAL_ACTIONS,hop:i===120});
  assert.ok(sim.snapshot().hops===1&&sim.snapshot().landings===1,'hop and landing completed');
  assert.ok(Math.abs(pose(sim).y-start.y)<.04,'landing below bridge');
  sim.step(1/120,{...NEUTRAL_ACTIONS,reset:true});
  assert.ok(Math.abs(pose(sim).y-start.y)<.04,'recovery below bridge');
});

