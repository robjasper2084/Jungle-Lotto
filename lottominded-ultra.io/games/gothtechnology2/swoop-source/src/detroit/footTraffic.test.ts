import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assetPath as resolve} from './testAssets.ts';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3,Mesh,SkinnedMesh,Scene} from 'three';
import {FootTraffic,footStride,gaitTiming} from './footTraffic.ts';
import {TrafficView} from './actors.ts';
import {trafficAt} from './world.ts';
import {HumanFallRig} from './humanFallRig.ts';
import {TrafficFall} from './trafficFall.ts';
import {createGroundSample,type TerrainSampler} from './terrain.ts';
const fallFloor:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,createGroundSample());},raycast:()=>null,raycastObstacle:()=>null};
async function mesh(id:string,lod:number){
  const buf=await readFile(resolve('../../exports/glb',id,`${id}_LOD${lod}.glb`)),n=buf.readUInt32LE(12),j=JSON.parse(buf.subarray(20,20+n).toString());
  // Headless geometry/skeleton test; omit texture decoding only. No source asset is modified.
  delete j.images;delete j.textures;delete j.materials;for(const m of j.meshes)for(const p of m.primitives)delete p.material;
  const json=Buffer.from(JSON.stringify(j)),length=Math.ceil(json.length/4)*4,jsonPad=Buffer.alloc(length,32);json.copy(jsonPad);const bin=buf.subarray(20+n),out=Buffer.alloc(20+length+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(length,12);out.writeUInt32LE(0x4e4f534a,16);jsonPad.copy(out,20);bin.copy(out,20+length);
  return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.length),'');
}
test('stance cancels forward travel; walk has double support and jog has flight',()=>{
  for(const jog of [false,true]){
    const speed=jog?2.65:1.1,cadence=jog?1.42:.88,a=footStride(.1,speed,jog),b=footStride(.1+cadence*.001,speed,jog);
    assert.ok(Math.abs(b.z-a.z+speed*.001)<1e-8,'planted foot slides on level ground');
    let double=0,flight=0,lift=0;
    for(let i=0;i<100;i++){const a=footStride(i/100,speed,jog),b=footStride(i/100+.5,speed,jog);if(a.stance&&b.stance)double++;if(!a.stance&&!b.stance)flight++;lift=Math.max(lift,a.lift);}
    assert.ok(jog?flight>0&&double===0:double>0&&flight===0);assert.ok(lift>(jog?.16:.06));
  }
});
const data=new Map(await Promise.all(['DS_Hoodie_Man_01','DS_Hoodie_Woman_01'].map(async id=>[id,await mesh(id,1)] as const)));

test('both loaded hoodie skins keep joined limbs and ground contact through impact and get-up',()=>{
 for(const asset of data.values())for(const side of [-1,1]){
  const person=new FootTraffic(asset,false);person.apply(1.1,0);
  const bones:{o:any;p:Vector3}[]=[];person.rider.traverse(o=>{if((o as any).isBone)bones.push({o,p:o.position.clone()});});
  const rig=new HumanFallRig(person.rider,[],fallFloor),motion=new TrafficFall({x:0,y:0,z:0,heading:0,speed:1.1},{speed:15,vx:side*4,vz:7});
  for(let i=0;i<84;i++){
   motion.step(.1,fallFloor);rig.apply(motion.pose,0);person.root.updateMatrixWorld(true);
   for(const b of bones)assert.ok(b.o.position.distanceTo(b.p)<1e-7,'bone translations must not stretch');
   let lowest=Infinity;
   person.rider.traverse(o=>{const m=o as Mesh;if(!m.isMesh)return;if((m as SkinnedMesh).isSkinnedMesh)(m as SkinnedMesh).skeleton.update();for(let k=0;k<m.geometry.attributes.position.count;k+=3){const p=m.getVertexPosition(k,new Vector3()).applyMatrix4(m.matrixWorld);assert.ok(Number.isFinite(p.x+p.y+p.z));lowest=Math.min(lowest,p.y);}});
   assert.ok(lowest>-.035,'skin penetrates floor '+lowest);if(motion.pose.crashContact>.9)assert.ok(lowest<.09,'contact should reach the ground '+lowest);
  }
  assert.equal(motion.done,true);rig.restore();person.apply(1.1,1/60);
  for(let j=0;j<2;j++)assert.ok(person.legs[j].end.getWorldPosition(new Vector3()).distanceTo(person.footTargets[j])<.015,'walking resumes on the feet');
 }
});
test('walking elbows swing behind and ahead of the body without crossing the torso or snapping',()=>{
 for(const asset of data.values()){
  const walker=new FootTraffic(asset,false);let previous:Vector3[]=[];
  for(let i=0;i<=120;i++){
   walker.phase=i/120;walker.apply(1.1,0);
   const hands=walker.arms.map(l=>l.end.getWorldPosition(new Vector3()));
   for(let k=0;k<2;k++){
    const l=walker.arms[k],shoulder=l.upper.getWorldPosition(new Vector3()),elbow=l.joint.getWorldPosition(new Vector3());
    assert.ok(Math.abs(elbow.x)>.12,'elbow enters torso');assert.ok(elbow.y<shoulder.y-.18,'walking elbow held unnaturally high');
    if(previous.length)assert.ok(hands[k].distanceTo(previous[k])<.025,'hand snaps within stride');
   }
   previous=hands;
  }
 }
});

