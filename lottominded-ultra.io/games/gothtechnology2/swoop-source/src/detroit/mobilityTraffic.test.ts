import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assetPath as resolve} from './testAssets.ts';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Scene,Vector3,Box3} from 'three';
import {TrafficView} from './actors.ts';
import {trafficAt,trafficBounds,DetroitWorld,cutPoint} from './world.ts';
import {TrafficFall} from './trafficFall.ts';
import {createGroundSample,type TerrainSampler} from './terrain.ts';
async function mesh(id:string,lod:number){
  const buf=await readFile(id.startsWith('SW_')?new URL(`../../public/exports/scooter/${id}.glb`,import.meta.url):resolve(id.startsWith('DS_Segway')||id.startsWith('DS_Inline')?'../../exports/mobility':'../../exports/glb/'+id,id.startsWith('DS_Segway')||id.startsWith('DS_Inline')?`${id}.glb`:`${id}_LOD${lod}.glb`)),n=buf.readUInt32LE(12),j=JSON.parse(buf.subarray(20,20+n).toString());
  // Headless geometry/skeleton test; omit texture decoding only. No source asset is modified.
  delete j.images;delete j.textures;delete j.materials;for(const m of j.meshes)for(const p of m.primitives)delete p.material;
  const json=Buffer.from(JSON.stringify(j)),length=Math.ceil(json.length/4)*4,jsonPad=Buffer.alloc(length,32);json.copy(jsonPad);const bin=buf.subarray(20+n),out=Buffer.alloc(20+length+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(length,12);out.writeUInt32LE(0x4e4f534a,16);jsonPad.copy(out,20);bin.copy(out,20+length);
  return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.length),'');
}

const data=new Map([['DS_Pedestrian_01',await mesh('DS_Pedestrian_01',1)],['DS_Segway_01',await mesh('DS_Segway_01',0)],['DS_InlineSkate_01',await mesh('DS_InlineSkate_01',0)],['SW_Scooter_01',await mesh('SW_Scooter_01',0)],['SW_Detroit_Tee_Rider',await mesh('SW_Detroit_Tee_Rider',0)]]);
test('mobility fall keeps skates on the feet and restores both mobility rigs after getting up',()=>{
 const floor:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,createGroundSample());},raycast:()=>null,raycastObstacle:()=>null};
 for(const kind of ['segway','skater','scooter'] as const){
  const scene=new Scene(),view=new TrafficView(scene,data,floor),a={id:41,kind,x:0,y:0,z:0,heading:0,speed:2.8};view.update([a],.1);
  const fall=new TrafficFall({...a},{speed:12,vx:4,vz:6});
  for(let i=0;i<80;i++){fall.step(.1,floor);view.update([{...a,fall:fall.pose}],.1);const m=view.items.get(a.id)!.mobility!;if(kind==='skater')m.skates.forEach((s,j)=>assert.equal(s.parent,m.legs[j].end));const bounds=new Box3().setFromObject(m.rider,true);assert.ok(Number.isFinite(bounds.min.y));assert.ok(bounds.min.y>-.06);}
  view.update([a],.1);const m=view.items.get(a.id)!.mobility!;if(kind==='skater')m.skates.forEach(s=>assert.equal(s.parent,m.root));assert.equal(view.items.get(a.id)!.fallRig,undefined);
  m.legs.forEach((l,j)=>assert.ok(l.end.getWorldPosition(new Vector3()).distanceTo(m.footTargets[j])<.006));
 }
});
test('Blender equipment has two side-by-side scooter wheels and four inline wheels per skate',()=>{
 const scooter=data.get('DS_Segway_01')!.scene;scooter.updateMatrixWorld(true);
 const a=scooter.getObjectByName('Segway_Wheel_L')!.getWorldPosition(new Vector3()),b=scooter.getObjectByName('Segway_Wheel_R')!.getWorldPosition(new Vector3());
 assert.ok(Math.abs(a.x-b.x)>.65&&Math.abs(a.z-b.z)<.001);
 const bounds=new Box3().setFromObject(scooter);assert.ok(bounds.min.y>-.005&&bounds.max.y<1.3,JSON.stringify(bounds));
 let wheels=0;data.get('DS_InlineSkate_01')!.scene.traverse(o=>{if(o.name.startsWith('Skate_Wheel_'))wheels++;});assert.equal(wheels,4);
});
for(const kind of ['segway','skater','scooter'] as const)test(kind+' knees bend forward; feet track equipment; pause freezes wheel and stride',()=>{
 const view=new TrafficView(new Scene(),data),a={id:41,kind,x:8,y:2,z:-6,heading:1.1,speed:2.8};let reach=0,lift=0;
 for(let i=0;i<150;i++){
  view.update([a],1/60);const m=view.items.get(a.id)!.mobility!;
  if(i===0)assert.ok(m.wheelTurn>0,'forward travel must roll around the positive local X axle');
  for(let j=0;j<2;j++){const l=m.legs[j],hip=l.upper.getWorldPosition(new Vector3()),foot=l.end.getWorldPosition(new Vector3()),axis=foot.clone().sub(hip).normalize(),bend=l.joint.getWorldPosition(new Vector3()).sub(hip);bend.addScaledVector(axis,-bend.dot(axis));
   assert.ok(foot.distanceTo(m.footTargets[j])<.006,kind+' detached foot');
   assert.ok(bend.dot(new Vector3(0,0,1).transformDirection(m.root.matrixWorld))>.035,kind+' backward knee');
   if(kind==='segway'||kind==='scooter')assert.ok(m.arms[j].end.getWorldPosition(new Vector3()).distanceTo(m.handTargets[j])<.008,'hand off handlebar');
  }
  if(kind==='skater'){reach=Math.max(reach,Math.abs(m.skates[0].position.x));lift=Math.max(lift,m.skates[0].position.y);}
 }
 const m=view.items.get(a.id)!.mobility!,phase=m.phase,wheel=m.wheelTurn;view.update([a],0);assert.equal(m.phase,phase);assert.equal(m.wheelTurn,wheel);
 if(kind==='skater'){assert.ok(reach>.28&&lift>.05,'missing push/recovery');}
 view.update([],0);assert.equal(view.items.size,0);
});
test('new mobility modes are mixed with walkers and bicycles and have mapped colliders',async()=>{
 const kinds=new Set(Array.from({length:62},(_,id)=>trafficAt(id,0).kind));for(const k of ['segway','skater','scooter','pedestrian','cyclist'])assert.ok(kinds.has(k as any));
 const world=await new DetroitWorld().init();
 for(const kind of ['segway','skater','scooter'] as const){const id=Array.from({length:62},(_,i)=>i).find(i=>trafficAt(i,0).kind===kind)!;const a=trafficAt(id,0);world.updateTraffic(0,a.x,a.z);world.step();const c=world.trafficBodies.get(id)!;const b=trafficBounds(kind);assert.ok(Math.abs(c.halfExtents().x-b.hx)<.0001);assert.ok(Math.abs(c.translation().y-a.y-b.hy)<.001);const next=trafficAt(id,1);assert.ok(Math.hypot(next.x-a.x,next.z-a.z)>2);}
 world.physics.free();
});
