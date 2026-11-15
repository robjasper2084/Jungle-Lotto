import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {placeCoopCamera} from './cameraRig.ts';

test('first-person cockpit eye snaps to vehicle without chase lag at high speed',()=>{
 const camera=new T.PerspectiveCamera(62,2,0.08,22000);
 const target=new T.Vector3(0,2,15);
 const eye=new T.Vector3(0,2,0);
 placeCoopCamera(camera,eye,target,1/60,true,true,false,true);
 for(let frame=1;frame<=120;frame++){
  // 120 km/h is about 33.33 m/s; 120 Hz collision work is unrelated.
  eye.z=frame*33.333/60;target.z=eye.z+15;
  placeCoopCamera(camera,eye,target,1/60,true,false,false,true);
  assert.ok(camera.position.distanceTo(eye)<1e-9,'cockpit view must not drift into the frame');
 }
 assert.equal(camera.fov,72);
});

test('third-person view retains the existing eased chase camera',()=>{
 const camera=new T.PerspectiveCamera(72,1,0.08,22000);
 const eye=new T.Vector3(10,4,0),target=new T.Vector3(20,2,0);
 placeCoopCamera(camera,eye,target,1/60,false,false,false,true);
 assert.ok(camera.position.x>0&&camera.position.x<10);
 assert.equal(camera.fov,62);
 placeCoopCamera(camera,eye,target,1/60,false,true,false,true);
 assert.ok(camera.position.equals(eye));
});

test('co-op cameras remain independent and reduced-motion snaps',()=>{
 const cameras=[new T.PerspectiveCamera(62),new T.PerspectiveCamera(62)];
 const eyes=[new T.Vector3(3,2,8),new T.Vector3(500,2,700)];
 const target=new T.Vector3(0,2,50);
 placeCoopCamera(cameras[0],eyes[0],target,.016,true,false,false,true);
 placeCoopCamera(cameras[1],eyes[1],target,.016,false,false,true,false);
 assert.ok(cameras[0].position.equals(eyes[0]));
 assert.ok(cameras[1].position.equals(eyes[1]));
 assert.notEqual(cameras[0].position.x,cameras[1].position.x);
 assert.equal(cameras[1].fov,62);
});
