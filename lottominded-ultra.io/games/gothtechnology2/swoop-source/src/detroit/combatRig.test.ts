import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {Vector3} from 'three';
import {Hero} from './actors.ts';import {createPose} from './controller.ts';import {RIDER_CHOICES} from './riderChoices.ts';import {assetPath} from './testAssets.ts';
import {CombatRig} from './royale/combatRig.ts';import {EquipmentLibrary,WeaponView,EQUIPMENT_KINDS} from './royale/equipment.ts';import {initialCombat} from '../../../ride-core/src/royale/rules.ts';
async function model(path:string|URL){const b=await readFile(path),n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n).toString());delete j.images;delete j.textures;delete j.materials;for(const m of j.meshes)for(const p of m.primitives)delete p.material;const json=Buffer.from(JSON.stringify(j)),size=Math.ceil(json.length/4)*4,bin=b.subarray(20+n),out=Buffer.alloc(20+size+bin.length,32);out.writeUInt32LE(0x46546c67);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(size,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);bin.copy(out,20+size);return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.length),'');}
test('shipping five rider rigs retain two-hand contacts and pedal poses over mounted states',async()=>{
 const data=new Map([['DS_EUC_01',await model(assetPath('exports/glb/DS_EUC_01/DS_EUC_01_LOD1.glb'))]]);
 const library=new EquipmentLibrary(new Map(await Promise.all(EQUIPMENT_KINDS.map(async kind=>[kind,await model(new URL('../../public/exports/polish/royale-equipment/'+kind+'.glb',import.meta.url))] as const))));
 const report=[];
 for(const {id} of RIDER_CHOICES){data.set(id,await model(id==='DS_Armored_Rider_01'?new URL('../../public/exports/glb/'+id+'/'+id+'_LOD1.glb',import.meta.url):assetPath('exports/glb/'+id+'/'+id+'_LOD'+(id==='DS_Man_01'?0:1)+'.glb')));
  const hero=new Hero(data,undefined,id),weapon=new WeaponView(library),rig=new CombatRig(hero,weapon);let right=0,left=0,footDrift=0,worst:any=null,leftWorst:any=null;
  for(const w of ['static','heart','bass'] as const)for(const aim of [0,.5,1])for(const yaw of [-1.25,0,1.25])for(const roll of [-.35,0,.35])for(const pitch of [-.65,0,.65]){
   const p=createPose();Object.assign(p,{x:10,y:0,z:20,headingY:.8,speed:20,rollAngle:roll,riderRoll:roll*.7,naturalMotion:1,stopFoot:0});hero.apply(p);
   const feet=hero.legs.map(l=>l.foot.getWorldPosition(new Vector3()));weapon.select(w);weapon.update(1/60,false);rig.apply(p,yaw,pitch,{...initialCombat(),aimBlend:aim,lean:Math.sign(roll)},260);
   if(rig.errorR>right)worst={aim,yaw,roll,shoulder:hero.arms[1].upper.getWorldPosition(new Vector3()).toArray(),hand:hero.arms[1].foot.getWorldPosition(new Vector3()).toArray(),weapon:weapon.root.position.toArray()};right=Math.max(right,rig.errorR);if(rig.errorL>left)leftWorst={aim,yaw,roll,shoulder:hero.arms[0].upper.getWorldPosition(new Vector3()).toArray(),hand:hero.arms[0].foot.getWorldPosition(new Vector3()).toArray()};left=Math.max(left,rig.errorL);for(let i=0;i<feet.length;i++)footDrift=Math.max(footDrift,feet[i].distanceTo(hero.legs[i].foot.getWorldPosition(new Vector3())));
  }
  report.push({id,right,left,footDrift,worst,leftWorst,scenarios:243});hero.dispose();weapon.dispose();
 }
 await writeFile(new URL('../../../docs/combat/evidence/rig-contacts.json',import.meta.url),JSON.stringify(report,null,2));
 for(const r of report){assert(r.footDrift<1e-6,r.id+' feet moved');assert(r.right<.02&&r.left<.02,JSON.stringify(r));}library.dispose();
});
