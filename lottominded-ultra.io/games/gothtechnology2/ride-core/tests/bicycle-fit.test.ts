import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BicycleView} from '../dist/cyclingView.js';
import {createPose} from '../src/controller.ts';
// Exercise the shipped skeletons and mechanical nodes without needing a GPU or image decoder.
async function asset(id:string,lod:number){const b=await readFile(new URL(`../../Digital_Static_Street_Asset_Pack/exports/glb/${id}/${id}_LOD${lod}.glb`,import.meta.url)),n=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+n));
 delete j.images;delete j.textures;delete j.samplers;j.materials=(j.materials??[]).map((m:{name:string})=>({name:m.name}));
 let json=JSON.stringify(j);while(json.length%4)json+=' ';const chunk=b.subarray(20+n),out=Buffer.alloc(20+json.length+chunk.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);out.writeUInt32LE(0x4e4f534a,16);out.write(json,20);chunk.copy(out,20+json.length);return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');}
test('both shipped human rigs can pedal without crossed legs or missing hand sockets',async()=>{
 for(const model of ['DS_Bicycle_01','DS_Bicycle_Styles']){
 const bike=await asset(model,1);
 for(const style of model==='DS_Bicycle_Styles'?[0,1,2,3,4,5]:[0])
 for(const [id,lod,npc] of [['DS_Man_01',0,false],['DS_Cyclist_01',1,true]] as const){const rider=await asset(id,lod),view=new BicycleView(bike,rider,style,npc),p=createPose();
   if(model==='DS_Bicycle_Styles'){
     const frames:T.Object3D[]=[];view.bike.traverse(o=>{if(/^BikeStyle_\d+$/.test(o.name))frames.push(o);});
     assert.deepEqual(frames.map(o=>o.name),[`BikeStyle_${style}`]);
     for(let i=0;i<6;i++)assert.ok(bike.scene.getObjectByName(`BikeStyle_${i}`),'source mutated');
     const fender=view.bike.getObjectByName(`BikeStyleFront_${style}`);
     if(style<4)assert.equal(fender?.parent?.name,'Bicycle_Steering_Pivot');
     if(style===0)assert.equal(view.bike.getObjectByName('City wire basket')?.parent?.name,'Bicycle_Steering_Pivot');
   }
   for(const phase of [0,Math.PI/2,Math.PI,Math.PI*1.5]){view.apply(p,.2,phase);view.root.updateMatrixWorld(true);
     const left=view.rider.getObjectByName('LeftFoot')!.getWorldPosition(new T.Vector3()),right=view.rider.getObjectByName('RightFoot')!.getWorldPosition(new T.Vector3());
     assert.ok(left.x>0&&right.x<0,id+' legs crossed');assert.ok(Math.min(left.y,right.y)>-.03,id+' foot below road');
     for(const [hand,grip] of [['LeftHand','Grip001'],['RightHand','Grip']])assert.ok(view.rider.getObjectByName(hand)!.getWorldPosition(new T.Vector3()).distanceTo(view.bike.getObjectByName(grip)!.getWorldPosition(new T.Vector3()))<.03,id+' '+hand+' '+view.rider.getObjectByName(hand)!.getWorldPosition(new T.Vector3()).toArray()+' target '+view.bike.getObjectByName(grip)!.getWorldPosition(new T.Vector3()).toArray());
   }view.dispose();
 }}
});


