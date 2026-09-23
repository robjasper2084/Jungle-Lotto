import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assetPath as resolve} from './testAssets.ts';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3,Mesh,SkinnedMesh} from 'three';
import {FallMotion} from './fallMotion.ts';
import {Hero} from './actors.ts';
import {createPose} from './controller.ts';
import {RIDER_CHOICES,riderChoice} from './riderChoices.ts';
async function mesh(id:string,lod:number){
  const buf=await readFile(resolve('../../exports/glb',id,`${id}_LOD${lod}.glb`)),n=buf.readUInt32LE(12),j=JSON.parse(buf.subarray(20,20+n).toString());
  // Headless geometry/skeleton test; omit texture decoding only. No source asset is modified.
  delete j.images;delete j.textures;delete j.materials;for(const m of j.meshes)for(const p of m.primitives)delete p.material;
  const json=Buffer.from(JSON.stringify(j)),length=Math.ceil(json.length/4)*4,jsonPad=Buffer.alloc(length,32);json.copy(jsonPad);const bin=buf.subarray(20+n),out=Buffer.alloc(20+length+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(length,12);out.writeUInt32LE(0x4e4f534a,16);jsonPad.copy(out,20);bin.copy(out,20+length);
  return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.length),'');
}

const ids=['DS_Mascot_Suit_01','DS_Mascot_Hoodie_01'] as const;
const data=new Map(await Promise.all(['DS_EUC_01',...ids].map(async id=>[id,await mesh(id,1)] as const)));
test('both mascot choices persist and old choices remain selectable',()=>{assert.equal(RIDER_CHOICES.length,4);for(const id of ids)assert.equal(riderChoice(id),id);assert.equal(riderChoice('invalid'),'DS_Man_01');});
for(const id of ids)test(id+' has complete limbs and reachable pedals across riding poses',t=>{
 const h=new Hero(data,undefined,id);assert.equal(h.legs.length,2);assert.equal(h.arms.length,2);let error=0;
 for(const crouch of [0,.5,1])for(const bank of [-.5,0,.5]){
  const p=createPose();Object.assign(p,{crouch,tuck:crouch,rollAngle:bank,riderRoll:bank*.7,riderPitch:.15});h.apply(p);
  for(let i=0;i<2;i++){const e=h.legs[i].foot.getWorldPosition(new Vector3()).distanceTo(h.footTarget(i,p));if(e>.015)t.diagnostic('crouch '+crouch+' bank '+bank+' foot '+i+' err '+e);error=Math.max(error,e);}
 }
 const p=createPose();p.stopFoot=1;h.apply(p);for(let i=0;i<2;i++){assert.ok(h.footTarget(i,p).distanceTo(h.pedalTarget(h.legs[i],0))<1e-8,'mascots must not step off at a stop');error=Math.max(error,h.legs[i].foot.getWorldPosition(new Vector3()).distanceTo(h.footTarget(i,p)));}
 t.diagnostic('Maximum foot error '+error);assert.ok(error<.015,id+' foot targets unreachable '+error);h.dispose();
});


test('mascot recovery envelopes retain their custom smaller mounted dimensions',()=>{
 for(const id of ids){const hero=new Hero(data,undefined,id);assert.ok(hero.mountedVolume.radius>.4&&hero.mountedVolume.radius<1);assert.ok(hero.mountedVolume.height>1&&hero.mountedVolume.height<2);hero.dispose();}
});

test('both short mascot rigs brace, fall and recover without stretched bones or sunken skin',()=>{
 for(const id of ids)for(const side of [-1,1]){
  const h=new Hero(data,undefined,id),p=createPose();Object.assign(p,{speed:7,rollAngle:side*.3,naturalMotion:1});
  const lengths=[...h.legs,...h.arms].map(l=>[l.upper.getWorldPosition(new Vector3()).distanceTo(l.knee.getWorldPosition(new Vector3())),l.knee.getWorldPosition(new Vector3()).distanceTo(l.foot.getWorldPosition(new Vector3()))]);
  const f=new FallMotion(p,'collision');
  for(const age of [.2,.4,.6,1.2,2]){
   f.sample(age,p);h.apply(p);
   [...h.legs,...h.arms].forEach((l,i)=>{
    assert.ok(Math.abs(l.upper.getWorldPosition(new Vector3()).distanceTo(l.knee.getWorldPosition(new Vector3()))-lengths[i][0])<.001);
    assert.ok(Math.abs(l.knee.getWorldPosition(new Vector3()).distanceTo(l.foot.getWorldPosition(new Vector3()))-lengths[i][1])<.001);
   });
   h.rider.traverse(o=>{const m=o as Mesh;if(!m.isMesh)return;if((m as SkinnedMesh).isSkinnedMesh)(m as SkinnedMesh).skeleton.update();
    for(let i=0;i<m.geometry.attributes.position.count;i++){const v=m.getVertexPosition(i,new Vector3()).applyMatrix4(m.matrixWorld);assert.ok(v.y>-.025,id+' falls below ground');}
   });
  }
  h.apply(createPose());for(const l of h.legs)assert.ok(l.foot.getWorldPosition(new Vector3()).distanceTo(h.pedalTarget(l,0))<.015);
  h.dispose();
 }
});
