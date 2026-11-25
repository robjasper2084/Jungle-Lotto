import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {HeroDetail} from '../../runtime/ride-core/src/heroDetail.ts';
import {animeRider} from './referenceActors.ts';
import {batchArmoredInk} from './riderInkBatch.ts';

// Independent byte receipts from the actual shipped rig and unchanged 16-bit
// HeroDetail, before the guarded storage change. Geometry and pose must agree.
const expectedAttributes={
 position:'fdc0d519efbb9b078ec9d6dd4529960eb07801cb0bca1242ad8010fbd2d43deb',
 normal:'2ab2f9a7017a4d171c898ef0b927c0474f3fc5def10054de9aa6aea80ef2b1f6',
 uv:'ac8f506255100f9faa5ab9875d3c8dd25d3e95af47f71ce62c09bdc794578732',
 skinWeight:'583e7cd030a54e95b3bd5465f9d4e948a5526ccdbb107aa5f43de75706d15248'
};
const expectedSkin='0d8d2350af3ace6c231af57c7365807d5aa5e39a5127905cb1edb29f9243a7e8';
const expectedIndex='d8129bec657e7a669e9348b7c85db667a350f59239bf8210478a928680098a70';
const expectedPoses=[
 'b4e764dc4a9bc6a9e32f01f3b57b313beaeb5d0318de6954e48ee00eec6929d8',
 'fcd4253ab22bfab0ac2c421abf9656fb213e81d3a5a1c857f5fb01bc3bd2ed81',
 'c06b560bf7f45a51f4e231acee007f2f8c013230d106c7391c83a4d68830e8e9'
];
const hash=(array:ArrayBufferView)=>createHash('sha256').update(new Uint8Array(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
let asset:GLTF;const textures:T.Texture[]=[];
before(async()=>{
 const bytes=readFileSync(new URL('../../public/exports/rigged-heroes/DS_Armored_Rider_01.glb',import.meta.url));
 assert.equal(hash(bytes),'b213894836ccc70eae371ffef6fb6a41688537f08c59aed6ea93dfd96f491674','actual committed rig');
 const loader=new GLTFLoader();
 loader.register(()=>({name:'CPU_SKIN_INDEX_TEST',loadTexture:async()=>{const texture=new T.Texture();textures.push(texture);return texture;}}));
 asset=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
});
after(()=>textures.forEach(texture=>texture.dispose()));

function construct(padding=0){
 const scene=new T.Scene(),actor=new T.Group(),rider=clone(asset.scene);scene.add(actor);actor.add(rider);
 if(asset.animations[0]){const mixer=new T.AnimationMixer(rider);mixer.clipAction(asset.animations[0]).play();mixer.setTime(0);}
 if(padding){
  const prefix=new T.Group();for(let i=0;i<padding;i++){const bone=new T.Bone();bone.name='Index-padding-'+i;prefix.add(bone);}
  rider.add(prefix);rider.children.splice(rider.children.indexOf(prefix),1);rider.children.unshift(prefix);
 }
 const originals:{mesh:T.Mesh;geometry:T.BufferGeometry;attributes:Record<string,T.BufferAttribute|T.InterleavedBufferAttribute>;index:T.BufferAttribute|null}[]=[];
 rider.traverse(o=>{if(o instanceof T.Mesh)originals.push({mesh:o,geometry:o.geometry,attributes:{...o.geometry.attributes},index:o.geometry.index});});
 const detail=new HeroDetail(rider),mesh=rider.getObjectByName('Fitted hero cuffs, knuckles and tailoring');
 assert(mesh instanceof T.SkinnedMesh);assert.equal(mesh.geometry.attributes.position.count,14904);assert.equal(mesh.geometry.index?.count,14904);
 for(const row of originals){assert.equal(row.mesh.geometry,row.geometry);assert.equal(row.geometry.index,row.index);for(const [name,a] of Object.entries(row.attributes))assert.equal(row.geometry.getAttribute(name),a,'source attribute '+name);}
 return {scene,actor,rider,mesh,dispose(){scene.remove(actor);detail.dispose();}};
}
function unchangedGeometry(mesh:T.SkinnedMesh){
 assert.deepEqual(Object.keys(mesh.geometry.attributes).sort(),['normal','position','skinIndex','skinWeight','uv']);
 for(const [name,expected] of Object.entries(expectedAttributes))assert.equal(hash((mesh.geometry.getAttribute(name) as T.BufferAttribute).array),expected,name+' byte receipt');
 assert.equal(hash(mesh.geometry.index!.array),expectedIndex,'original index order');
 assert.deepEqual(mesh.geometry.groups,[{start:0,count:4536,materialIndex:0},{start:4536,count:10368,materialIndex:1}]);
 const a=mesh.geometry.getAttribute('skinIndex') as T.BufferAttribute;
 assert.equal(a.count,14904);assert.equal(a.itemSize,4);assert.equal(a.normalized,false);assert.equal(a.usage,T.StaticDrawUsage);assert.equal(a.gpuType,T.FloatType);
 assert.equal(mesh.castShadow,true);assert.equal(mesh.receiveShadow,true);assert.equal(mesh.frustumCulled,false);assert.equal(mesh.bindMode,'attached');
 assert(mesh.bindMatrix.equals(new T.Matrix4()));assert(mesh.bindMatrixInverse.equals(new T.Matrix4()));
 assert.deepEqual((mesh.material as T.MeshStandardMaterial[]).map(m=>({name:m.name,color:m.color.getHex(),metalness:m.metalness,roughness:m.roughness,side:m.side,transparent:m.transparent})),[
  {name:'Hero detail / stitched charcoal',color:0x252d30,metalness:0,roughness:.86,side:T.FrontSide,transparent:false},
  {name:'Hero detail / brushed fasteners',color:0x6c7678,metalness:.65,roughness:.48,side:T.FrontSide,transparent:false}
 ]);
}
function advancePose(rider:T.Object3D,stage:number){
 const bone=(name:string)=>{const found=rider.getObjectByName(name);assert(found);return found;};
 if(stage===1){bone('LeftForeArm').rotation.z+=.25;bone('RightForeArm').rotation.y-=.18;bone('Spine').rotation.x+=.12;bone('LeftFoot').rotation.x+=.17;}
 if(stage===2){bone('Hips').position.y+=.08;bone('RightFoot').rotation.z-=.23;bone('LeftHand').rotation.y+=.31;}
 rider.updateMatrixWorld(true);
}
function poseHash(mesh:T.SkinnedMesh){
 mesh.skeleton.update();const values=new Float64Array(mesh.geometry.attributes.position.count*3),v=new T.Vector3();
 for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v);v.toArray(values,i*3);}
 return hash(values);
}

