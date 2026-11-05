import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {Hero} from './actors.ts';
import {createPose} from './controller.ts';
import {WARDROBE_CHOICES} from '../../../ride-core/src/riderWardrobe.ts';
import {referenceRunChannels} from '../../../ride-core/src/referenceRun.ts';

const assets=new URL('../../../store/public/arcade/swoop-detroit/exports/',import.meta.url);
async function model(path:string){
 const b=await readFile(new URL(path,assets)),n=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+n));
 delete j.images;delete j.textures;delete j.samplers;j.materials=(j.materials??[]).map((m:{name:string})=>({name:m.name}));
 let json=JSON.stringify(j);while(Buffer.byteLength(json)%4)json+=' ';
 const bytes=Buffer.from(json),chunk=b.subarray(20+n),out=Buffer.alloc(20+bytes.length+chunk.length);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(bytes.length,12);out.writeUInt32LE(0x4e4f534a,16);bytes.copy(out,20);chunk.copy(out,20+bytes.length);
 return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');
}

test('fitted sprint keeps every shipped rider level and gives both shoes equal recovery',async t=>{
 const data=new Map([['DS_EUC_01',await model('glb/DS_EUC_01/DS_EUC_01_LOD1.glb')]]);
 for(const id of ['DS_Armored_Rider_01','DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01']){
  data.set(id,await model('rigged-heroes/'+id+'.glb'));
  const hero=new Hero(data,undefined,id,'kimodo'),leg=hero.legs[0];
  const length=leg.upper.getWorldPosition(new Vector3()).distanceTo(leg.knee.getWorldPosition(new Vector3()))+leg.knee.getWorldPosition(new Vector3()).distanceTo(leg.foot.getWorldPosition(new Vector3()));
  const cadence=Math.max(.88,length/.9),rows:{hip:number;left:number;right:number}[]=[];
  for(let i=0;i<=240;i++){
   const cycle=i/120*cadence;
   hero.apply({...createPose(),footMode:2,footBlend:1,speed:5.4,velocityZ:5.4,footCycle:cycle,footPhase:cycle%1,footTime:1+cycle*3/5.4});
   if(i>=120)rows.push({hip:hero.rider.getObjectByName('Hips')!.getWorldPosition(new Vector3()).y,left:hero.legs[0].foot.getWorldPosition(new Vector3()).y,right:hero.legs[1].foot.getWorldPosition(new Vector3()).y});
  }
  const range=(key:'hip'|'left'|'right')=>Math.max(...rows.map(r=>r[key]))-Math.min(...rows.map(r=>r[key]));
  const hipRange=range('hip'),step=Math.max(...rows.slice(1).map((r,i)=>Math.abs(r.hip-rows[i].hip))),asymmetry=Math.abs(range('left')-range('right'));
  t.diagnostic(JSON.stringify({id,hipRange,maxFrameStep:step,footAsymmetry:asymmetry}));
  assert(hipRange<length*.06,id+' hips dip as the swing foot reaches forward');
  assert(step<length*.009,id+' support transfer snaps the pelvis');
  const ankleStep=Math.max(...rows.slice(1).flatMap((r,i)=>[Math.abs(r.left-rows[i].left),Math.abs(r.right-rows[i].right)]));
  assert(ankleStep<length*.04,id+' ankle recovery must interpolate without a pop');
  assert(asymmetry<.003,id+' unequal foot recovery reads as a limp');
  hero.dispose();
 }
});

test('outfit variants share a base asset, restore helmets after ADS, and keep the forward sprint',async()=>{
 const data=new Map([['DS_EUC_01',await model('glb/DS_EUC_01/DS_EUC_01_LOD1.glb')],['DS_Armored_Rider_01',await model('rigged-heroes/DS_Armored_Rider_01.glb')]]);
 for(const {id}of WARDROBE_CHOICES){
  const hero=new Hero(data,undefined,id,'kimodo');
  assert.equal(hero.rider.userData.wardrobe,id);
  assert(hero.rider.userData.heroDetail.triangles<5000,'small accessory geometry budget');
  const patches:any[]=[];hero.rider.traverse(o=>{if(o.name.includes('curved helmet badge'))patches.push(o);});
  assert.equal(patches.length,3);hero.visibility.setFirstPerson(true);assert(patches.every(p=>!p.visible));hero.visibility.setFirstPerson(false);assert(patches.every(p=>p.visible));
  const pose={...createPose(),footMode:2,footBlend:1,speed:5.4,velocityZ:5.4,footCycle:.4,footTime:2};
  hero.apply(pose);const before=hero.legs.map(l=>l.foot.getWorldPosition(new Vector3()));
  hero.combatLocomotion=1;hero.apply(pose);hero.legs.forEach((l,i)=>assert(l.foot.getWorldPosition(new Vector3()).distanceTo(before[i])<.001,'equipment must not replace forward sprint'));
  hero.dispose();
 }
 assert.deepEqual(referenceRunChannels(0),referenceRunChannels(1));
 assert(referenceRunChannels(.5)[1]>.4&&referenceRunChannels(.5)[1]<.6,'Blender lift channel must retain fractional heights');
});

