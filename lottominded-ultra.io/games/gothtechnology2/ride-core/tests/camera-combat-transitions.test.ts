import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera} from 'three';
import {CameraBlend} from '../src/cameraPresentation.ts';

test('first-person and ADS keep immediate aim for riding, walking and spectator keys',()=>{
 for(const mode of ['first','ads','ride-first','foot-ads','spectate-rider-2-foot-first']){
  const camera=new PerspectiveCamera(68),blend=new CameraBlend();blend.apply(camera,'foot-chase',1/60);
  camera.position.set(.2,1.7,2);camera.rotation.set(.2,1,0);camera.fov=40;
  const desired=camera.clone();blend.apply(camera,mode,1/60);
  assert(camera.position.distanceTo(desired.position)<1e-12,mode);assert(camera.quaternion.angleTo(desired.quaternion)<1e-7,mode);assert.equal(camera.fov,40,mode);
  camera.position.set(0,2,-3);camera.fov=68;blend.apply(camera,'foot-chase',1/60);
  assert.equal(camera.position.z,-3,'leaving '+mode);assert.equal(camera.fov,68);
 }
});
test('ordinary camera changes still blend; reduced motion and teleport reset immediately',()=>{
 const camera=new PerspectiveCamera(68),blend=new CameraBlend();blend.apply(camera,'ride-chase',1/60);
 camera.position.set(3,2,0);blend.apply(camera,'ride-orbit',1/60);assert(camera.position.x>0&&camera.position.x<3);
 camera.position.set(4,2,0);blend.apply(camera,'ride-shoulder',1/60,true);assert.equal(camera.position.x,4);
 camera.position.set(50,2,0);blend.apply(camera,'ride-orbit',1/60);assert.equal(camera.position.x,50);
});
