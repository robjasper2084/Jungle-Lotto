import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const game=fileURLToPath(new URL('../../',import.meta.url)),out=path.join(game,'.test/wheel-clearance');
await build({absWorkingDir:game,entryPoints:['src/belle/cadillacWheelClearance.ts','src/belle/cadillacSuspension.ts','src/belle/cadillacHydraulics.ts','src/belle/cadillacWireWheels.ts'],outdir:out,bundle:true,platform:'node',format:'esm',external:['three'],logLevel:'error'});
const {CadillacWheelClearance,cadillacSuspensionHubXZ}=await import(pathToFileURL(path.join(out,'cadillacWheelClearance.js')));
const {CadillacSuspension}=await import(pathToFileURL(path.join(out,'cadillacSuspension.js')));
const {CadillacHydraulics}=await import(pathToFileURL(path.join(out,'cadillacHydraulics.js')));
const {fitCadillacWireWheels}=await import(pathToFileURL(path.join(out,'cadillacWireWheels.js')));
const corners=['FL','FR','RL','RR'],sources=new Map();
for(const [variant,file]of [['cadillac','silver-cadillac.glb'],['hydraulic-cadillac','hydraulics-cadillac.glb']]){
 const bytes=await fs.readFile(path.join(game,'public/belle/vehicles',file)),length=bytes.readUInt32LE(12),data=JSON.parse(bytes.subarray(20,20+length).toString());
 data.materials=data.materials.map(material=>({name:material.name}));
 const json=Buffer.from(JSON.stringify(data)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
 const binary=bytes.subarray(20+length),output=Buffer.alloc(20+padded.length+binary.length);
 output.write('glTF');output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);output.writeUInt32LE(padded.length,12);output.writeUInt32LE(0x4e4f534a,16);padded.copy(output,20);binary.copy(output,20+padded.length);
 const scene=(await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength),'')).scene;
 if(variant==='hydraulic-cadillac')fitCadillacWireWheels(scene);
 sources.set(variant,scene);
}
function fixture(variant){
 const model=sources.get(variant).clone(true),body=model.getObjectByName(variant==='cadillac'?'SprungBody':'ChassisGeometry');
 const hydraulics=variant==='hydraulic-cadillac'?new CadillacHydraulics(model.getObjectByName('Cadillac_Model'),body):null;
 const hubs=hydraulics?.hubs.map(entry=>entry.hub)??corners.map(corner=>model.getObjectByName('Hub'+corner));
 const anchors=hubs.map(hub=>hub.position.clone()),suspension=hydraulics?.suspension??new CadillacSuspension(Object.fromEntries(corners.map((corner,i)=>[corner,anchors[i]])));
 const begin=performance.now(),guard=new CadillacWheelClearance(model,body,hubs,variant),constructionMs=performance.now()-begin;
 return{variant,model,body,hubs,anchors,suspension,guard,constructionMs};
}
function samples(f,poses,{follow=true,steering=0}={}){
 return poses.map(pose=>{
  const wheelCenters=f.anchors.map((anchor,i)=>{
   const center=anchor.clone();if(follow)cadillacSuspensionHubXZ(anchor,pose,center);
   center.y+=pose.wheelLifts[corners[i]];return center;
  });
  const curvature=Math.tan(steering)/3.213;
  return{bodyMatrix:new T.Matrix4().compose(new T.Vector3(0,pose.heave,0),new T.Quaternion().setFromEuler(new T.Euler(pose.pitch,0,pose.roll)),new T.Vector3(1,1,1)),
   wheelCenters,steering:wheelCenters.map((center,i)=>i<2?Math.atan2(3.213*curvature,1-center.x*curvature):0)};
 });
}

test('horizontal suspension hubs match the actual chassis XYZ transform without changing vertical contact',()=>{
 const anchor={x:.824,y:.346,z:-1.3545},target={x:0,y:19,z:0};
 for(const pitch of [-.18,0,.18])for(const roll of [-.18,0,.18]){
  const expected=new T.Vector3(anchor.x,anchor.y,anchor.z).applyEuler(new T.Euler(pitch,0,roll));
  assert.equal(cadillacSuspensionHubXZ(anchor,{pitch,roll},target),target);
  assert(Math.abs(target.x-expected.x)<1e-12);assert(Math.abs(target.z-expected.z)<1e-12);assert.equal(target.y,19);
 }
 assert.deepEqual(cadillacSuspensionHubXZ(anchor,{pitch:0,roll:0},target),{...anchor,y:19});
});

