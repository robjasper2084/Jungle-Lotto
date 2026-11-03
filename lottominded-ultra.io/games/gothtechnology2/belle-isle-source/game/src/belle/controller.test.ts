import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {RideCore} from '../../runtime/ride-core/src/ridecore.ts';import {ParkTerrain,type ParkMap} from './terrain.ts';
const map=JSON.parse(fs.readFileSync(process.cwd()+'/public/belle/map.json','utf8')) as ParkMap;const terrain=new ParkTerrain(map);function create(){return new RideCore(terrain,{spawn:{position:{x:0,y:2,z:0},headingY:map.spawn.heading}});}function advance(core:RideCore,seconds:number,input:any={}){for(let i=0;i<seconds*60;i++)core.advance(1/60,input);}
test('rider accelerates from Jefferson without a false collision',()=>{const c=create();advance(c,4,{throttle:.6});assert(c.current.speed>2);assert(!c.controller.crashed);assert(Math.hypot(c.current.x,c.current.z)>5);});
test('dismount, walk and recover beside parked wheel work',()=>{const c=create();c.advance(1/60,{dismount:true});advance(c,2);assert.equal(c.current.footMode,2);assert(c.current.footBlend>.9);advance(c,2,{recover:true});advance(c,2);assert.equal(c.current.footMode,0);assert(!c.controller.crashed);});
test('mounted fall recovers through the reset action used by Recover',()=>{const c=create();assert(c.controller.knockOff('validation'));advance(c,3);assert(c.controller.crashed);c.advance(1/60,{reset:true,recover:true});advance(c,3);assert(!c.controller.crashed);assert.equal(c.current.footMode,0);advance(c,2,{throttle:.5});assert(c.current.speed>1);for(const value of Object.values(c.current))assert(Number.isFinite(value));});
test('rider traverses both graded approaches and the full bridge without a false fall',()=>{
 const b=map.bridge,ux=(b.b[0]-b.a[0])/b.length,uz=(b.b[1]-b.a[1])/b.length;
 const x=b.a[0]-ux*130,z=b.a[1]-uz*130;
 const c=new RideCore(terrain,{spawn:{position:{x,y:terrain.height(x,z),z},headingY:Math.atan2(ux,uz)}});
 let progress=-130;
 for(let i=0;i<60*150&&progress<b.length+80;i++){
  c.advance(1/60,{throttle:.55});
  assert(!c.controller.crashed,'unexpected fall at bridge station '+progress.toFixed(1));
  progress=(c.current.x-b.a[0])*ux+(c.current.z-b.a[1])*uz;
  assert(Number.isFinite(c.current.y));
 }
 assert(progress>b.length+75,'rider should cross the whole bridge and reach the island approach');
});

import {greenhouseWorld,greenhouseLocal} from './conservatory.ts';
test('actual dismounted rider walks through the greenhouse threshold',()=>{
 const cfg=map.conservatory!,p=greenhouseWorld(cfg,-24,0),q=greenhouseWorld(cfg,0,0);
 const c=new RideCore(terrain,{spawn:{position:{x:p.x,y:2,z:p.z},headingY:Math.atan2(q.x-p.x,q.z-p.z)}});
 c.advance(1/60,{dismount:true});advance(c,2);assert.equal(c.current.footMode,2);
 for(let i=0;i<60*30&&greenhouseLocal(cfg,c.current.x,c.current.z).u<0;i++)c.advance(1/60,{throttle:.7});
 const local=greenhouseLocal(cfg,c.current.x,c.current.z);assert(local.u>-9,'rider stuck at entrance '+local.u);assert(Math.abs(local.v)<1.5);assert(!c.controller.crashed);
 for(let i=0;i<60*30&&greenhouseLocal(cfg,c.current.x,c.current.z).u>-22;i++)c.advance(1/60,{throttle:-.7});
 assert(greenhouseLocal(cfg,c.current.x,c.current.z).u<-20,'rider must also leave through the same doorway');assert(!c.controller.crashed);
});

test('rider walks down the graded beach without a false fall or lost support',()=>{
 const c=new RideCore(terrain,{spawn:{position:{x:1949,y:terrain.height(1949,184),z:184},headingY:Math.atan2(-.9,-.43)}});
 c.advance(1/60,{dismount:true});advance(c,2);const start={x:c.current.x,z:c.current.z,y:c.current.y};
 advance(c,4,{throttle:.5});assert(Math.hypot(c.current.x-start.x,c.current.z-start.z)>2);assert(c.current.y<start.y);assert(!c.controller.crashed);assert(terrain.land(c.current.x,c.current.z));assert(Number.isFinite(c.current.y));
});

