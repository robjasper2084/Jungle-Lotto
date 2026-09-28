import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createPose} from '@digital-static/ridecore';
import {ELMWOOD_CAMERAS,cameraMode,nextElmwoodCamera,frameElmwoodCamera,clearElmwoodCamera} from './elmwood-camera.ts';

test('camera cycle reaches all views and rejects obsolete saved settings',()=>{
  let mode='chase';const reached=new Set<string>();
  for(let i=0;i<ELMWOOD_CAMERAS.length;i++){reached.add(mode);mode=nextElmwoodCamera(mode);}
  assert.equal(reached.size,10);assert.equal(mode,'chase');assert.equal(cameraMode('broken'),'chase');
});
test('first person faces travel heading, responds to crouch, and keeps natural movement optional',()=>{
  const pose=createPose();pose.x=120;pose.y=4;pose.z=-70;
  for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    pose.headingY=heading;const f=frameElmwoodCamera('first',pose,false),look=f.target.clone().sub(f.eye).setY(0).normalize();
    assert.ok(look.dot(new T.Vector3(Math.sin(heading),0,Math.cos(heading)))>.999);
    assert.equal(f.hideRider,true);
  }
  const standing=frameElmwoodCamera('first',pose,false).eye.y;
  pose.crouch=1;pose.rollAngle=.3;pose.bodyBob=.08;
  assert.ok(frameElmwoodCamera('first',pose,false).eye.y<standing-.3);
  assert.notEqual(frameElmwoodCamera('first',pose,false).roll,0);
  assert.ok(Math.abs(frameElmwoodCamera('first',pose,true).roll)<Math.abs(frameElmwoodCamera('first',pose,false).roll));
});
test('side, overhead and low cameras remain distinct when rider turns',()=>{
  const p=createPose();p.headingY=Math.PI/2;
  const left=frameElmwoodCamera('left',p,false),right=frameElmwoodCamera('right',p,false);
  assert.ok(left.eye.z<0&&right.eye.z>0);
  assert.equal(frameElmwoodCamera('overhead',p,false).eye.y,18);
  assert.ok(frameElmwoodCamera('low',p,false).eye.y<1);
  for(const [mode] of ELMWOOD_CAMERAS){const f=frameElmwoodCamera(mode,p,false);assert.ok(f.eye.distanceTo(f.target)>.5);assert.ok(f.fov>=50&&f.fov<=80);}
});
test('camera clearance keeps low angles above terrain and stops at masonry',()=>{
  const anchor=new T.Vector3(0,1.05,0),eye=new T.Vector3(6,-1,0);
  clearElmwoodCamera(eye,anchor,{height:()=>0,raycast:(_o,d,max)=>{assert.ok(Math.abs(d.length()-1)<1e-8);return max>2?2:null;}});
  assert.ok(eye.distanceTo(anchor)<=1.751);assert.ok(eye.y>=.3);
  const low=new T.Vector3(0,-3,3);clearElmwoodCamera(low,anchor,{height:()=>1,raycast:()=>null});assert.equal(low.y,1.3);
});

test('drone follows above and behind travel with look-ahead; orbit starts close enough to inspect the rider',()=>{
  const p=createPose();p.x=40;p.y=3;p.z=-70;p.speed=15;
  for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    p.headingY=heading;
    for(const reduced of [false,true]){
      const f=frameElmwoodCamera('drone',p,reduced),forward=new T.Vector3(Math.sin(heading),0,Math.cos(heading));
      assert.ok(f.eye.y-p.y>=11);assert.ok(f.eye.clone().sub(new T.Vector3(p.x,p.y,p.z)).dot(forward)<-15);
      assert.ok(f.target.clone().sub(new T.Vector3(p.x,p.y,p.z)).dot(forward)>8);assert.equal(f.roll,0);
    }
    const f=frameElmwoodCamera('orbit',p,false);assert.equal(f.hideRider,false);
    assert.ok(f.eye.distanceTo(f.target)>5&&f.eye.distanceTo(f.target)<12);
  }
});
