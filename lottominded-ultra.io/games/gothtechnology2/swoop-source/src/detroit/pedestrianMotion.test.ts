import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Scene,Texture,Vector3} from 'three';
import {assetPath} from './testAssets.ts';
import {FootTraffic,footStride,gaitTiming} from './footTraffic.ts';
import {TrafficView} from './actors.ts';
import {ElmwoodWalkerView} from './photographerView.ts';
const loader=new GLTFLoader();loader.register(()=>({name:'headless',loadTexture:()=>Promise.resolve(new Texture())}));
async function asset(id:string){const b=await readFile(assetPath(`exports/glb/${id}/${id}_LOD1.glb`));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const hoodie=await asset('DS_Hoodie_Man_01');
test('slowing pedestrians keep the planted foot still in world space',()=>{
  for(const jog of [false,true])for(const speed of [.25,.65,1.1,2.65]){
    const person=new FootTraffic(hoodie,jog);person.phase=.15;person.apply(speed,0);
    const before=person.footTargets[0].clone();person.root.position.z+=speed/120;person.apply(speed,1/120);
    assert(footStride(person.phase,speed,jog,person.legLength).stance);
    assert(Math.abs(person.footTargets[0].z-before.z)<1e-6,`planted foot slides at ${speed}m/s`);
    assert(person.legs[0].end.getWorldPosition(new Vector3()).distanceTo(person.footTargets[0])<.015);
    person.dispose();
  }
});
test('nearby and paced distant actors retain all elapsed gait time',()=>{
  for(const distance of [0,70,150])for(const id of [1,5,19]){
    const view=new TrafficView(new Scene(),new Map([['DS_Hoodie_Man_01',hoodie],['DS_Hoodie_Woman_01',hoodie]]));
    const actor={id,kind:'pedestrian' as const,x:distance,y:0,z:0,heading:0,speed:.65};
    view.update([actor],0,{x:0,z:0});const item=view.items.get(id)!,start=item.foot!.phase;
    for(let frame=0;frame<120;frame++){actor.z+=actor.speed/60;view.update([actor],1/60,{x:0,z:0});}
    const seconds=2-item.animationAge!,expected=(start+seconds*gaitTiming(actor.speed,false,item.foot!.legLength).cadence)%1;
    assert(Math.abs(item.foot!.phase-expected)<1e-9,`lost animation time for actor ${id} at ${distance}m`);
    view.update([],0);
  }
});
test('photographers keep bone lengths and hands on the camera through turns and pose transitions',async()=>{
  const data=await asset('DS_Pedestrian_01');
  for(const heading of [0,Math.PI/2,Math.PI]){
    const view=new ElmwoodWalkerView(data);view.root.position.set(10,0,-4);view.root.rotation.y=heading;
    const bind=new Map<string,{position:Vector3;scale:Vector3}>();view.model.traverse(b=>{if(b.type==='Bone')bind.set(b.name,{position:b.position.clone(),scale:b.scale.clone()});});
    let previous:Vector3[]=[];
    for(let frame=0;frame<240;frame++){
      const photo=frame>=60&&frame<180,travel=photo?0:.9/60;
      view.root.position.x+=Math.sin(heading)*travel;view.root.position.z+=Math.cos(heading)*travel;
      view.update(travel,1/60,photo,()=>0);
      view.model.traverse(b=>{const rest=bind.get(b.name);if(rest){assert(b.scale.distanceTo(rest.scale)<1e-7);if(b.name!=='Hips')assert(b.position.distanceTo(rest.position)<1e-7,`stretched ${b.name}`);}});
      const hands=['LeftHand','RightHand'].map(n=>view.model.getObjectByName(n)!.getWorldPosition(new Vector3()));
      hands.forEach((h,i)=>{assert(h.toArray().every(Number.isFinite));if(previous.length)assert(h.distanceTo(previous[i])<.06,'hand snaps at '+frame+' heading '+heading+': '+h.distanceTo(previous[i]));
        if(frame>150&&frame<180){const grip=view.phone.localToWorld(new Vector3(i?-.056:.056,-.035,-.008));assert(h.distanceTo(grip)<.005,'hand misses camera grip');}});
      previous=hands;
    }
  }
});
