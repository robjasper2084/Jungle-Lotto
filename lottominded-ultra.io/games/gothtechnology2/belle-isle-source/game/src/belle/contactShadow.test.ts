import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import type {TerrainSampler} from '../../runtime/ride-core/src/terrain.ts';
import {createVehicleContactShadow,type ContactShadowPose} from './contactShadow.ts';

function fixture(){
 const scene=new T.Scene();let height=2,wet=false,reference:number|undefined,normal={x:0,y:1,z:0};
 const terrain:Pick<TerrainSampler,'sampleGround'>={sampleGround(_x,_z,out,ref){reference=ref;out.height=height;out.normal={...normal};out.offCourse=wet;return out;}};
 const shadow=createVehicleContactShadow(scene,terrain),mesh=scene.getObjectByName('Vehicle contact shadow') as T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>;
 return {scene,shadow,mesh,setHeight(v:number){height=v;},setWet(v:boolean){wet=v;},setNormal(v:typeof normal){normal=v;},reference:()=>reference};
}
const wheel:ContactShadowPose={x:10,y:2,z:20,heading:.4,vehicle:'onewheel'};

test('contact shade uses one texture-free quad above the existing pavement skins',()=>{
 const {scene,shadow,mesh}=fixture();shadow.update(wheel);
 assert(mesh.visible);assert.equal(scene.children.length,1);assert.equal(mesh.geometry.index!.count,6);
 assert(mesh.position.y>2.084&&mesh.position.y<2.1);assert(mesh.material.transparent);assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.material.map,null);
 assert(mesh.material.opacity>0&&mesh.material.opacity<=.2);
 shadow.dispose();assert.equal(scene.children.length,0);
});
test('lift softens the contact and hides it for high flight or open water',()=>{
 const f=fixture();f.shadow.update({...wheel,vehicle:'hoverbike',y:2.18});const low=f.mesh.material.opacity,small=f.mesh.scale.x;
 f.shadow.update({...wheel,vehicle:'hoverbike',y:3.4});assert(f.mesh.visible);assert(f.mesh.material.opacity<low);assert(f.mesh.scale.x>small);
 f.shadow.update({...wheel,vehicle:'hoverbike',y:34});assert.equal(f.mesh.visible,false);
 f.setWet(true);f.shadow.update(wheel);assert.equal(f.mesh.visible,false);
});
test('contact follows sampled grades and passes the actor height to bridge support',()=>{
 const f=fixture();f.setHeight(8);f.setNormal({x:0,y:Math.cos(.18),z:-Math.sin(.18)});
 f.shadow.update({...wheel,y:8});assert.equal(f.reference(),8);assert(f.mesh.visible);
 const normal=new T.Vector3(0,1,0).applyQuaternion(f.mesh.quaternion);
 assert(normal.distanceTo(new T.Vector3(0,Math.cos(.18),-Math.sin(.18)))<1e-9);
 assert(Math.abs(f.mesh.position.y-8.09)<1e-9);
});
test('hidden, invalid and unsupported poses cannot leave a stale contact mark',()=>{
 const f=fixture();f.shadow.update(wheel);assert(f.mesh.visible);f.shadow.update(null);assert.equal(f.mesh.visible,false);
 f.shadow.update({...wheel,x:NaN});assert.equal(f.mesh.visible,false);
 f.shadow.update({...wheel,y:1});assert.equal(f.mesh.visible,false);
 f.setNormal({x:1,y:0,z:0});f.shadow.update(wheel);assert.equal(f.mesh.visible,false);
});
