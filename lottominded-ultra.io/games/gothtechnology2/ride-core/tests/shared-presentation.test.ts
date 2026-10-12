import test from 'node:test';
import assert from 'node:assert/strict';
import {wheelCue,brakingCue} from '../src/rideSoundCues.ts';
import {NaturalSky} from '../src/naturalSky.ts';
import {Vector3} from 'three';
test('shared sound tracks motion and silences wheels on foot, airborne braking and paused play',()=>{
 const p={speed:10,footMode:0,airHeight:0,crashBlend:0,brakeAmount:.8};
 assert(wheelCue(p,true,true).gain>0);assert(brakingCue(p,true)>0);
 for(const q of [{...p,footMode:1},{...p,crashBlend:1},{...p,speed:0}]){assert.equal(wheelCue(q,true,true).gain,0);assert.equal(brakingCue(q,true),0);}
 assert.equal(brakingCue({...p,airHeight:1},true),0);assert.equal(brakingCue(p,false),0);assert.equal(wheelCue(p,false,true).gain,0);assert.equal(wheelCue(p,true,false).gain,0);
 assert(wheelCue({...p,speed:1000},true,true).gain<=.035);
});
test('shared sky follows the light and freezes atmospheric animation for reduced motion or pause',()=>{
 const sky=new NaturalSky(),sun=new Vector3(36,2.8,24).normalize();sky.update(.05,sun,.4);const before=sky.status.cloudTime;
 sky.update(.05,sun,.4,0,false,true);assert.equal(sky.status.cloudTime,before);
 sky.update(.05,sun,.4,0,false,false,true);assert.equal(sky.status.cloudTime,before);
 assert(sky.material.uniforms.sunPosition.value.distanceTo(sun)<1e-8);sky.update(.05,new Vector3(0,1,0),.2);assert(sky.status.cloudTime>before);sky.dispose();
});
