import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {WheelLights,wheelLightState} from './wheelLights.ts';

test('braking overrides the rear flash throughout the cycle; reduced motion stays steady',()=>{
 const ride={brakeAmount:0,crashBlend:0},brake={...ride,brakeAmount:.6};
 assert.ok(wheelLightState(ride,0).rearIntensity>wheelLightState(ride,.6).rearIntensity);
 for(const time of [0,.2,.6,1.1]){assert.equal(wheelLightState(brake,time).rear,'brake');assert.equal(wheelLightState(brake,time).rearIntensity,4);}
 assert.deepEqual(wheelLightState(ride,0,true),wheelLightState(ride,.6,true));
});

test('each wheel owns its lamp state and the front beam points ahead without shadow cost',()=>{
 const original=new T.Group(),rearMaterial=new T.MeshStandardMaterial(),frontMaterial=new T.MeshStandardMaterial();
 rearMaterial.name='EUC_Taillight';frontMaterial.name='EUC_Headlight';
 const rear=new T.Mesh(new T.BoxGeometry(.05,.04,.02),rearMaterial),front=new T.Mesh(rear.geometry,frontMaterial);
 rear.name='Rear_Lamp_Lens';front.name='Headlamp_Lens';front.position.set(0,.7,.25);original.add(rear,front);
 const a=original.clone(true),b=original.clone(true),one=new WheelLights(a),two=new WheelLights(b);
 one.update({brakeAmount:1,crashBlend:0},false,.6);two.update({brakeAmount:0,crashBlend:0},false,.6);
 assert.notEqual((a.children[0] as T.Mesh).material,(b.children[0] as T.Mesh).material);
 assert.equal(rearMaterial.emissiveIntensity,1,'source material was changed');
 assert.equal(one.status.rear,'brake');assert.equal(two.status.rear,'flash');
 assert.equal(one.status.frontMaterials,1);assert.equal(one.status.rearMaterials,1);
 one.setBeam(true);const beam=a.getObjectByName('EUC working road headlight') as T.SpotLight;
 assert.ok(beam.intensity>0);assert.ok(beam.target.position.z>beam.position.z);assert.ok(beam.target.position.y<beam.position.y);assert.equal(beam.castShadow,false);
 one.setBeam(false);assert.equal(beam.visible,false);one.dispose();two.dispose();rear.geometry.dispose();rearMaterial.dispose();frontMaterial.dispose();
});
