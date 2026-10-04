import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {assetPath} from './testAssets.ts';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3} from 'three';
import {EbikeController} from './ebikeController.ts';
import {EbikeView} from './electricVehicleView.ts';
import {EBIKES,EUC_MODELS} from './electricVehicles.ts';
import {BicycleAdapter} from './bicycleAdapter.ts';
import {NEUTRAL_ACTIONS,createPose} from './controller.ts';
import {createGroundSample,type TerrainSampler} from './terrain.ts';
const floor:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,createGroundSample());},raycast:()=>null,raycastObstacle:()=>null};
test('four electric motos reach distinct speed limits, brake and steer with different geometry',()=>{
 const metrics=EBIKES.map(profile=>{const c=new EbikeController(floor,profile);for(let n=0;n<120*50;n++)c.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});const top=c.cycle.speed,start=c.cycle.z;assert.ok(top<=profile.topKph/3.6+.001);assert.ok(top>profile.topKph/3.6*.97,profile.name+' top '+top*3.6);for(let n=0;n<120*10&&c.cycle.speed>.02;n++)c.step(1/120,{...NEUTRAL_ACTIONS,throttle:-1});assert.ok(c.cycle.speed<.02);const stop=c.cycle.z-start;c.reset();for(let n=0;n<120*3;n++)c.step(1/120,{...NEUTRAL_ACTIONS,throttle:.5,steer:.4});assert.ok(Number.isFinite(c.cycle.headingY));return {top,stop,turn:c.cycle.headingY};});
 assert.ok(metrics[3].top>metrics[2].top&&metrics[2].top>metrics[0].top);assert.ok(new Set(metrics.map(m=>m.turn.toFixed(2))).size===4);assert.ok(metrics[3].stop>metrics[0].stop);
});
test('unicycles retain original default and apply four distinct acceleration, turning and speed ceilings',()=>{
 const c=new BicycleAdapter(floor);assert.equal(c.vehicleId,'euc');const metrics=EUC_MODELS.map(profile=>{c.selectVehicle('euc:'+profile.id);c.reset({position:{x:0,y:0,z:0},headingY:0});const p=createPose();for(let n=0;n<120*40;n++)c.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});c.writePose(p);assert.ok(p.speed<=profile.topKph/3.6+.01);assert.ok(p.speed>profile.topKph/3.6*.94,profile.name+' '+p.speed*3.6);const top=p.speed;c.reset({position:{x:0,y:0,z:0},headingY:0});for(let n=0;n<120*2;n++)c.step(1/120,{...NEUTRAL_ACTIONS,throttle:.45,steer:.2});c.writePose(p);return {top,heading:p.headingY,speed:p.speed};});assert.equal(new Set(metrics.map(m=>m.top.toFixed(1))).size,4);assert.equal(new Set(metrics.map(m=>m.heading.toFixed(3))).size,4);assert.ok(metrics[2].speed>metrics[0].speed);
});
test('fast motos stop before scenery and cross a small curb without a vertical snap',()=>{
 let height=0;const terrain:TerrainSampler={...floor,sampleGround(_x,z,out){return Object.assign(out,createGroundSample(),{height:z>10?.14:height});},raycastObstacle(o,d,length){const t=d.z>0?(20-o.z)/d.z:Infinity;return t>=0&&t<length?t:null;}};const c=new EbikeController(terrain,EBIKES[3]);let jump=0,last=0;for(let n=0;n<120*10;n++){c.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});jump=Math.max(jump,Math.abs(c.cycle.y-last));last=c.cycle.y;}assert.ok(c.cycle.z<20);assert.ok(c.blocked);assert.ok(jump<.025,'curb displacement '+jump);height=0;
});
async function model(url:URL){const b=await readFile(url),n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n).toString());delete j.images;delete j.textures;delete j.materials;for(const m of j.meshes)for(const p of m.primitives)delete p.material;const json=Buffer.from(JSON.stringify(j)),size=Math.ceil(json.length/4)*4,bin=b.subarray(20+n),out=Buffer.alloc(20+size+bin.length,32);out.writeUInt32LE(0x46546c67);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(size,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);bin.copy(out,20+size);return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.length),'');}
test('Blender motos have mechanical pivots and fitted joined rider limbs',async()=>{
 const human=await model(pathToFileURL(assetPath('../../exports/glb','DS_Man_01','DS_Man_01_LOD0.glb')));for(const p of EBIKES){const data=await model(new URL('../../public/exports/electric/Ebike_'+p.id+'.glb',import.meta.url));for(const name of ['Bicycle_Steering_Pivot','Bicycle_Front_Wheel_Pivot','Bicycle_Rear_Wheel_Pivot','Grip','Grip001'])assert.ok(data.scene.getObjectByName(name),name);const view=new EbikeView(data,human,p);const pose=createPose();pose.speed=12;pose.wheelSpin=3;view.apply(pose,.15);for(const side of ['Left','Right']){const hand=view.rider.getObjectByName(side+'Hand')!.getWorldPosition(new Vector3()),grip=view.bike.getObjectByName(side==='Left'?'Grip001':'Grip')!.getWorldPosition(new Vector3());assert.ok(Number.isFinite(hand.x+hand.y+hand.z));assert.ok(hand.distanceTo(grip)<.14,side+' grip error '+hand.distanceTo(grip)+' '+JSON.stringify({hand,grip,other:view.bike.getObjectByName(side==='Left'?'Grip':'Grip001')!.getWorldPosition(new Vector3()),shoulder:view.rider.getObjectByName(side+'Arm')!.getWorldPosition(new Vector3())}));}assert.ok(view.bike.getObjectByName('Bicycle_Front_Wheel_Pivot')!.rotation.x!==0);view.dispose();}
});
