from pathlib import Path
p=Path('src/detroit/rig.test.ts').read_text(encoding='utf-8')
helper=p[p.index('async function mesh'):p.index("const data=new Map")]
helper=helper.replace("resolve('../../exports/glb',id,", "resolve(id.startsWith('DS_Segway')||id.startsWith('DS_Inline')?'../../exports/mobility':'../../exports/glb/'+id,")
helper=helper.replace("`${id}_LOD${lod}.glb`","id.startsWith('DS_Segway')||id.startsWith('DS_Inline')?`${id}.glb`:`${id}_LOD${lod}.glb`")
head="""import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Scene,Vector3,Box3} from 'three';
import {TrafficView} from './actors.ts';
import {trafficAt,trafficBounds,DetroitWorld,cutPoint} from './world.ts';
"""
tail="""
const data=new Map([['DS_Pedestrian_01',await mesh('DS_Pedestrian_01',1)],['DS_Segway_01',await mesh('DS_Segway_01',0)],['DS_InlineSkate_01',await mesh('DS_InlineSkate_01',0)]]);
test('Blender equipment has two side-by-side scooter wheels and four inline wheels per skate',()=>{
 const scooter=data.get('DS_Segway_01')!.scene;scooter.updateMatrixWorld(true);
 const a=scooter.getObjectByName('Segway_Wheel_L')!.getWorldPosition(new Vector3()),b=scooter.getObjectByName('Segway_Wheel_R')!.getWorldPosition(new Vector3());
 assert.ok(Math.abs(a.x-b.x)>.65&&Math.abs(a.z-b.z)<.001);
 const bounds=new Box3().setFromObject(scooter);assert.ok(bounds.min.y>-.005&&bounds.max.y<1.3,JSON.stringify(bounds));
 let wheels=0;data.get('DS_InlineSkate_01')!.scene.traverse(o=>{if(o.name.startsWith('Skate_Wheel_'))wheels++;});assert.equal(wheels,4);
});
for(const kind of ['segway','skater'] as const)test(kind+' knees bend forward; feet track equipment; pause freezes wheel and stride',()=>{
 const view=new TrafficView(new Scene(),data),a={id:41,kind,x:8,y:2,z:-6,heading:1.1,speed:2.8};let reach=0,lift=0;
 for(let i=0;i<150;i++){
  view.update([a],1/60);const m=view.items.get(a.id)!.mobility!;
  for(let j=0;j<2;j++){const l=m.legs[j],hip=l.upper.getWorldPosition(new Vector3()),foot=l.end.getWorldPosition(new Vector3()),axis=foot.clone().sub(hip).normalize(),bend=l.joint.getWorldPosition(new Vector3()).sub(hip);bend.addScaledVector(axis,-bend.dot(axis));
   assert.ok(foot.distanceTo(m.footTargets[j])<.006,kind+' detached foot');
   assert.ok(bend.dot(new Vector3(0,0,1).transformDirection(m.root.matrixWorld))>.035,kind+' backward knee');
   if(kind==='segway')assert.ok(m.arms[j].end.getWorldPosition(new Vector3()).distanceTo(m.handTargets[j])<.008,'hand off handlebar');
  }
  if(kind==='skater'){reach=Math.max(reach,Math.abs(m.skates[0].position.x));lift=Math.max(lift,m.skates[0].position.y);}
 }
 const m=view.items.get(a.id)!.mobility!,phase=m.phase,wheel=m.wheelTurn;view.update([a],0);assert.equal(m.phase,phase);assert.equal(m.wheelTurn,wheel);
 if(kind==='skater'){assert.ok(reach>.28&&lift>.05,'missing push/recovery');}
 view.update([],0);assert.equal(view.items.size,0);
});
test('new mobility modes are mixed with walkers and bicycles and have mapped colliders',async()=>{
 const kinds=new Set(Array.from({length:62},(_,id)=>trafficAt(id,0).kind));for(const k of ['segway','skater','pedestrian','cyclist'])assert.ok(kinds.has(k as any));
 const world=await new DetroitWorld().init();
 for(const kind of ['segway','skater'] as const){const id=Array.from({length:62},(_,i)=>i).find(i=>trafficAt(i,0).kind===kind)!;const a=trafficAt(id,0);world.updateTraffic(0,a.x,a.z);world.step();const c=world.trafficBodies.get(id)!;const b=trafficBounds(kind);assert.ok(Math.abs(c.halfExtents().x-b.hx)<.0001);assert.ok(Math.abs(c.translation().y-a.y-b.hy)<.001);const next=trafficAt(id,1);assert.ok(Math.hypot(next.x-a.x,next.z-a.z)>2);}
 world.physics.free();
});
"""
Path('src/detroit/mobilityTraffic.test.ts').write_text(head+helper+tail,encoding='utf-8')

