import test from 'node:test';
import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import {TagTerrain,type TagFixture} from '../src/tag/fixture.ts';
import {RideController,NEUTRAL_ACTIONS} from '../src/controller.ts';
import {underpassCameraHeight} from '../../swoop-source/src/detroit/cameraClearance.ts';

async function platform(height:number){
 await R.init();const w=new R.World({x:0,y:-9.81,z:0});
 w.createCollider(R.ColliderDesc.cuboid(20,.1,20).setTranslation(0,-.1,0).setCollisionGroups(0x0001ffff));
 w.createCollider(R.ColliderDesc.trimesh(new Float32Array([-4,height,1,4,height,1,-4,height,6,4,height,6]),new Uint32Array([0,2,1,1,2,3])).setCollisionGroups(0x0004ffff));w.step();
 const fixture:TagFixture={version:1,product:'swoop-detroit',arena:'test',revision:'test',hash:'test',physicsVersion:R.version(),transform:{sx:1,tx:0,ty:0,tz:0},physics:Buffer.from(w.takeSnapshot()).toString('base64'),groundRays:true,grid:{x:-20,z:-20,spacing:40,width:2,height:2,heights:[0,0,0,0]},lanes:[{a:{x:0,y:0,z:-10},b:{x:0,y:0,z:10},width:20}],spawns:[]};w.free();return TagTerrain.create(fixture);
}
test('a walking rider cannot pass through a raised sidewalk that crosses the body',async()=>{
 const terrain=await platform(.9),rider=new RideController(terrain,{spawn:{position:{x:0,y:0,z:0},headingY:0}});
 rider.step(1/120,{...NEUTRAL_ACTIONS,dismount:true});for(let i=0;i<90;i++)rider.step(1/120,NEUTRAL_ACTIONS);
 for(let i=0;i<360;i++)rider.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});
 assert(rider.poseValue.z<1,'walked under the sidewalk with torso inside its slab');terrain.dispose();
});
test('walkable bridge deck and passage beneath it remain separate',async()=>{
 const terrain=await platform(4),rider=new RideController(terrain,{spawn:{position:{x:0,y:0,z:0},headingY:0}});
 rider.step(1/120,{...NEUTRAL_ACTIONS,dismount:true});for(let i=0;i<90;i++)rider.step(1/120,NEUTRAL_ACTIONS);
 for(let i=0;i<360;i++)rider.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});
 assert(rider.poseValue.z>6,'bridge blocked its clear underpass');assert(Math.abs(rider.poseValue.y)<.01);
 const ground={height:0,normal:{x:0,y:1,z:0},surface:'pavement' as const,offCourse:false};
 assert(Math.abs(terrain.sampleGround(0,3,ground,4).height-4)<.01,'bridge deck lost support');terrain.dispose();
});
test('camera and projectile rays see raised surfaces, including their underside',async()=>{
 const terrain=await platform(.9);
 const down=terrain.raycast({x:0,y:2,z:3},{x:0,y:-1,z:0},4);
 const up=terrain.raycast({x:0,y:.2,z:3},{x:0,y:1,z:0},4);
 assert(down!==null&&Math.abs(down-1.1)<.02,'downward ray missed the pavement');
 assert(up!==null&&Math.abs(up-.7)<.02,'upward ray missed the raised pavement');terrain.dispose();
});
test('camera stays above low sidewalk edges but below a real bridge',async()=>{
 const low=await platform(.9),high=await platform(4),point={x:0,y:0,z:3};
 assert(underpassCameraHeight(low,point,.6,0)>=1.25-.001,'camera pushed beneath the sidewalk');
 const y=underpassCameraHeight(high,point,5,0);assert(y>3.5&&y<4,'underpass camera crossed the bridge');
 low.dispose();high.dispose();
});
