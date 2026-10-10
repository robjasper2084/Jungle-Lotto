import {readFile,writeFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3,Quaternion} from 'three';
import {Hero} from './actors.ts';
import {createPose} from './controller.ts';
import {RIDER_CHOICES} from './riderChoices.ts';
import {assetPath} from './testAssets.ts';
export async function rigModel(path:string|URL){
 const b=await readFile(path),n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n).toString());
 delete j.images;delete j.textures;delete j.materials;
 for(const m of j.meshes)for(const p of m.primitives)delete p.material;
 const json=Buffer.from(JSON.stringify(j)),size=Math.ceil(json.length/4)*4,bin=b.subarray(20+n),out=Buffer.alloc(20+size+bin.length,32);
 out.writeUInt32LE(0x46546c67);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(size,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);bin.copy(out,20+size);
 return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.length),'');
}
export async function heroAssets(){
 const data=new Map([['DS_EUC_01',await rigModel(assetPath('exports/glb/DS_EUC_01/DS_EUC_01_LOD1.glb'))]]);
 for(const {id} of RIDER_CHOICES)data.set(id,await rigModel(id==='DS_Armored_Rider_01'?new URL('../../public/exports/glb/'+id+'/'+id+'_LOD1.glb',import.meta.url):assetPath('exports/glb/'+id+'/'+id+'_LOD'+(id==='DS_Man_01'?0:1)+'.glb')));
 return data;
}
export function jointPositions(h:Hero){
 return Object.fromEntries(['Hips','Spine02','Spine01','Spine','LeftShoulder','RightShoulder','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand','LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot'].map(n=>{const b=h.rider.getObjectByName(n)!;return[n,{p:h.root.worldToLocal(b.getWorldPosition(new Vector3())).toArray(),q:h.root.getWorldQuaternion(new Quaternion()).invert().multiply(b.getWorldQuaternion(new Quaternion())).toArray()}];}));
}
if(process.argv.includes('--inspect')){
 const data=await heroAssets(),rows=[];
 for(const {id} of RIDER_CHOICES){const h=new Hero(data,undefined,id);
 for(const speed of [0,2.35,5.4]){const p={...createPose(),footMode:2,footBlend:1,speed,footPhase:.25,footTime:1};h.apply(p);rows.push({id,speed,joints:jointPositions(h)});}
 h.dispose();}
 await writeFile(new URL('../../../docs/shared-rider-upgrade/hero-before-20261010.json',import.meta.url),JSON.stringify(rows,null,2));
 console.log(rows.map(r=>({id:r.id,speed:r.speed,arm:r.joints.LeftForeArm.p,hand:r.joints.LeftHand.p,hip:r.joints.Hips.p})));
}

