import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ElmwoodWalkerView,walkingFoot} from './elmwood-walker-view.ts';
import {resolveQuality,QUALITY_PRESETS} from './elmwood-quality.ts';
import {SWOOP_RIDERS,createRideCoreRiders} from './ridecore-riders.ts';
test('graphics respects an explicit choice and uses HD for capable hardware',()=>{
 assert.equal(resolveQuality('auto',4,4),'low');assert.equal(resolveQuality('auto',16,16),'high');assert.equal(resolveQuality('high',2,2),'high');assert.ok(QUALITY_PRESETS.low.pixelRatio<QUALITY_PRESETS.high.pixelRatio);assert.equal(QUALITY_PRESETS.low.shadows,0);
});
const loader=new GLTFLoader();loader.register(()=>({name:'headless',loadTexture:()=>Promise.resolve(new T.Texture())}));
async function asset(path:string){const b=await fs.readFile(new URL('../../public/'+path,import.meta.url));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
test('walking phase follows travel; a planted foot stays in place and photography freezes the gait',async()=>{
 const view=new ElmwoodWalkerView(await asset('exports/glb/DS_Pedestrian_01/DS_Pedestrian_01_LOD1.glb'));const foot=view.model.getObjectByName('LeftFoot')!;let last:T.Vector3|undefined;
 for(let i=0;i<120;i++){view.root.position.z+=.9/60;view.update(.9/60,1/60,false,()=>0);if(i>40&&walkingFoot(view.phase).stance){const position=foot.getWorldPosition(new T.Vector3());if(last)assert.ok(position.distanceTo(last)<.02,'stance foot must stay planted');last=position;}else last=undefined;}
 const phase=view.phase;for(let i=0;i<180;i++)view.update(0,1/60,true,()=>0);assert.equal(view.phase,phase);assert.ok(view.phone.visible);assert.ok(view.photoBlend>.99);const hand=view.model.getObjectByName('LeftHand')!.getWorldPosition(new T.Vector3());assert.ok(hand.y>1.3,'phone raised to photograph');
});
test('all Swoop characters load with their own skeleton and correctly scaled rider profile',async()=>{
 const original=new Map(),circuit=new Map();for(const id of ['DS_Man_01','DS_EUC_01',...SWOOP_RIDERS.map(r=>r.id)])original.set(id,await asset(`exports/glb/${id}/${id==='DS_EUC_01'?'DS_EUC_Compact':id+'_LOD'+(id==='DS_Man_01'?0:1)}.glb`));for(const id of ['suit','hoodie','euc'])circuit.set(id,await asset(`circuit-riders/models/circuit-${id}.glb`));
 const terrain={sampleGround(_x:number,_z:number,out:any){out.height=0;out.normal={x:0,y:1,z:0};out.offCourse=false;out.surface='grass';return out;},raycastObstacle(){return null;}};
 const riders=createRideCoreRiders(original,circuit,terrain);assert.equal(riders.size,6);for(const {id,profile} of SWOOP_RIDERS){const view=riders.get(id)!;assert.ok(view.head);assert.equal(view.profile.wheelScale,profile.wheelScale);assert.notEqual(view.rider,original.get(id).scene);}
});