import {aquariumWorld,aquariumLocal} from './aquarium.ts';
test('dismounted rider enters the aquarium, passes its threshold and walks back out',()=>{
 const cfg=map.aquarium!,p=aquariumWorld(cfg,0,-44),q=aquariumWorld(cfg,0,-20);
 const c=new RideCore(terrain,{spawn:{position:{x:p.x,y:2,z:p.z},headingY:Math.atan2(q.x-p.x,q.z-p.z)}});
 c.advance(1/60,{dismount:true});advance(c,2);assert.equal(c.current.footMode,2);
 for(let i=0;i<60*30&&aquariumLocal(cfg,c.current.x,c.current.z).v< -20;i++)c.advance(1/60,{throttle:.7});
 let local=aquariumLocal(cfg,c.current.x,c.current.z);assert(local.v> -23,'rider stuck outside aquarium '+local.v);assert(Math.abs(local.u)<1.5);assert(!c.controller.crashed);
 for(let i=0;i<60*30&&aquariumLocal(cfg,c.current.x,c.current.z).v> -44;i++)c.advance(1/60,{throttle:-.7});
 local=aquariumLocal(cfg,c.current.x,c.current.z);assert(local.v< -41,'rider must exit through open doorway');assert(!c.controller.crashed);
});

import {BelleVRInput} from './vrInput.ts';
test('Quest input drives the real aquarium collision controller through entrance and wall checks',()=>{
 const cfg=map.aquarium!,p=aquariumWorld(cfg,0,-44),q=aquariumWorld(cfg,0,-20),yaw=Math.atan2(q.x-p.x,q.z-p.z);
 const c=new RideCore(terrain,{spawn:{position:{x:p.x,y:2,z:p.z},headingY:yaw}});
 const input=new BelleVRInput(),pads=['left','right'].map(handedness=>({handedness,gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:Array.from({length:6},()=>({pressed:false,value:0}))}}));
 input.sample(pads);pads[1].gamepad.buttons[4]={pressed:true,value:1};c.advance(1/60,{dismount:input.sample(pads).mount});pads[1].gamepad.buttons[4]={pressed:false,value:0};advance(c,1);assert.equal(c.current.footMode,2);
 pads[0].gamepad.axes[3]=-.8;for(let n=0;n<60*20;n++){const a=input.sample(pads);c.advance(1/60,{throttle:a.throttle,steer:a.steer,facingYaw:yaw});}
 assert(aquariumLocal(cfg,c.current.x,c.current.z).v> -25,'VR walk passes the entrance');assert(!c.controller.crashed);
 // Facing-based side movement still stops against the exhibit/wall collision.
 pads[0].gamepad.axes[3]=0;pads[0].gamepad.axes[2]=1;for(let n=0;n<60*8;n++){const a=input.sample(pads);c.advance(1/60,{throttle:a.throttle,steer:a.steer,facingYaw:yaw});}
 assert(Math.abs(aquariumLocal(cfg,c.current.x,c.current.z).u)<6.8,'strafe cannot leave through aquarium wall');assert(!c.controller.crashed);
});

test('VR focus loss discards hop queued between simulation ticks',()=>{const c=create();c.advance(1/1000,{hop:true});c.clearPendingActions();for(let i=0;i<90;i++){c.advance(1/90,{});assert(c.current.airHeight<.02);}c.advance(1/90,{hop:true});advance(c,.3);assert(c.current.airHeight>.05,'a new deliberate hop must still work');});

import {dossinWorld,dossinLocal} from './dossin.ts';
test('real rider enters Dossin on foot, walks into the gallery and exits through the same door',()=>{
 const cfg=map.dossin!,p=dossinWorld(cfg,-5,-29),q=dossinWorld(cfg,-5,0);
 const c=new RideCore(terrain,{spawn:{position:{x:p.x,y:2,z:p.z},headingY:Math.atan2(q.x-p.x,q.z-p.z)}});
 c.advance(1/60,{dismount:true});advance(c,2);assert.equal(c.current.footMode,2);
 for(let n=0;n<60*35&&dossinLocal(cfg,c.current.x,c.current.z).v<5;n++)c.advance(1/60,{throttle:.7});
 assert(dossinLocal(cfg,c.current.x,c.current.z).v>2,'museum doorway blocked');assert(!c.controller.crashed);
 for(let n=0;n<60*35&&dossinLocal(cfg,c.current.x,c.current.z).v> -29;n++)c.advance(1/60,{throttle:-.7});
 assert(dossinLocal(cfg,c.current.x,c.current.z).v< -26,'museum exit blocked');assert(!c.controller.crashed);
});

