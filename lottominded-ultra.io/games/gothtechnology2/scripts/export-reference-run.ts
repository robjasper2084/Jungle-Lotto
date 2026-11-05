import {readFile,writeFile} from 'node:fs/promises';
import {Vector3,Quaternion} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {Hero} from '../swoop-source/src/detroit/actors.ts';
import {createPose} from '../swoop-source/src/detroit/controller.ts';
import {gaitScale} from '../ride-core/src/footAnimation.ts';
async function load(file:string){
 const b=await readFile(new URL('../store/public/arcade/swoop-detroit/exports/'+file,import.meta.url)),n=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+n));
 delete j.images;delete j.textures;delete j.materials;for(const m of j.meshes)for(const p of m.primitives)delete p.material;
 let s=JSON.stringify(j);while(Buffer.byteLength(s)%4)s+=' ';const json=Buffer.from(s),bin=b.subarray(20+n),out=Buffer.alloc(20+json.length+bin.length);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);json.copy(out,20);bin.copy(out,20+json.length);
 return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(out.buffer,'');
}
const data=new Map([['DS_EUC_01',await load('glb/DS_EUC_01/DS_EUC_01_LOD1.glb')],['DS_Man_01',await load('rigged-heroes/DS_Man_01.glb')]]);
const hero=new Hero(data,undefined,'DS_Man_01','kimodo');
const capture=()=>Object.fromEntries(hero.bones.map(({o})=>[o.name,{p:o.getWorldPosition(new Vector3()).toArray(),q:o.getWorldQuaternion(new Quaternion()).toArray()}]));
hero.root.updateMatrixWorld(true);const rest=capture(),leg=hero.legs[0],length=leg.upper.getWorldPosition(new Vector3()).distanceTo(leg.knee.getWorldPosition(new Vector3()))+leg.knee.getWorldPosition(new Vector3()).distanceTo(leg.foot.getWorldPosition(new Vector3()));
const averageLength=hero.legs.reduce((sum,l)=>sum+l.upper.getWorldPosition(new Vector3()).distanceTo(l.knee.getWorldPosition(new Vector3()))+l.knee.getWorldPosition(new Vector3()).distanceTo(l.foot.getWorldPosition(new Vector3())),0)/2;
const frames=[];for(let i=0;i<=60;i++){const cycle=i/60*gaitScale(averageLength);hero.apply({...createPose(),footMode:2,footBlend:1,speed:5.4,velocityZ:5.4,footCycle:cycle,footTime:2+i/120});frames.push(capture());}
await writeFile(new URL('../swoop-source/art/reference-run-20261028/runtime-bake.json',import.meta.url),JSON.stringify({fps:120,rest,frames}));hero.dispose();console.log('Saved 61 skeletal frames for Blender.');
