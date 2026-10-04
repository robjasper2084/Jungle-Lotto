import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3,Quaternion,SkinnedMesh} from 'three';
import {BicycleView} from '@digital-static/ridecore/cycling-view';
import {assetPath} from './testAssets.ts';
import {createPose} from '@digital-static/ridecore';
async function mesh(id:string,lod:number){
  const buf=await readFile(id==='DS_Bicycle_Styles'?resolve('public/exports/glb',id,`${id}_LOD${lod}.glb`):assetPath('../../exports/glb',id,`${id}_LOD${lod}.glb`)),n=buf.readUInt32LE(12),j=JSON.parse(buf.subarray(20,20+n).toString());
  // Headless geometry/skeleton test; omit texture decoding only. No source asset is modified.
  delete j.images;delete j.textures;delete j.materials;for(const m of j.meshes)for(const p of m.primitives)delete p.material;
  const json=Buffer.from(JSON.stringify(j)),length=Math.ceil(json.length/4)*4,jsonPad=Buffer.alloc(length,32);json.copy(jsonPad);const bin=buf.subarray(20+n),out=Buffer.alloc(20+length+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(length,12);out.writeUInt32LE(0x4e4f534a,16);jsonPad.copy(out,20);bin.copy(out,20+length);
  return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.length),'');
}

const bike=await mesh('DS_Bicycle_Styles',1);
for(const id of ['DS_Cyclist_01','DS_Man_01'])test(id+' keeps hands on turned grips and feet on the crank through full pedal revolutions',async()=>{
 const rider=await mesh(id,id==='DS_Cyclist_01'?1:0),view=new BicycleView(bike,rider,1,id==='DS_Cyclist_01'),p=createPose();
 for(const bank of [-.3,0,.3])for(const effort of [0,1])for(let i=0;i<32;i++){
  const phase=i/32*Math.PI*2;Object.assign(p,{rollAngle:bank,driveIntent:effort,brakeAmount:1-effort,groundPitch:.08,riderPitch:.04});view.apply(p,bank,phase);
  for(const side of ['Left','Right']){
   const hand=view.rider.getObjectByName(side+'Hand')!,foot=view.rider.getObjectByName(side+'Foot')!,sign=Math.sign(view.frame.worldToLocal(foot.getWorldPosition(new Vector3())).x);
   const grip=view.bike.getObjectByName(sign>0?'Grip001':'Grip')??view.bike.getObjectByName(sign>0?'Grip.001':'Grip')!;
   const palm=hand.localToWorld(new Vector3(-sign*.028,.09,0));
   assert.ok(palm.distanceTo(grip.getWorldPosition(new Vector3()))<.04,JSON.stringify({id,side,bank,effort,phase,palm:palm.toArray(),grip:grip.getWorldPosition(new Vector3()).toArray()}));
   const handDirection=new Vector3(0,1,0).applyQuaternion(hand.getWorldQuaternion(new Quaternion()));
   const barDirection=new Vector3(Math.sin(bank),0,Math.cos(bank)).applyQuaternion(view.frame.getWorldQuaternion(new Quaternion()));
   assert.ok(handDirection.dot(barDirection)>.99,'hand hangs down instead of following the handlebar');
   const cycle=phase+(sign>0?Math.PI:0),target=view.frame.localToWorld(new Vector3(sign*.13,(id==='DS_Cyclist_01'?.43:.395)-.165*Math.cos(cycle),-.13-.165*Math.sin(cycle)));
   assert.ok(foot.getWorldPosition(new Vector3()).distanceTo(target)<.025,'foot lost pedal');
  }
 }
 view.dispose();
});

test('gripping poses bend the supplied fingers without mutating the shared rider geometry',async()=>{
 const rider=await mesh('DS_Man_01',0),source:SkinnedMesh[]=[];rider.scene.traverse(o=>{if((o as SkinnedMesh).isSkinnedMesh)source.push(o as SkinnedMesh);});
 const before=source.map(m=>Array.from(m.geometry.getAttribute('position').array));
 const view=new BicycleView(bike,rider),cloned:SkinnedMesh[]=[];view.rider.traverse(o=>{if((o as SkinnedMesh).isSkinnedMesh)cloned.push(o as SkinnedMesh);});
 let changed=0;for(let i=0;i<source.length;i++){assert.deepEqual(Array.from(source[i].geometry.getAttribute('position').array),before[i]);const result=cloned[i].geometry.getAttribute('position').array;for(let j=0;j<result.length;j++)if(Math.abs(result[j]-before[i][j])>1e-5)changed++;}
 assert.ok(changed>100,'fingers are still in their dangling rest pose');view.dispose();
});
