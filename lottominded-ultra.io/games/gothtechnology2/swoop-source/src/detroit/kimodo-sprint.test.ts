import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {Hero} from './actors.ts';
import {createPose} from './controller.ts';

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
  assert(asymmetry<.003,id+' unequal foot recovery reads as a limp');
  hero.dispose();
 }
});