test('both aquarium stair flights support a walking rider in both directions without a fall',()=>{
 const cfg=map.aquarium!;
 for(const lane of [-.9,-.6,.75]){
  // Voluntary dismount steps 0.68 m to rider-right (negative local u).
  const p=aquariumWorld(cfg,lane+.68,-43),q=aquariumWorld(cfg,lane+.68,-33),yaw=Math.atan2(q.x-p.x,q.z-p.z);
  const c=new RideCore(terrain,{spawn:{position:{x:p.x,y:2,z:p.z},headingY:yaw}});
  c.advance(1/60,{dismount:true});advance(c,2);
  for(const direction of [1,-1]){
   let high=0,low=10;
   for(let n=0;n<60*24;n++){
    c.advance(1/60,{throttle:direction*.65,facingYaw:yaw});
    const local=aquariumLocal(cfg,c.current.x,c.current.z);
    if(local.v> -40.8&&local.v< -35){high=Math.max(high,c.current.y);low=Math.min(low,c.current.y);}
    assert(!c.controller.crashed,'stair fall in lane '+lane);assert(c.current.airHeight<.025,'stair must stay supported');
    assert(Math.abs(c.current.y-terrain.height(c.current.x,c.current.z))<.025,'feet must match tread height');
    if(direction>0?local.v> -33:local.v< -43)break;
   }
   const local=aquariumLocal(cfg,c.current.x,c.current.z);assert(direction>0?local.v> -33:local.v< -43,'stuck on steps: '+JSON.stringify({lane,direction,local}));
   assert(high>=2.59&&low<2.31,'both flights and landing traversed');
  }
 }
});

import{lagoonBridges}from'./lagoonBridge.ts';
test('real rider crosses the Blue Heron footbridge mounted and on foot in both directions',()=>{
 const b=lagoonBridges(map)[0],length=Math.hypot(b.b[0]-b.a[0],b.b[1]-b.a[1]);
 for(const reverse of[false,true])for(const foot of[false,true]){const a=reverse?b.b:b.a,end=reverse?b.a:b.b,ux=(end[0]-a[0])/length,uz=(end[1]-a[1])/length;
  const c=new RideCore(terrain,{spawn:{position:{x:a[0]+ux*.5,y:2,z:a[1]+uz*.5},headingY:Math.atan2(ux,uz)}});if(foot){c.advance(1/60,{dismount:true});advance(c,2);}
  let progress=.5;for(let i=0;i<60*60&&progress<length-1;i++){c.advance(1/60,{throttle:foot?.7:.35});progress=(c.current.x-a[0])*ux+(c.current.z-a[1])*uz;assert(!c.controller.crashed,'unexpected lagoon bridge fall');assert(terrain.land(c.current.x,c.current.z));}
  assert(progress>length-1,'failed lagoon crossing '+JSON.stringify({reverse,foot,progress}));
 }
});

import {yachtWorld,yachtLocal} from './yachtClub.ts';
test('real dismounted rider enters and leaves Yacht Club through both doors',()=>{const p=yachtWorld(-7.5,23),q=yachtWorld(-7.5,-25),yaw=Math.atan2(q.x-p.x,q.z-p.z);const c=new RideCore(terrain,{spawn:{position:{...p,y:2},headingY:yaw}});c.advance(1/60,{dismount:true});advance(c,2);for(const direction of[1,-1]){for(let n=0;n<60*55;n++){c.advance(1/60,{throttle:direction*.7,facingYaw:yaw});assert(!c.controller.crashed);const local=yachtLocal(c.current.x,c.current.z);if(direction===1?local.v< -25:local.v>23)break;}const l=yachtLocal(c.current.x,c.current.z);assert(direction===1?l.v< -25:l.v>23,'doorway failed '+JSON.stringify(l));}});
test('real rider ascends and descends Yacht Club grand stair without twisting physics or losing support',()=>{const p=yachtWorld(-15,0),q=yachtWorld(-33,0),yaw=Math.atan2(q.x-p.x,q.z-p.z);const c=new RideCore(terrain,{spawn:{position:{...p,y:2},headingY:yaw}});c.advance(1/60,{dismount:true});advance(c,2);for(const direction of[1,-1]){for(let n=0;n<60*30;n++){c.advance(1/60,{throttle:direction*.65,facingYaw:yaw});assert(!c.controller.crashed);assert(c.current.airHeight<.03);const l=yachtLocal(c.current.x,c.current.z);if(direction===1?l.u< -32:l.u> -15)break;}const l=yachtLocal(c.current.x,c.current.z);assert(direction===1?l.u< -32:l.u> -15,'stair failed '+JSON.stringify(l));assert(Math.abs(c.current.y-(direction===1?5.4:2))<.03);}});
