import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DetroitWorld} from './world.ts';
import {CITY} from './geography.ts';
import {drapeStreet,streetElevation} from './street-geometry.ts';
import {createGroundSample} from './terrain.ts';
import {GEO,profileLevel,toLocal} from './geo-profile.ts';
import {bridgeFrame} from './bridges.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {RideController,NEUTRAL_ACTIONS,createPose} from './controller.ts';
import {DogFollower} from './companion.ts';

test('a raised street transition blocks the wheel instead of letting it enter beneath the surface',async()=>{
  const world=new DetroitWorld();world.chunks=[{x:0,z:0,vertices:new Float32Array([-10,0,-10,10,0,-10,-10,0,30,10,0,30]),indices:new Uint32Array([0,2,1,1,2,3]),surfaces:[]}];world.solids=[];world.geoMeshes=[];world.buildingMeshes=[];
  await world.init();
  world.addRideSurface(new Float32Array([-5,0,5,-5,1.5,5.5,5,0,5,5,0,5,-5,1.5,5.5,5,1.5,5.5,-5,1.5,5.5,-5,1.5,25,5,1.5,5.5,5,1.5,5.5,-5,1.5,25,5,1.5,25]));world.step();
  const sim=new RideController(world,{spawn:{position:{x:0,y:0,z:0},headingY:0}});
  for(let i=0;i<720;i++){
    sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});const p=sim.snapshot().position;
    assert.ok(p.z<5.5||p.y>=1.49,'wheel passed through the slope and underneath its road');
  }
  assert.ok(sim.snapshot().position.z<5.5,'unrideable step must stop forward travel');
  world.physics.free();
});

test('Mapped street ribbons match collision beyond the structural bridge footprint',async()=>{
  const world=await new DetroitWorld().init(),probes:{x:number;y:number;z:number}[]=[];
  for(const road of CITY.roads.filter(r=>['East Jefferson Avenue','Adelaide Street','Division Street','Gratiot Avenue'].includes(r.name)))for(let i=1;i<road.points.length;i++){
    const a=road.points[i-1],b=road.points[i];
    const pieces=drapeStreet({a:{x:a[0],z:a[1]},b:{x:b[0],z:b[1]},half:road.width/2,offset:0,lift:.035},world.chunks,(x,z,y)=>streetElevation(road,x,z,y));
    for(const {positions} of pieces){
      for(let j=0;j<positions.length;j+=9){
        const x=(positions[j]+positions[j+3]+positions[j+6])/3,y=(positions[j+1]+positions[j+4]+positions[j+7])/3,z=(positions[j+2]+positions[j+5]+positions[j+8])/3;
        if(y-world.sampleGround(x,z,createGroundSample(),y).height>.08)probes.push({x,y,z});
      }
      world.addRideSurface(new Float32Array(positions));
    }
  }
  assert.ok(probes.length>10,'exercise street triangles previously unsupported by deck/terrain');
  world.step();
  for(const p of probes){const floor=world.sampleGround(p.x,p.z,createGroundSample(),p.y).height;assert.ok(floor>=p.y-.003,'street skin has no support at '+JSON.stringify(p));}
  world.physics.free();
});

test('a collision fall and recovery keep rider and dog on East Jefferson bridge',async()=>{
  const world=await new DetroitWorld().init(),terrain=new GeoTerrain(world),b=GEO.bridges.find(b=>b.name==='East Jefferson Avenue')!,f=bridgeFrame(b);
  const p=f.point((f.lo+f.hi)/2,(f.near+f.far)/2),height=profileLevel(b.at,'street'),start=toLocal(p.x,height,p.z);
  world.addBox({x:p.x,y:height+1,z:p.z+3,hx:2,hy:1,hz:.2,kind:'barrier'});world.step();
  const sim=new RideController(terrain,{spawn:{position:start,headingY:0}}),pose=createPose(),dog=new DogFollower(terrain);sim.writePose(pose);dog.reset(pose);
  for(let i=0;i<720;i++){sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});sim.writePose(pose);dog.step(1/120,pose);assert.ok(pose.y>=start.y-.04,'fallen rider drops through bridge');assert.ok(dog.current.y>=start.y-.04,'dog drops through bridge');}
  assert.equal(sim.crashed,true,'exercise the actual collision/fall path');
  sim.step(1/120,{...NEUTRAL_ACTIONS,reset:true});sim.writePose(pose);dog.reset(pose);
  assert.equal(sim.crashed,false);assert.ok(pose.y>=start.y-.04);assert.ok(dog.current.y>=start.y-.04);
  world.physics.free();
});

