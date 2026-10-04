import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ThreeRiderView} from './riding/threeRiderView.ts';
import {NEUTRAL_ACTIONS,createPose,NaturalMotionEngine} from '@digital-static/ridecore';
import {RideMotion} from './ride-motion.ts';
import {createRideCoreRiders} from './riding/elmwoodRiders.ts';
import {rideCoreTerrain} from './ridecore-terrain.ts';
import type {TerrainSampler} from '../simulation/world.ts';
const flat:TerrainSampler={sampleGround(_x,_z,o){o.height=0;o.normal={x:0,y:1,z:0};o.surface='pavement';o.offCourse=false;return o;},raycast:()=>null,raycastObstacle:()=>null};
const loader=new GLTFLoader();loader.register(()=>({name:'headless-textures',loadTexture:()=>Promise.resolve(new T.Texture())}));
async function glb(path:string){const b=await fs.readFile(new URL('../../public/'+path,import.meta.url));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const original=new Map([['DS_Man_01',await glb('exports/glb/DS_Man_01/DS_Man_01_LOD0.glb')],['DS_EUC_01',await glb('exports/glb/DS_EUC_01/DS_EUC_Compact.glb')]]);
const circuit=new Map(await Promise.all(['hoodie','suit','euc'].map(async id=>[id,await glb('circuit-riders/models/circuit-'+id+'.glb')] as const)));
const motion=new RideMotion(flat),riders=createRideCoreRiders(original,circuit,motion.terrain);
for(const [id,rider] of riders){
  test(`${id}: RideCore view keeps the supplied boots on their wheel through crouch, acceleration and turning`,()=>{
    assert.ok(rider instanceof ThreeRiderView);motion.setProfile(rider.profile);motion.reset({x:0,y:0,z:0},.3);
    for(const actions of [{throttle:.5},{throttle:.3,crouch:true},{throttle:.3,steer:.3},{throttle:-1}]){
      for(let n=0;n<120;n++)motion.update(1/120,{...NEUTRAL_ACTIONS,...actions});rider.apply(motion.pose);
      assert.equal(motion.sim.crashed,false);assert.ok(rider.root.position.toArray().every(Number.isFinite));
      for(let i=0;i<2;i++)assert.ok(rider.legs[i].foot.getWorldPosition(new T.Vector3()).distanceTo(rider.footTarget(i,motion.pose))<.007,`${id} foot ${i}: ${JSON.stringify(actions)}`);
    }
  });
  test(`${id}: mounted and stopped stance follows the selected RideCore profile`,()=>{
    motion.setProfile(rider.profile);motion.reset({x:0,y:0,z:0},0);for(let n=0;n<360;n++)motion.update(1/120,NEUTRAL_ACTIONS);rider.apply(motion.pose);
    assert.equal(rider.profile.footDownStop,id==='original');assert.ok(id==='original'?motion.pose.stopFoot>.98:motion.pose.stopFoot===0);
    for(let i=0;i<2;i++)assert.ok(rider.legs[i].foot.getWorldPosition(new T.Vector3()).distanceTo(rider.footTarget(i,motion.pose))<.007);
  });
}
test('RideCore displacement rays reach the map physics with metre-scaled distances and unit directions',()=>{
  const map={...flat,raycast:(_o:unknown,d:T.Vector3,max:number)=>{assert.equal(Math.hypot(d.x,d.y,d.z),1);assert.equal(max,12);return 3;},raycastObstacle:(_o:unknown,d:T.Vector3,max:number)=>{assert.equal(Math.hypot(d.x,d.y,d.z),1);assert.equal(max,.32);return .2;}};
  const adapter=rideCoreTerrain(map);assert.equal(adapter.raycast({x:0,y:0,z:0},{x:0,y:0,z:5},12),3);assert.equal(adapter.raycastObstacle({x:0,y:0,z:0},{x:.0001,y:0,z:0},.32),.2);
  assert.equal(adapter.raycast({x:0,y:0,z:0},{x:0,y:0,z:0},1),null);
});

test('the original Elmwood hero keeps soft elbows and forearm-relative wrists at rest and through riding transitions',()=>{
  const hero=riders.get('original')!,p=createPose(),engine=new NaturalMotionEngine();
  for(const phase of [{speed:0},{speed:7},{speed:7,rollAngle:.35,turnIntent:.6,lateralAcceleration:-3},{speed:0,rollAngle:0,turnIntent:0,lateralAcceleration:0,stopFoot:1}]){
    Object.assign(p,phase);
    for(let tick=0;tick<240;tick++){
      engine.step(1/120,p,0);hero.apply(p);
      for(const arm of hero.arms){
        const joint=arm.knee.getWorldPosition(new T.Vector3());
        const bend=arm.upper.getWorldPosition(new T.Vector3()).sub(joint).angleTo(arm.foot.getWorldPosition(new T.Vector3()).sub(joint));
        assert.ok(bend>.5&&bend<2.85,'elbow must remain softly bent');
        const bind=hero.bones.find(b=>b.o===arm.foot)!;
        assert.ok(arm.foot.quaternion.angleTo(bind.q)<.25,'palm must follow the forearm without a sharp wrist kink');
      }
      for(let i=0;i<2;i++)assert.ok(hero.legs[i].foot.getWorldPosition(new T.Vector3()).distanceTo(hero.footTarget(i,p))<.007);
    }
  }
});
