import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3,Box3,AnimationMixer} from 'three';
const b=await readFile('../../exports/glb/DS_Pedestrian_01/DS_Pedestrian_01_LOD1.glb'),n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n));
delete j.images;delete j.textures;delete j.materials;for(const m of j.meshes)for(const p of m.primitives)delete p.material;
const text=Buffer.from(JSON.stringify(j)),pad=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(pad);const bin=b.subarray(20+n),out=Buffer.alloc(20+pad.length+bin.length);out.writeUInt32LE(0x46546c67);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(pad.length,12);out.writeUInt32LE(0x4e4f534a,16);pad.copy(out,20);bin.copy(out,20+pad.length);
const d=await new GLTFLoader().parseAsync(out.buffer,'');d.scene.updateMatrixWorld(true);
const bones=[];d.scene.traverse(o=>{if(o.isBone)bones.push({name:o.name,p:o.getWorldPosition(new Vector3()).toArray(),q:o.getWorldQuaternion(o.quaternion.clone()).toArray()});});
console.log(JSON.stringify({bounds:new Box3().setFromObject(d.scene),clips:d.animations.map(a=>({name:a.name,duration:a.duration})),bones},null,2));
