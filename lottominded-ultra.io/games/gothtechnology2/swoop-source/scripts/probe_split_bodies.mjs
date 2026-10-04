import {readFile} from 'node:fs/promises';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {assetPath} from '../src/detroit/testAssets.ts';import {Hero} from '../src/detroit/actors.ts';
import {RIDER_CHOICES} from '../src/detroit/riderChoices.ts';
const data=new Map();
for(const id of ['DS_EUC_01',...RIDER_CHOICES.map(r=>r.id)]){
 const buf=await readFile(assetPath('../../exports/glb',id,id+'_LOD'+(id==='DS_Man_01'?0:1)+'.glb')),n=buf.readUInt32LE(12),j=JSON.parse(buf.subarray(20,20+n).toString());delete j.images;delete j.textures;delete j.materials;for(const m of j.meshes)for(const p of m.primitives)delete p.material;
 const json=Buffer.from(JSON.stringify(j)),length=Math.ceil(json.length/4)*4,pad=Buffer.alloc(length,32);json.copy(pad);const bin=buf.subarray(20+n),out=Buffer.alloc(20+length+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(length,12);out.writeUInt32LE(0x4e4f534a,16);pad.copy(out,20);bin.copy(out,20+length);
 data.set(id,await new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.length),''));
}
for(const {id} of RIDER_CHOICES){const h=new Hero(data,undefined,id);console.log(id,h.mountedVolume);h.dispose();}
