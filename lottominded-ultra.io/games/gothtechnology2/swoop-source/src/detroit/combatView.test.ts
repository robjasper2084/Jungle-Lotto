import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,PerspectiveCamera,Matrix4} from 'three';
import {combatEye,dragAim,stickAxes} from './royale/combatView.ts';
import {HeartProjectiles} from './royale/heartProjectiles.ts';
test('mouse, touch and right-stick right input turns toward screen right at every heading',()=>{
 for(const heading of [0,.8,Math.PI,-2])for(const gain of [.004,.004*.65,.024]){
  const next=dragAim(0,0,1,0,gain),before=new Vector3(Math.sin(heading),0,Math.cos(heading)),after=new Vector3(Math.sin(heading+next.yaw),0,Math.cos(heading+next.yaw));
  assert(after.sub(before).dot(new Vector3(-Math.cos(heading),0,Math.sin(heading)))>0);
 }
 assert(dragAim(0,0,0,-50,.004).pitch>0,'swipe up must look up');
 assert(dragAim(0,0,0,50,.004).pitch<0,'swipe down must look down');
});
test('ADS precision retains direction and bounds while diagonal movement stays normalized',()=>{
 assert(dragAim(0,0,60,0,.004*.65).yaw>dragAim(0,0,60,0,.004).yaw);
 assert.deepEqual(dragAim(0,0,1e5,-1e5,.004),{yaw:-1.25,pitch:.65});
 const a=stickAxes(100,-100,50);assert(Math.abs(Math.hypot(a.steer,a.throttle)-1)<1e-10);assert(a.steer>0&&a.throttle>0);
 assert.deepEqual(stickAxes(0,0,50),{steer:0,throttle:-0});
});
test('eye camera stays behind the sight and carry view places gun below and right, for all rider scales',()=>{
 for(const scale of [.48,1])for(const heading of [0,.8,Math.PI])for(const pitch of [-.65,0,.65]){
  const sight=new Vector3(10,1.5,20),forward=new Vector3(Math.sin(heading)*Math.cos(pitch),Math.sin(pitch),Math.cos(heading)*Math.cos(pitch));
  for(const ads of [true,false]){const eye=combatEye(sight,heading,pitch,scale,ads),camera=new PerspectiveCamera(ads?43:74,1,.03,100);camera.position.copy(eye);camera.lookAt(eye.clone().add(forward));camera.updateMatrixWorld();
   assert(sight.clone().sub(eye).dot(forward)>.4*scale,'receiver cannot surround the eye');
   const screen=sight.clone().project(camera);assert(screen.y<0);if(!ads){assert(screen.x>0);assert(screen.y>-.6);}else assert(Math.abs(screen.x)<1e-8);
  }
 }
});
test('heart shots stay on authoritative positions, cap GPU work and suppress particles for reduced motion',()=>{
 const fx=new HeartProjectiles(3),camera=new PerspectiveCamera(),shot={id:'accepted-shot',p:{x:3,y:2,z:5},v:{x:0,y:0,z:180}},input=JSON.stringify(shot);
 fx.update(Array.from({length:7},()=>shot),camera,1,false);assert.equal(fx.hearts.count,3);assert.equal(fx.sparks.count,12);
 const matrix=new Matrix4();fx.hearts.getMatrixAt(0,matrix);assert.deepEqual(new Vector3().setFromMatrixPosition(matrix).toArray(),[3,2,5]);assert.equal(JSON.stringify(shot),input);
 fx.update([shot],camera,2,true);assert.equal(fx.hearts.count,1);assert.equal(fx.sparks.count,0);fx.reset();assert.equal(fx.hearts.count,0);fx.dispose();
});
