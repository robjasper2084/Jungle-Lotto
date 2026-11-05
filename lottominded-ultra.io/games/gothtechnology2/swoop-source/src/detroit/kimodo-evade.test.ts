import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {Hero} from './actors.ts';
import {createPose} from './controller.ts';
import {CombatRig} from './royale/combatRig.ts';
import {EquipmentLibrary,WeaponView,EQUIPMENT_KINDS} from './royale/equipment.ts';
import {initialCombat} from '../../../ride-core/src/royale/rules.ts';

const assets=new URL('../../../store/public/arcade/swoop-detroit/exports/',import.meta.url);
async function model(path:string){
 const b=await readFile(new URL(path,assets)),n=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+n));
 delete j.images;delete j.textures;delete j.samplers;j.materials=(j.materials??[]).map((m:{name:string})=>({name:m.name}));
 let json=JSON.stringify(j);while(Buffer.byteLength(json)%4)json+=' ';
 const bytes=Buffer.from(json),chunk=b.subarray(20+n),out=Buffer.alloc(20+bytes.length+chunk.length);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(bytes.length,12);out.writeUInt32LE(0x4e4f534a,16);bytes.copy(out,20);chunk.copy(out,20+bytes.length);
 return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');
}


test('Kimodo evade rolls every shipped rig without stretched bones, then restores the walk',async()=>{
 const data=new Map([['DS_EUC_01',await model('glb/DS_EUC_01/DS_EUC_01_LOD1.glb')]]);
 const library=new EquipmentLibrary(new Map(await Promise.all(EQUIPMENT_KINDS.map(async kind=>[kind,await model('polish/royale-equipment/'+kind+'.glb')] as const))),await model('polish/royale-equipment/repair-use.glb'));
 for(const id of ['DS_Armored_Rider_01','DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01']){
  data.set(id,await model('rigged-heroes/'+id+'.glb'));const hero=new Hero(data,undefined,id,'kimodo'),weapon=new WeaponView(library),rig=new CombatRig(hero,weapon);
  const p={...createPose(),headingY:.6,footMode:2,footBlend:1,footTime:2};hero.apply(p);const lengths=[...hero.legs,...hero.arms].map(l=>l.upper.getWorldPosition(new Vector3()).distanceTo(l.knee.getWorldPosition(new Vector3())));
  let minHip=Infinity,maxHip=-Infinity;
  for(const dir of [-1,1,2,3])for(let age=0;age<96;age+=3){hero.apply(p);const state=initialCombat();state.melee!.evadeUntil=196;state.melee!.evadeDir=dir;rig.apply(p,0,0,state,100+age);assert.equal(weapon.root.visible,false);
   hero.rider.traverse(o=>assert([...o.position.toArray(),...o.quaternion.toArray()].every(Number.isFinite)));
   [...hero.legs,...hero.arms].forEach((l,i)=>assert(Math.abs(l.upper.getWorldPosition(new Vector3()).distanceTo(l.knee.getWorldPosition(new Vector3()))-lengths[i])<1e-5));
   const y=hero.rider.getObjectByName('Hips')!.getWorldPosition(new Vector3()).y;minHip=Math.min(minHip,y);maxHip=Math.max(maxHip,y);
  }
  assert(maxHip-minHip>.3*hero.motionScale,id+' must visibly drop into the roll');hero.apply(p);rig.apply(p,0,0,initialCombat(),200);assert(weapon.root.visible);hero.dispose();weapon.dispose();
 }
 library.dispose();
});
