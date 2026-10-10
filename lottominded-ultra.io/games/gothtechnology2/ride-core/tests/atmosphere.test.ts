import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {NaturalSky} from '../src/naturalSky.ts';
import {AirAtmosphere} from '../src/airAtmosphere.ts';

test('pause and reduced motion freeze clouds without blocking weather or lighting changes',()=>{
 const sky=new NaturalSky(),day=new T.Vector3(1,2,1),dusk=new T.Vector3(1,.1,1),haze=new T.Color('#817d88');
 sky.update(.05,day);const time=sky.status.cloudTime;
 for(let i=0;i<60;i++)sky.update(.016,dusk,.8,.7,true,true,false,haze);
 assert.equal(sky.status.cloudTime,time);assert.equal(sky.status.cloud,.8);
 assert.ok(sky.material.uniforms.sunPosition.value.distanceTo(dusk.clone().normalize())<1e-8);
 assert.ok(sky.material.uniforms.airHorizon.value.equals(haze));
 sky.update(.1,day,.28,0,false,false,true);assert.equal(sky.status.cloudTime,time);
 sky.update(.05,day);assert.equal(sky.status.cloudTime,time+.05);sky.dispose();
});

test('compact air budgets reuse resources and reduced motion hides the motes',()=>{
 const parent=new T.Group(),air=new AirAtmosphere(parent),geometry=air.root.geometry,material=air.root.material;
 air.update(1,{x:0,z:0},false,false);assert.equal(geometry.drawRange.count,72);
 air.update(2,{x:2300,y:3,z:1800},true,false);assert.equal(geometry.drawRange.count,20);
 air.update(3,{x:2300,z:1800},true,true);assert.equal(air.root.visible,false);
 air.update(4,{x:2300,z:1800},false,false);assert.equal(air.root.visible,true);
 assert.equal(air.root.geometry,geometry);assert.equal(air.root.material,material);
 air.dispose();assert.equal(parent.children.length,0);
});