test('running hands travel from the hip to the ribs with opposing arm strokes and continuous elbows',()=>{
 for(const asset of data.values()){
  const p=new FootTraffic(asset,true);const z=[[],[]] as number[][];let previous:Vector3[]=[];
  for(let i=0;i<=160;i++){
   p.phase=i/160;p.apply(3.8,0);const hands=p.arms.map(l=>l.end.getWorldPosition(new Vector3()));
   p.arms.forEach((l,k)=>{const s=l.upper.getWorldPosition(new Vector3()),e=l.joint.getWorldPosition(new Vector3()),h=hands[k];z[k].push(h.z-s.z);assert.ok(e.y<s.y-.17,'elbow should hang below shoulder');assert.ok(Math.abs(h.x)>.10,'hand crosses the centreline');if(previous.length)assert.ok(h.distanceTo(previous[k])<.035,'hand snaps');});previous=hands;
  }
  for(const a of z){assert.ok(Math.min(...a)<-.07,'backstroke must reach behind the hip');assert.ok(Math.max(...a)>.3,'forward stroke must rise toward ribs');}
  for(let i=0;i<80;i++)assert.ok(Math.abs(z[0][i]-z[1][i+80])<.08,'arms should alternate');
 }
});
for(const [id,asset] of data)for(const speed of [1.1,2.65,3.8])test(id+' '+speed+'m/s keeps limbs joined, knees forward, and shoes clear',t=>{
  const jog=speed>2;
  const person=new FootTraffic(asset,jog);person.root.position.set(7,0,-15);person.root.rotation.y=.6;
  let error=0,lowest=Infinity,maxLift=0;const forward=new Vector3(Math.sin(.6),0,Math.cos(.6));
  for(let i=0;i<24;i++){
    person.phase=i/24;person.apply(speed,0);
    for(let k=0;k<2;k++){
      const l=person.legs[k],hip=l.upper.getWorldPosition(new Vector3()),knee=l.joint.getWorldPosition(new Vector3()),foot=l.end.getWorldPosition(new Vector3()),axis=foot.clone().sub(hip).normalize();
      const bend=knee.clone().sub(hip);bend.addScaledVector(axis,-bend.dot(axis));
      assert.ok(bend.dot(forward)>-.001,'knee bends backwards');error=Math.max(error,foot.distanceTo(person.footTargets[k]));maxLift=Math.max(maxLift,foot.y-l.rest.y);
    }
    person.root.traverse(o=>{const mesh=o as Mesh;if(!mesh.isMesh)return;if((mesh as SkinnedMesh).isSkinnedMesh)(mesh as SkinnedMesh).skeleton.update();for(let k=0;k<mesh.geometry.attributes.position.count;k++){const p=mesh.getVertexPosition(k,new Vector3()).applyMatrix4(mesh.matrixWorld);assert.ok(Number.isFinite(p.x+p.y+p.z));lowest=Math.min(lowest,p.y);}});
  }
  assert.ok(error<.015,`unreachable ankle targets ${error}`);assert.ok(lowest>-.003,`shoes below ground ${lowest}`);assert.ok(maxLift>(jog?.15:.06));
  const phase=person.phase;person.apply(jog?2.65:1.1,0);assert.equal(person.phase,phase);t.diagnostic(`foot error ${error.toFixed(5)}m, lowest surface ${lowest.toFixed(5)}m`);
});

test('heel strike, toe-off, and early heel recovery form a continuous gait',()=>{
  for(const speed of [1.1,2.65,3.8]){
    const jog=speed>2,{stance,cadence}=gaitTiming(speed,jog);
    assert.ok(footStride(0,speed,jog).pitch<0);
    assert.ok(footStride(stance-.001,speed,jog).pitch>.35);
    const early=footStride(stance+(1-stance)*.35,speed,jog),late=footStride(stance+(1-stance)*.65,speed,jog);
    assert.ok(early.lift>late.lift,'heel should recover behind the body before reaching forward');
    for(const boundary of [stance,1]){
      const a=footStride(boundary-1e-6,speed,jog),b=footStride(boundary+1e-6,speed,jog);
      assert.ok(Math.abs(a.lift-b.lift)<.0001&&Math.abs(a.pitch-b.pitch)<.0001&&Math.abs(a.z-b.z)<.0001,'foot snaps between phases');
    }
    const a=footStride(.1,speed,jog),b=footStride(.1+cadence*.001,speed,jog);
    assert.ok(Math.abs(b.z-a.z+speed*.001)<1e-8);
  }
  assert.ok(gaitTiming(1.1,false,.8).cadence>gaitTiming(1.1,false,1).cadence,'shorter legs need a faster cadence at the same speed');
});
test('live traffic instantiates both hoodie characters and both gait types',()=>{
  const scene=new Scene(),view=new TrafficView(scene,data),actors=Array.from({length:62},(_,id)=>trafficAt(id,0)).filter(a=>a.kind==='pedestrian'||a.kind==='jogger');
  view.update(actors,.016);assert.equal(view.items.size,actors.length);assert.ok([...view.items.values()].every(i=>!!i.foot));
  assert.ok([...view.items.values()].some(i=>i.foot!.jog));assert.ok([...view.items.values()].some(i=>!i.foot!.jog));
  view.update([],0);assert.equal(scene.children.length,0);
});
