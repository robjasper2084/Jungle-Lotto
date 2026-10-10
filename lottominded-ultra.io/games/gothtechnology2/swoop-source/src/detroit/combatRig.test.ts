import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {Vector3,SkinnedMesh} from 'three';
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

test('combat keeps the Swoop torso shape and elbows outside the chest at every aim angle',async t=>{
 const data=new Map([['DS_EUC_01',await model(assetPath('exports/glb/DS_EUC_01/DS_EUC_01_LOD1.glb'))]]);
 const library=new EquipmentLibrary(new Map(await Promise.all(EQUIPMENT_KINDS.map(async kind=>[kind,await model(new URL('../../public/exports/polish/royale-equipment/'+kind+'.glb',import.meta.url))] as const))));
 for(const {id} of RIDER_CHOICES){
  data.set(id,await model(id==='DS_Armored_Rider_01'?new URL('../../public/exports/glb/'+id+'/'+id+'_LOD1.glb',import.meta.url):assetPath('exports/glb/'+id+'/'+id+'_LOD'+(id==='DS_Man_01'?0:1)+'.glb')));
  const hero=new Hero(data,undefined,id),weapon=new WeaponView(library),rig=new CombatRig(hero,weapon);
  weapon.select('static');weapon.update(1,false);
  let worstSpine=0,insideElbow=0,worstSeam=0;
  const surfaces:{mesh:SkinnedMesh;edges:[number,number][];posed:Vector3[]}[]=[];
  hero.rider.traverse(o=>{const mesh=o as SkinnedMesh;if(!mesh.isSkinnedMesh||!mesh.geometry.index)return;
   const p=mesh.geometry.attributes.position,index=mesh.geometry.index,edges:[number,number][]=[],a=new Vector3(),b=new Vector3();
   for(let i=0;i<index.count;i+=3)for(let k=0;k<3;k++){const u=index.getX(i+k),v=index.getX(i+(k+1)%3);a.fromBufferAttribute(p,u);b.fromBufferAttribute(p,v);if(a.distanceTo(b)<.004)edges.push([u,v]);}
   surfaces.push({mesh,edges,posed:Array.from({length:p.count},()=>new Vector3())});
  });
  for(const yaw of [-1.25,0,1.25])for(const pitch of [-.65,0,.65])for(const foot of [0,1]){
   const p={...createPose(),headingY:.8,footMode:foot?2:0,footBlend:foot,speed:foot?4.4:10,footPhase:.3};hero.apply(p);
   const original=hero.spine.map(b=>b.quaternion.clone());rig.apply(p,yaw,pitch,{...initialCombat(),aimBlend:1},260);
   hero.spine.forEach((b,i)=>worstSpine=Math.max(worstSpine,b.quaternion.clone().normalize().angleTo(original[i].normalize())));
   // Hands may cross toward a central weapon; elbows must remain on their own side.
   const left=hero.arms[0].upper.getWorldPosition(new Vector3()),right=hero.arms[1].upper.getWorldPosition(new Vector3()),side=left.clone().sub(right).normalize(),center=left.clone().add(right).multiplyScalar(.5);
   hero.arms.forEach((arm,i)=>insideElbow=Math.max(insideElbow,-arm.knee.getWorldPosition(new Vector3()).sub(center).dot(side)*(i===0?1:-1)));
   for(const {mesh,edges,posed} of surfaces){mesh.skeleton.update();posed.forEach((v,i)=>mesh.getVertexPosition(i,v));for(const [u,v]of edges)worstSeam=Math.max(worstSeam,posed[u].distanceTo(posed[v]));}
  }
  t.diagnostic(JSON.stringify({id,worstSpine,insideElbow,worstSeam}));
  assert(worstSpine<.43,id+' concentrates the torso turn in a single joint');
  assert(insideElbow<.015,id+' elbow crosses through the chest');
  assert(worstSeam<.05,id+' opens a skin seam');
  hero.dispose();weapon.dispose();
 }
 library.dispose();
});