test('actual generated hero detail preserves every index value and authored geometry while using the byte layout',t=>{
 const row=construct();t.after(()=>row.dispose());unchangedGeometry(row.mesh);
 const skin=row.mesh.geometry.getAttribute('skinIndex') as T.BufferAttribute;
 assert(skin.array instanceof Uint8Array);assert.equal(skin.array.byteLength,59616);
 assert.equal(hash(new Uint16Array(skin.array)),expectedSkin,'all 59616 integer components match the original 16-bit values');
 assert.equal(Math.min(...new Set(skin.array)),0);assert.equal(Math.max(...new Set(skin.array)),48);assert.equal(row.mesh.skeleton.bones.length,54);
});

test('palette boundary keeps255 exact and falls back to16-bit at256 without changing geometry or weights',t=>{
 const original=construct();t.after(()=>original.dispose());
 const originalSkin=original.mesh.geometry.getAttribute('skinIndex') as T.BufferAttribute,weights=original.mesh.geometry.getAttribute('skinWeight') as T.BufferAttribute;
 for(const padding of [207,208,300]){
  const row=construct(padding);t.after(()=>row.dispose());unchangedGeometry(row.mesh);
  const skin=row.mesh.geometry.getAttribute('skinIndex') as T.BufferAttribute;
  assert.equal(skin.array.constructor,padding===207?Uint8Array:Uint16Array,'complete generated values determine storage, not total palette length');
  const expected=Uint16Array.from(originalSkin.array,(value,i)=>weights.array[i]>0?value+padding:value);
  assert.deepEqual(new Uint16Array(skin.array),expected,'including all unused zero components');
  assert.equal(Math.max(...new Set(skin.array)),48+padding);
  assert.equal(row.mesh.skeleton.bones.length,54+padding);
 }
});

