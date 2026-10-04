import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {Vector3,Mesh,SkinnedMesh} from 'three';
import {assetPath} from './testAssets.ts';import {RetailWalker,type RetailWalkClip} from './retailWalker.ts';
async function loadHero(){const buf=await readFile(assetPath('exports/glb/DS_Man_01/DS_Man_01_LOD0.glb')),n=buf.readUInt32LE(12),j=JSON.parse(buf.subarray(20,20+n).toString());delete j.images;delete j.textures;delete j.materials;for(const m of j.meshes)for(const p of m.primitives)delete p.material;const json=Buffer.from(JSON.stringify(j)),length=Math.ceil(json.length/4)*4,pad=Buffer.alloc(length,32);json.copy(pad);const bin=buf.subarray(20+n),out=Buffer.alloc(20+length+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(length,12);out.writeUInt32LE(0x4e4f534a,16);pad.copy(out,20);bin.copy(out,20+length);return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.length),'');}
const hero=await loadHero(),clip:RetailWalkClip=JSON.parse(await readFile(new URL('../../public/exports/polish/hero-retail-walk.json',import.meta.url),'utf8'));
test('Blender retarget preserves the hero, joined limbs, continuous steps and floor contact',()=>{
 const w=new RetailWalker(hero,clip);let previous:Vector3[]=[];const hands:number[][]=[[],[]];let min=Infinity,max=0;
 for(let i=0;i<180;i++){
  w.root.position.z+=1.4/60;w.apply(1.4,1/60);
  for(const bone of w.bones)if(bone.o!==w.hips)assert.ok(bone.o.position.distanceTo(bone.p)<1e-6,'retarget must not change limb lengths');
  const points=w.arms.map(a=>a.end.getWorldPosition(new Vector3()));for(let k=0;k<2;k++){if(previous.length)assert.ok(points[k].distanceTo(previous[k])<.09,'hand snaps');const s=w.arms[k].upper.getWorldPosition(new Vector3()),e=w.arms[k].joint.getWorldPosition(new Vector3());assert.ok(e.y<s.y-.12,'arm raised while walking');assert.ok(Math.abs(e.x)>.10,'elbow intersects torso');hands[k].push(points[k].z-w.root.position.z);}previous=points;
  for(let k=0;k<2;k++){const p=w.legs[k].end.getWorldPosition(new Vector3());assert.ok(p.distanceTo(w.footTargets[k])<.018,'foot IK misses its target');}
  if(i%3===0){w.rider.traverse(o=>{const m=o as Mesh;if(!m.isMesh)return;if((m as SkinnedMesh).isSkinnedMesh)(m as SkinnedMesh).skeleton.update();for(let k=0;k<m.geometry.attributes.position.count;k+=4){const p=m.getVertexPosition(k,new Vector3()).applyMatrix4(m.matrixWorld);assert.ok(Number.isFinite(p.x+p.y+p.z));min=Math.min(min,p.y);}});}
 }
 for(const h of hands)max=Math.max(max,Math.max(...h)-Math.min(...h));assert.ok(max>.17,'real walk should have a visible arm swing');assert.ok(min>-.025,'shoe penetrates floor '+min);
 for(let i=0;i<90;i++)w.apply(0,1/60);assert.ok(w.hips.getWorldPosition(new Vector3()).y>.8,'walker must settle upright');
});
test('baked loop has finite normalized rotations and closes without a jump',()=>{assert.match(clip.source,/Kevin Iglesias/);for(const [name,a] of Object.entries(clip.bones)){assert.equal(a.length,clip.times.length*4);for(let i=0;i<a.length;i+=4){assert.ok(a.slice(i,i+4).every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...a.slice(i,i+4))-1)<1e-5);}const dot=a.slice(0,4).reduce((n,v,i)=>n+v*a[a.length-4+i],0);assert.ok(Math.abs(dot)>.998,'loop mismatch '+name);}});
