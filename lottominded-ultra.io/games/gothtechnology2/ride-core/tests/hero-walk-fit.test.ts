import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {applyOnFootRider} from '../src/onFootRider.ts';
import {footFields} from '../src/onFoot.ts';

// Decode the real shipped meshes/skeletons without textures or a browser GPU.
const base=process.env.HERO_ASSET_DIR??fileURLToPath(new URL('../../store/public/arcade/swoop-detroit/exports/rigged-heroes/',import.meta.url));
async function load(id:string){
 const b=await readFile(`${base}/${id}.glb`),n=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+n));
 delete j.images;delete j.textures;delete j.samplers;j.materials=(j.materials??[]).map((m:{name:string})=>({name:m.name}));
 let json=JSON.stringify(j);while(Buffer.byteLength(json)%4)json+=' ';
 const bytes=Buffer.from(json),chunk=b.subarray(20+n),out=Buffer.alloc(20+bytes.length+chunk.length);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(bytes.length,12);out.writeUInt32LE(0x4e4f534a,16);bytes.copy(out,20);chunk.copy(out,20+bytes.length);
 return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');
}

test('all five shipped heroes keep feet above ground and elbows bent through walk/run cycles',async t=>{
 if(!process.env.HERO_ASSET_DIR&&!existsSync(base)){t.skip('Packaged hero assets required; set HERO_ASSET_DIR to the review exports/rigged-heroes directory.');return;}
 for(const id of ['DS_Armored_Rider_01','DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01']){
  const asset=await load(id),root=new T.Group(),ground=new T.Group(),lean=new T.Group(),vehicle=new T.Group(),rider=asset.scene;
  root.add(ground);ground.add(lean);lean.add(vehicle,rider);
  if(asset.animations[0]){const mixer=new T.AnimationMixer(rider);mixer.clipAction(asset.animations[0]).play();mixer.setTime(0);}
  const bones:{o:T.Object3D;p:T.Vector3;q:T.Quaternion}[]=[];
  rider.traverse(o=>{if((o as T.Bone).isBone)bones.push({o,p:o.position.clone(),q:o.quaternion.clone()});});
  const rig={root,ground,lean,vehicle,rider,bones,mountHeight:.25,motionScale:id.includes('Mascot')?.48:1};
  const p={...footFields(),footMode:2,footBlend:1,x:0,y:0,z:0,headingY:0,speed:0,airHeight:0,airBlend:0,velocityX:0,velocityZ:0,rollAngle:0,groundPitch:0,groundRoll:0,stopFoot:0};
  for(const speed of [0,2.35,5.4,-2.05])for(let i=0;i<24;i++){
   Object.assign(p,{speed,footCycle:i/24,footPhase:i/24,footTime:i/24});applyOnFootRider(rig,p);
   for(const side of ['Left','Right']){
    const foot=rider.getObjectByName(side+'Foot')!.getWorldPosition(new T.Vector3());
    assert(foot.y>-.03,`${id}: ${side} foot below floor at ${speed}/${i}`);
    const a=rider.getObjectByName(side+'Arm')!.getWorldPosition(new T.Vector3()),b=rider.getObjectByName(side+'ForeArm')!.getWorldPosition(new T.Vector3()),c=rider.getObjectByName(side+'Hand')!.getWorldPosition(new T.Vector3());
    const elbow=b.clone().sub(a).angleTo(c.clone().sub(b));assert(elbow>.15&&elbow<1.4,`${id}: rigid or overbent elbow ${elbow}`);
   }
   for(const b of bones)assert([...b.o.quaternion.toArray(),...b.o.position.toArray()].every(Number.isFinite),id+' invalid bone transform');
  }
 }
});