test('both real GLBs retain their neutral stock fit at straight and full-lock steering',()=>{
 for(const variant of sources.keys()){
  const f=fixture(variant),neutral=f.suspension.preview();
  for(const steering of [-.52,0,.52])assert(f.guard.clearPath(samples(f,[neutral],{steering})),variant+' source neutral fit');
  const stats=f.guard.diagnostics();assert(stats.crownTriangles.every(count=>count>100&&count<12000));
  assert.equal(stats.toleranceMetres,.001);assert.equal(f.guard.failure,null);
 }
});

test('actual silver fenders reject the old fixed-hub corner pose and accept its articulated hub path',()=>{
 const f=fixture('cadillac'),path=f.suspension.previewPath({FL:.24},16);
 assert.equal(f.guard.clearPath(samples(f,path,{follow:false})),false,'regression: rolling body slides over stationary rear hubs');
 const rejected=f.guard.failure;assert(rejected&&['RL','RR'].includes(rejected.corner));assert(rejected.extraPenetration>.001);
 assert(f.guard.clearPath(samples(f,path)),JSON.stringify(f.guard.failure));
});

test('raised stance preserves usable all-wheel and axle hops on each actual rig',()=>{
 for(const variant of sources.keys()){
  const f=fixture(variant),height=.14;
  assert(f.guard.clearPath(samples(f,f.suspension.previewPath({FL:height,FR:height,RL:height,RR:height},10))),variant+' raise');
  f.suspension.stance('raised',true);
  for(const mode of ['all','front','rear'])assert(f.guard.clearPath(samples(f,f.suspension.previewHop(mode,24))),variant+' '+mode+' '+JSON.stringify(f.guard.failure));
 }
});

test('source crown data is cached, malformed samples fail closed, and steering cache stays bounded',()=>{
 const f=fixture('cadillac'),path=f.suspension.previewPath({FL:.05},2),request=samples(f,path);
 for(const object of [f.model,f.body,...f.hubs])object.traverse=()=>{throw Error('unexpected per-command source traversal');};
 assert(f.guard.clearPath(request));
 const before=structuredClone(f.suspension.snapshot());
 assert.equal(f.guard.clearPath([]),false);
 assert.equal(f.guard.clearPath([{...request[0],steering:[0]}]),false);
 const matrix=request[0].bodyMatrix.clone();matrix.elements[13]=NaN;
 assert.equal(f.guard.clearPath([{...request[0],bodyMatrix:matrix}]),false);
 assert.deepEqual(f.suspension.snapshot(),before,'validation never changes requested suspension motion');
 for(let i=0;i<12;i++)assert(f.guard.clearPath(samples(f,[f.suspension.preview()],{steering:(i-6)*.07})));
 assert(f.guard.diagnostics().baselineAngles.every(count=>count<=8));
});

test('actual-model command work remains bounded without scanning the scene while driving',()=>{
 for(const variant of sources.keys()){
  const f=fixture(variant),short=samples(f,f.suspension.previewPath({FL:.01,FR:.01,RL:.01,RR:.01},1));
  f.suspension.stance('raised',true);const hop=samples(f,f.suspension.previewHop('all',24));
  f.guard.clearPath(short);f.guard.clearPath(hop);
  const start=performance.now();for(let i=0;i<20;i++)assert(f.guard.clearPath(short));const shortMs=(performance.now()-start)/20;
  const hopStart=performance.now();assert(f.guard.clearPath(hop));const hopMs=performance.now()-hopStart;
  const stats=f.guard.diagnostics();
  assert(stats.triangleChecks<=25*stats.crownTriangles.reduce((sum,n)=>sum+n,0));
  console.log(JSON.stringify({variant,constructionMs:f.constructionMs,shortMs,hopMs,crownTriangles:stats.crownTriangles}));
 }
});
