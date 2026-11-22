import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {createWater} from './water.ts';
import type {ParkMap,ParkTerrain} from './terrain.ts';

test('water wake work tracks hover power and the last emitted ripple through clock changes',()=>{
 const map={water:[],island:[],mainland:[]} as unknown as ParkMap;
 const terrain={land:()=>false} as unknown as ParkTerrain;
 const scene=new T.Scene(),camera=new T.Camera();
 const water=createWater(scene,{} as T.WebGLRenderer,map,terrain,()=>new T.BufferGeometry());
 const surface=scene.getObjectByName('Detroit River rolling waves') as T.Mesh<T.BufferGeometry,T.Material>;
 const shader={uniforms:{},vertexShader:'',fragmentShader:''} as Parameters<T.Material['onBeforeCompile']>[0];
 surface.material.onBeforeCompile(shader,{} as T.WebGLRenderer);
 const wakeActive=shader.uniforms.wakeActive,slots=shader.uniforms.riverRipples.value as T.Vector4[];
 const hover=(rpm:number)=>water.setVehicle({x:1,y:0,z:2,speed:0,rpm});
 water.update(1,camera);
 assert.equal(wakeActive.value,false);
 hover(-.2);water.update(1.1,camera);
 assert.equal(shader.uniforms.hoverWash.value.z,-.2);assert.equal(wakeActive.value,true);
 assert(slots.every(slot=>slot.w===0));
 hover(.8);water.update(2,camera);water.update(2.1,camera);water.update(3,camera);
 assert.deepEqual(slots.filter(slot=>slot.w!==0).map(slot=>slot.z),[2,3]);
 water.setVehicle(null);water.update(7.5,camera);
 assert.equal(wakeActive.value,true);assert.equal(shader.uniforms.hoverWash.value.z,0);
 water.update(8+1e-7,camera);assert.equal(wakeActive.value,true); // the GPU clock still reads 8
 water.update(8.01,camera);assert.equal(wakeActive.value,false);
 water.update(1.9,camera);assert.equal(wakeActive.value,true); // original ripple arithmetic supports negative age
 hover(.4);const emissions=Array.from({length:14},(_,i)=>9+i*.35);
 for(const t of emissions)water.update(t,camera);
 assert.deepEqual(slots.map(slot=>slot.z),[...emissions.slice(10,14),...emissions.slice(2,10)]);
 const last=emissions.at(-1)!;
 water.setVehicle(null);water.update(last+4.9,camera);assert.equal(wakeActive.value,true);
 water.update(last+5.1,camera);assert.equal(wakeActive.value,false);
});