test('byte and fallback palettes preserve all skinned vertices in three independent authored poses',t=>{
 for(const padding of [0,208]){
  const row=construct(padding);t.after(()=>row.dispose());
  for(let stage=0;stage<expectedPoses.length;stage++){advancePose(row.rider,stage);assert.equal(poseHash(row.mesh),expectedPoses[stage],'pose'+stage+' with palette padding'+padding);}
 }
 const control=construct();t.after(()=>control.dispose());advancePose(control.rider,1);
 const skin=control.mesh.geometry.getAttribute('skinIndex') as T.BufferAttribute;
 const left=control.mesh.skeleton.bones.findIndex(b=>b.name==='LeftForeArm'),right=control.mesh.skeleton.bones.findIndex(b=>b.name==='RightForeArm');
 for(let i=0;i<skin.count;i++)if(skin.getX(i)===left)skin.setX(i,right);
 assert.notEqual(poseHash(control.mesh),expectedPoses[1],'the pose oracle detects a wrongly rebound cuff');
});

test('real anime and armored-ink composition shares one byte input layout without changing silhouette shaders or source meshes',t=>{
 const row=construct();t.after(()=>row.dispose());const geometry=row.mesh.geometry;
 animeRider(row.rider);batchArmoredInk(row.rider,row.actor);
 const outlines:T.SkinnedMesh[]=[];row.rider.traverse(o=>{if(o instanceof T.SkinnedMesh&&o.userData.referenceInk&&(o.material as T.Material).visible)outlines.push(o);});
 assert.equal(outlines.length,4);
 assert.deepEqual(outlines.map(o=>[o.geometry.attributes.position.count,o.geometry.index!.count]).sort((a,b)=>a[0]-b[0]),[[560,3288],[560,3288],[14904,14904],[48659,139710]]);
 const shaders=new Set<string>();
 for(const outline of outlines){
  const skin=outline.geometry.getAttribute('skinIndex') as T.BufferAttribute;
  assert(skin.array instanceof Uint8Array);assert.equal(skin.itemSize*skin.array.BYTES_PER_ELEMENT,4);assert.equal(skin.normalized,false);
  const material=outline.material as T.Material;assert.equal(material.customProgramCacheKey(),'reference-rider-ink-v1');assert.equal(material.side,T.BackSide);
  const shader={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader} as Parameters<T.Material['onBeforeCompile']>[0];
  material.onBeforeCompile(shader,{} as T.WebGLRenderer);assert(shader.vertexShader.includes('transformed+=normal*.006;'));shaders.add(shader.vertexShader+'\n'+shader.fragmentShader);
 }
 assert.equal(shaders.size,1);assert.equal(row.mesh.geometry,geometry);
 const detailInk=row.mesh.children.find(o=>o.userData.referenceInk) as T.SkinnedMesh;
 assert.equal(detailInk.geometry,geometry);assert.equal(detailInk.skeleton,row.mesh.skeleton);assert.equal(detailInk.bindMode,row.mesh.bindMode);
 assert(detailInk.bindMatrix.equals(row.mesh.bindMatrix));assert(detailInk.bindMatrixInverse.equals(row.mesh.bindMatrixInverse));
});
