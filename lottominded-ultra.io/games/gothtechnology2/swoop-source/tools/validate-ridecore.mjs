import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3} from 'three';
import {Hero} from '../src/detroit/actors.ts';
import {ThreeRiderView} from '../../../../Digital_Static_RideCore/dist/three.js';
import {createPose,HUMAN_PROFILE,MASCOT_PROFILE,RideCore} from '../../../../Digital_Static_RideCore/dist/index.js';

async function asset(id,lod){
 const buf=await readFile(resolve(import.meta.dirname,'../../../exports/glb',id,`${id}_LOD${lod}.glb`));
 const n=buf.readUInt32LE(12),j=JSON.parse(buf.subarray(20,20+n).toString());
 delete j.images;delete j.textures;delete j.materials;for(const m of j.meshes)for(const p of m.primitives)delete p.material;
 const json=Buffer.from(JSON.stringify(j)),length=Math.ceil(json.length/4)*4,pad=Buffer.alloc(length,32);json.copy(pad);
 const bin=buf.subarray(20+n),out=Buffer.alloc(20+length+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(length,12);out.writeUInt32LE(0x4e4f534a,16);pad.copy(out,20);bin.copy(out,20+length);
 return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.length),'');
}
const flat={sampleGround(_x,_z,o){o.height=0;o.normal={x:0,y:1,z:0};o.surface='pavement';o.offCourse=false;return o;},raycast:()=>null,raycastObstacle:()=>null};
const wheel=await asset('DS_EUC_01',0),results=[];
for(const id of ['DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01']){
 const model=await asset(id,1),profile=id.startsWith('DS_Mascot')?MASCOT_PROFILE:HUMAN_PROFILE;
 const original=new Hero(new Map([[id,model],['DS_EUC_01',wheel]]),flat,id),portable=new ThreeRiderView(model,wheel,flat,profile),core=new RideCore(flat,{profile});
 const poses=[createPose(),{...createPose(),stopFoot:1}, {...createPose(),crouch:1,tuck:1}, {...createPose(),rollAngle:.7,riderRoll:.45}];
 for(let f=0;f<360;f++){core.advance(1/60,{trick:f===0?7:0});if(f%12===0)poses.push({...core.current});}
 let maxError=0;
 for(const p of poses){original.apply(p);portable.apply(p);for(const name of ['Hips','Head','LeftFoot','RightFoot','LeftHand','RightHand']){
  const a=original.rider.getObjectByName(name),b=portable.rider.getObjectByName(name);assert.ok(a&&b,name+' missing');
  maxError=Math.max(maxError,a.getWorldPosition(new Vector3()).distanceTo(b.getWorldPosition(new Vector3())));
 }}
 assert.ok(maxError<1e-8,id+' extraction changed bone positions');results.push({id,poses:poses.length,maxBonePositionDifferenceMetres:maxError});original.dispose();portable.dispose();
}
const report={checked:'2026-09-15',method:'Actual GLB geometry and skeletons, textures omitted for headless parsing; source Hero versus packaged ThreeRiderView',results};
await writeFile(resolve(import.meta.dirname,'../../../../Digital_Static_RideCore/docs/rig-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
