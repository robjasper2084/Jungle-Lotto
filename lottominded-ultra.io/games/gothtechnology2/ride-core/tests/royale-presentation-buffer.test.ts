import test from 'node:test';
import assert from 'node:assert/strict';
import {createPose} from '../src/controller.ts';
import {RemotePoseBuffer} from '../src/royale/remotePoseBuffer.ts';

test('10 Hz spectator frames produce continuous full-body poses at 60 and 120 Hz',()=>{
 for(const fps of [60,120]){
  const buffer=new RemotePoseBuffer();let last=-1,previous:number|undefined;
  for(let i=0;i<=fps*2;i++){
   const now=i*1000/fps,frame=Math.floor((now+1e-6)/100)*6;
   const pose={...createPose(),x:frame/60*2,footMode:2,footBlend:1,footTime:frame/60,footCycle:frame/60,bodyPitch:frame/600,shoulderL:frame/300};
   const accepted=buffer.push('watch',frame,[{id:'a',spawnSerial:0,alive:true,pose}],now);
   assert.equal(accepted,frame!==last);last=frame;
   const p=buffer.pose('a',pose,0,now);
   if(now>=200){
    assert(Math.abs(p.x-(now-100)/1000*2)<1e-6);
    assert(Math.abs(p.footTime-p.x/2)<1e-6);
    assert(Math.abs(p.shoulderL-p.x/10)<1e-6);
    if(previous!==undefined)assert(Math.abs(p.x-previous-2/fps)<1e-6);
    previous=p.x;
   }
  }
 }
});
test('buffer snaps across foot mode, life, teleport and focus changes',()=>{
 const buffer=new RemotePoseBuffer(),p=createPose(),add=(tick:number,pose=p,serial=0,alive=true)=>buffer.push('one',tick,[{id:'a',spawnSerial:serial,alive,pose}],tick/60*1000);
 add(0);const foot={...p,x:1,footMode:2,footBlend:1};add(6,foot);
 assert.deepEqual(buffer.pose('a',foot,0,100),foot);
 const reborn={...p,x:200};add(12,reborn,1);assert.deepEqual(buffer.pose('a',reborn,1,200),reborn);
 buffer.push('two',30,[{id:'a',spawnSerial:1,pose:reborn}],250);
 assert.deepEqual(buffer.pose('a',reborn,1,250),reborn);
 assert.equal(buffer.tick(10000),30,'never extrapolate');
});
