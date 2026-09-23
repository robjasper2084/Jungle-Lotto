import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assetPath as resolve} from './testAssets.ts';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3,Box3} from 'three';
import {Hero} from './actors.ts';
import {createPose,RideController,NEUTRAL_ACTIONS} from './controller.ts';
import {GamepadRideInput} from './gamepadInput.ts';
import {XRControllerInput} from './xrInput.ts';
import {RIDER_CHOICES,riderChoice} from './riderChoices.ts';
async function mesh(id:string,lod:number){
  const buf=await readFile(resolve('../../exports/glb',id,`${id}_LOD${lod}.glb`)),n=buf.readUInt32LE(12),j=JSON.parse(buf.subarray(20,20+n).toString());
  // Headless geometry/skeleton test; omit texture decoding only. No source asset is modified.
  delete j.images;delete j.textures;delete j.materials;for(const m of j.meshes)for(const p of m.primitives)delete p.material;
  const json=Buffer.from(JSON.stringify(j)),length=Math.ceil(json.length/4)*4,jsonPad=Buffer.alloc(length,32);json.copy(jsonPad);const bin=buf.subarray(20+n),out=Buffer.alloc(20+length+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(length,12);out.writeUInt32LE(0x4e4f534a,16);jsonPad.copy(out,20);bin.copy(out,20+length);
  return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.length),'');
}



const ids=['DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01'] as const;
const data=new Map(await Promise.all(['DS_EUC_01',...ids].map(async id=>[id,await mesh(id,id==='DS_Man_01'?0:1)] as const)));
for(const id of ids)test(id+' seated stance keeps boots on pedals and knees outside the wheel',()=>{
 const h=new Hero(data,undefined,id);for(const seated of [0,.25,.5,.75,1])for(const bank of [-.3,0,.3]){const p=createPose();Object.assign(p,{seated,rollAngle:bank,riderRoll:bank*.7,speed:5});h.apply(p);for(let i=0;i<2;i++){const l=h.legs[i];assert.ok(l.foot.getWorldPosition(new Vector3()).distanceTo(h.footTarget(i,p))<.015,id+' unreachable foot '+i+' seat '+seated);const k=h.lean.worldToLocal(l.knee.getWorldPosition(new Vector3()));assert.ok(Math.abs(k.x)>.10,id+' knee enters housing');}}
 h.dispose();
});
test('seated riding blends, suppresses footdown and releases for a hop',()=>{
 const terrain={sampleGround(x:number,z:number,out:any){Object.assign(out,{height:0,surface:'pavement',offCourse:false});Object.assign(out.normal,{x:0,y:1,z:0});return out;},raycast:()=>null,raycastObstacle:()=>null};
 const c=new RideController(terrain),p=createPose();for(let i=0;i<240;i++)c.step(1/120,{...NEUTRAL_ACTIONS,seated:true});c.writePose(p);assert.ok(p.seated>.99);assert.equal(p.stopFoot,0);
 for(let i=0;i<60;i++)c.step(1/120,{...NEUTRAL_ACTIONS,seated:true,hopHeld:true});c.writePose(p);assert.ok(p.seated<.01);
 c.reset();c.writePose(p);assert.equal(p.seated,0);
});

test('gamepad and Quest sitting toggles are single presses and do not trigger a trick',()=>{
 const buttons=Array.from({length:16},()=>({pressed:false,value:0}));const p={id:'test',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons};const input=new GamepadRideInput();buttons[13].pressed=true;assert.equal(input.sample([p],5).sit,true);assert.equal(input.sample([p],5).sit,false);
 const left={handedness:'left',gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:Array.from({length:6},()=>({pressed:false,value:0}))}},right={handedness:'right',gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:Array.from({length:6},()=>({pressed:false,value:0}))}};left.gamepad.buttons[1].pressed=true;right.gamepad.buttons[4].pressed=true;const xr=new XRControllerInput();const a=xr.sample([left,right],5);assert.equal(a.sit,true);assert.equal(a.trick,false);assert.equal(xr.sample([left,right],5).sit,false);
});
