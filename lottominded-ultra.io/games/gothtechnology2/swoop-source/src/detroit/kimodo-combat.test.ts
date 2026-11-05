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

test('Static Royale Kimodo leans preserve both feet and weapon grips on every shipped rider',async t=>{
 const data=new Map([['DS_EUC_01',await model('glb/DS_EUC_01/DS_EUC_01_LOD1.glb')]]);
 const library=new EquipmentLibrary(new Map(await Promise.all(EQUIPMENT_KINDS.map(async kind=>[kind,await model('polish/royale-equipment/'+kind+'.glb')] as const))),await model('polish/royale-equipment/repair-use.glb'));
 const reports=[];
 for(const id of ['DS_Armored_Rider_01','DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01']){
  data.set(id,await model('rigged-heroes/'+id+'.glb'));
  for(const firstPerson of [false,true]){
  const hero=new Hero(data,undefined,id,'kimodo'),weapon=new WeaponView(library),rig=new CombatRig(hero,weapon,firstPerson);
  let footDrift=0,right=0,left=0,scenarios=0,worst:unknown=null;
  for(const kind of ['static','heart','bass'] as const)for(const crouch of [0,1])for(const lean of [-1,1])for(const aim of [0,1])for(const yaw of [-1.25,0,1.25])for(const pitch of [-.65,0,.65]){
   const p={...createPose(),headingY:.8,footMode:2,footBlend:1,footCrouch:crouch,footLean:0,speed:0,footTime:2,footPhase:.3};
   hero.apply(p);const feet=hero.legs.map(l=>l.foot.getWorldPosition(new Vector3()));
   weapon.select(kind);weapon.update(1/60,false);rig.apply(p,yaw,pitch,{...initialCombat(),aimBlend:aim,lean},260);
   if(rig.errorL>left)worst={kind,crouch,lean,aim,yaw,pitch};
   right=Math.max(right,rig.errorR);left=Math.max(left,rig.errorL);
   hero.legs.forEach((l,i)=>footDrift=Math.max(footDrift,feet[i].distanceTo(l.foot.getWorldPosition(new Vector3()))));
   hero.rider.traverse(o=>assert([...o.position.toArray(),...o.quaternion.toArray()].every(Number.isFinite),id+' invalid transform'));
   scenarios++;
  }
  const report={id,firstPerson,scenarios,footDrift,right,left,worst};reports.push(report);t.diagnostic(JSON.stringify(report));
  hero.dispose();weapon.dispose();
  }
 }
 library.dispose();
 for(const r of reports){assert(r.footDrift<.0001,r.id+' lean moved a planted foot');assert(r.right<.02&&r.left<.02,r.id+' lean lost a weapon grip');}
});
